import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { ControlsService } from '../controls/controls.service.js';
import type { FeatureKey } from '../controls/feature-catalogue.js';
import type { EvaluationContext } from '../controls/feature-evaluator.js';
import type { RequestUser } from '../controls/request-context.js';
import { Prisma } from '../generated/prisma/client.js';
import { PRIVATE_STORAGE, type PrivateStorage } from '../integrations/storage/private-storage.js';
import { DISPLAY_LINK_MINUTES, MediaService } from '../media/media.service.js';
import { shownFees } from '../listings/fee-types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MAPS, metresBetween, type Maps } from '../integrations/maps/maps-provider.js';
import { MapsAnswers } from '../integrations/maps/maps-answers.js';
import type { MapTiles } from '../integrations/maps/map-tiles.js';
import { approximateLocation, roundedDistance } from './approximate.js';
import type { SearchFiltersDto, SearchListingsQuery } from './dto.js';

const PAGE_SIZE = 20;
/** Below this map zoom, pins come back grouped. */
const CLUSTER_BELOW_ZOOM = 13;
const CATEGORY_FEATURES: Record<string, FeatureKey> = {
  LONG_TERM_RESIDENTIAL: 'listings.long_term',
  COMMERCIAL: 'listings.commercial',
  SHORT_LET: 'listings.short_let',
};

/** One live listing as the search query returns it. */
interface Row {
  id: string;
  title: string;
  kind: string;
  rentMinor: bigint;
  rentPeriod: string;
  currency: string;
  publishedAt: Date | null;
  createdById: string;
  unitId: string;
  bedrooms: number;
  bathrooms: number;
  propertyTypeLabel: string;
  propertyTypeCode: string;
  area: string;
  ownerId: string | null;
  countryCode: string;
  cityId: string;
  lat: number;
  lng: number;
  distance: number | null;
  /** False when staff removed the lister's verified badge (decision 51). */
  badge: boolean;
  city: string;
  region: string;
}

export type ListingCard = Awaited<ReturnType<SearchService['cards']>>[number];

/**
 * Search, the property page for tenants and visitors, similar and nearby listings, and place names (step 5, part 2).
 *
 * Only live listings in switched-on cities are found, and only kinds of rental switched on for the caller. Before an
 * inspection is confirmed, a listing's position is approximate and distances are rounded (Specification 4.3).
 * Signed-out visitors see every listing in full but never the lister (decision 75).
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    private readonly media: MediaService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
    @Inject(MAPS) private readonly maps: Maps,
    private readonly answers: MapsAnswers,
  ) {}

  /** The country a request is about: the one it names, or the only country switched on. */
  private async countryOf(ctx: EvaluationContext): Promise<{ code: string; defaultLanguage: string } | null> {
    if (ctx.countryCode) return this.prisma.country.findUnique({ where: { code: ctx.countryCode }, select: { code: true, defaultLanguage: true } });
    const on = await this.prisma.country.findMany({ where: { enabled: true }, select: { code: true, defaultLanguage: true }, take: 2 });
    return on.length === 1 ? on[0]! : null;
  }

  /** Where the apps fetch the map picture, in the country's language and with its borders and labels. */
  async tileSource(tiles: MapTiles, ctx: EvaluationContext) {
    const country = await this.countryOf(ctx);
    if (!country) return null;
    return tiles.source({ language: country.defaultLanguage, region: country.code });
  }

  async search(q: SearchListingsQuery, ctx: EvaluationContext) {
    if (q.near && q.bbox) throw apiError(400, 'BAD_REQUEST', 'Send either near or bbox, not both.');
    if (q.near) await this.requireFeature(q.source === 'LANDMARK' ? 'search.landmark' : 'search.around_me', ctx);
    if (q.bbox) await this.requireFeature('search.map', ctx);

    const near = q.near ? parsePoint(q.near) : null;
    const point = near ? Prisma.sql`ST_SetSRID(ST_MakePoint(${near.lng}, ${near.lat}), 4326)::geography` : null;
    const where: Prisma.Sql[] = [await this.baseWhere(q, ctx)];
    if (point) where.push(Prisma.sql`ST_DWithin(b."location", ${point}, ${q.radiusM ?? 1000})`);
    if (q.bbox) {
      const [s, w, n, e] = q.bbox.split(',').map(Number);
      where.push(Prisma.sql`ST_Intersects(b."location"::geometry, ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326))`);
    }
    if (q.area) where.push(Prisma.sql`lower(b."area") = lower(${q.area})`);
    if (q.city) where.push(Prisma.sql`lower(c."name") = lower(${q.city})`);
    const whereSql = Prisma.join(where, ' AND ');

    // Zoomed out on the map: groups of pins rather than single listings.
    if (q.bbox && q.zoom !== undefined && q.zoom < CLUSTER_BELOW_ZOOM) {
      const cell = 360 / 2 ** q.zoom / 4;
      // Each group sits at the centre of its grid square, never at a listing's own position.
      const groups = await this.prisma.$queryRaw<{ lat: number; lng: number; count: bigint }[]>`
        SELECT ST_Y(g."cell") AS "lat", ST_X(g."cell") AS "lng", count(*) AS "count"
        FROM (SELECT ST_SnapToGrid(b."location"::geometry, ${cell}) AS "cell"
        FROM "Listing" l JOIN "Unit" u ON u."id" = l."unitId" JOIN "Building" b ON b."id" = u."buildingId"
          JOIN "PropertyType" pt ON pt."id" = u."propertyTypeId" JOIN "City" c ON c."id" = b."cityId" JOIN "Region" r ON r."id" = c."regionId"
        WHERE ${whereSql}) g
        GROUP BY g."cell"`;
      const clusters = groups.map((g) => ({ centre: { lat: round5(g.lat), lng: round5(g.lng) }, count: Number(g.count) }));
      return { items: [], clusters, total: clusters.reduce((sum, c) => sum + c.count, 0), nextCursor: null };
    }

    const sort = q.sort ?? (point ? 'DISTANCE' : 'NEWEST');
    if (sort === 'DISTANCE' && !point) throw apiError(400, 'BAD_REQUEST', 'Sorting by distance needs near.');
    const order =
      sort === 'DISTANCE' ? Prisma.sql`"distance" ASC, l."id" DESC`
      : sort === 'PRICE_ASC' ? Prisma.sql`l."rentMinor" ASC, l."id" DESC`
      : sort === 'PRICE_DESC' ? Prisma.sql`l."rentMinor" DESC, l."id" DESC`
      : Prisma.sql`l."publishedAt" DESC NULLS LAST, l."id" DESC`;
    const offset = q.cursor ? decodeCursor(q.cursor) : 0;
    const rows = await this.rows(whereSql, point, order, PAGE_SIZE + 1, offset);
    const page = rows.slice(0, PAGE_SIZE);
    const [{ count }] = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) AS "count"
      FROM "Listing" l JOIN "Unit" u ON u."id" = l."unitId" JOIN "Building" b ON b."id" = u."buildingId"
        JOIN "PropertyType" pt ON pt."id" = u."propertyTypeId" JOIN "City" c ON c."id" = b."cityId" JOIN "Region" r ON r."id" = c."regionId"
      WHERE ${whereSql}`;
    return { items: await this.cards(page), clusters: [], total: Number(count), nextCursor: rows.length > PAGE_SIZE ? encodeCursor(offset + PAGE_SIZE) : null };
  }

  /** The areas with the most live listings, for "popular areas" on the search pages (decisions 77 and 80). */
  async areas(city: string | undefined, limit: number, ctx: EvaluationContext) {
    const where = await this.baseWhere({}, ctx);
    const rows = await this.prisma.$queryRaw<{ area: string; city: string; count: bigint }[]>`
      SELECT min(b."area") AS "area", c."name" AS "city", count(*) AS "count"
      FROM "Listing" l JOIN "Unit" u ON u."id" = l."unitId" JOIN "Building" b ON b."id" = u."buildingId"
        JOIN "PropertyType" pt ON pt."id" = u."propertyTypeId" JOIN "City" c ON c."id" = b."cityId" JOIN "Region" r ON r."id" = c."regionId"
      WHERE ${where} ${city ? Prisma.sql`AND lower(c."name") = lower(${city})` : Prisma.empty}
      GROUP BY lower(b."area"), c."name"
      ORDER BY count(*) DESC, min(b."area")
      LIMIT ${limit}`;
    return rows.map((r) => ({ area: r.area, city: r.city, count: Number(r.count) }));
  }

  /** Similar homes nearby and more homes in the same area, for the property page (decisions 77 and 80). */
  async related(listingId: string, limit: number, ctx: EvaluationContext) {
    const base = await this.liveRow(listingId, ctx);
    const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${base.lng}, ${base.lat}), 4326)::geography`;
    const common = await this.baseWhere({}, ctx);
    const lo = (base.rentMinor * 75n) / 100n;
    const hi = (base.rentMinor * 125n) / 100n;
    const similar = await this.rows(
      Prisma.sql`${common} AND l."id" <> ${listingId}::uuid AND pt."code" = ${base.propertyTypeCode} AND l."rentPeriod"::text = ${base.rentPeriod}
        AND l."rentMinor" BETWEEN ${lo} AND ${hi} AND ST_DWithin(b."location", ${point}, 5000)`,
      point,
      Prisma.sql`"distance" ASC, l."id" DESC`,
      limit,
    );
    const taken = [listingId, ...similar.map((r) => r.id)];
    const nearby = await this.rows(
      Prisma.sql`${common} AND l."id" <> ALL(${taken}::uuid[]) AND b."cityId" = ${base.cityId}::uuid
        AND (lower(b."area") = lower(${base.area}) OR ST_DWithin(b."location", ${point}, 2000))`,
      point,
      Prisma.sql`l."publishedAt" DESC NULLS LAST, l."id" DESC`,
      limit,
    );
    // Distances from one listing to another are not shown; they would point to where the first one is.
    const strip = (cards: ListingCard[]) => cards.map((c) => ({ ...c, distanceM: null }));
    return { similar: strip(await this.cards(similar)), nearby: strip(await this.cards(nearby)) };
  }

  /**
   * Areas and landmarks for landmark search: first those named on listings in switched-on cities, then the maps
   * provider's places in the country, near the city when there is one (ADR 0015). The provider's answers are kept
   * for the country's maps.keepAnswersDays.
   */
  async places(q: string, ctx: EvaluationContext) {
    const own = await this.ownPlaces(q);
    const country = await this.countryOf(ctx);
    if (!country || q.trim().length < 3 || this.maps.places.provider === 'none') return own;
    const settings = await this.controls.getCountrySettings(country.code);
    const city = await this.prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT ST_Y(c."centre"::geometry) AS "lat", ST_X(c."centre"::geometry) AS "lng" FROM "City" c JOIN "Region" r ON r."id" = c."regionId"
      WHERE c."enabled" AND r."enabled" AND r."countryCode" = ${country.code} AND c."centre" IS NOT NULL LIMIT 2`;
    const near = city.length === 1 ? { lat: round5(city[0]!.lat), lng: round5(city[0]!.lng) } : undefined;
    const text = q.trim().toLowerCase().replace(/\s+/g, ' ');
    const found = await this.answers.get(
      `places:${this.maps.places.provider}:${country.code}:${near ? `${near.lat},${near.lng}` : '-'}:${text}`,
      settings.maps.keepAnswersDays,
      () => this.maps.places.searchPlaces({ text, countryCode: country.code, near, limit: 10 }),
      [],
    );
    const seen = new Set(own.map((p) => p.name.toLowerCase()));
    const theirs = found
      .filter((p) => !seen.has(p.name.toLowerCase()))
      .map((p) => ({ name: p.name, description: p.description, location: { lat: round5(p.location.lat), lng: round5(p.location.lng) } }));
    return [...own, ...theirs].slice(0, 10);
  }

  /** Areas and landmarks whose names start with the text, in switched-on cities. */
  private async ownPlaces(q: string) {
    const like = `${q.trim().replace(/[%_\\]/g, '')}%`;
    const rows = await this.prisma.$queryRaw<{ name: string; city: string; kind: string; lat: number; lng: number }[]>`
      SELECT x."name", x."city", x."kind", ST_Y(ST_Centroid(ST_Collect(x."loc"))) AS "lat", ST_X(ST_Centroid(ST_Collect(x."loc"))) AS "lng"
      FROM (
        SELECT b."area" AS "name", c."name" AS "city", 'AREA' AS "kind", b."location"::geometry AS "loc"
          FROM "Building" b JOIN "City" c ON c."id" = b."cityId" JOIN "Region" r ON r."id" = c."regionId"
          WHERE c."enabled" AND r."enabled" AND b."area" ILIKE ${like}
        UNION ALL
        SELECT b."landmark", c."name", 'LANDMARK', b."location"::geometry
          FROM "Building" b JOIN "City" c ON c."id" = b."cityId" JOIN "Region" r ON r."id" = c."regionId"
          WHERE c."enabled" AND r."enabled" AND b."landmark" ILIKE ${like}
      ) x
      GROUP BY x."name", x."city", x."kind"
      ORDER BY x."kind", x."name"
      LIMIT 10`;
    return rows.map((r) => ({
      name: r.name,
      description: `${r.kind === 'AREA' ? 'Area' : 'Landmark'} in ${r.city}`,
      location: { lat: round5(r.lat), lng: round5(r.lng) },
    }));
  }

  /**
   * The property page for tenants and visitors: the full listing (decision 75). The lister, and travel distances to
   * the viewer's saved places, are shown only to signed-in users; the exact position never, until an inspection is
   * confirmed (inspections arrive in part 4).
   */
  async publicView(listingId: string, user: RequestUser | undefined, ctx: EvaluationContext) {
    const row = await this.liveRow(listingId, ctx);
    const [card] = await this.cards([row]);
    const l = await this.prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
      include: { unit: { include: { parts: { orderBy: { sortOrder: 'asc' } } } } },
    });
    const createdBy = await this.prisma.user.findUniqueOrThrow({ where: { id: l.createdById }, select: { firstName: true, lastName: true, identityVerifiedAt: true, badgeRemovedAt: true, createdAt: true } });
    const media = await this.prisma.mediaAsset.findMany({
      where: { unitId: l.unitId, status: 'READY', kind: { not: 'VIDEO' } },
      include: { unitPart: true },
      orderBy: { capturedAt: 'asc' },
    });
    const items = await Promise.all(media.map((m) => this.media.toItem(m)));
    const settings = await this.controls.getCountrySettings(row.countryCode);
    const money = (minor: bigint) => ({ amountMinor: minor.toString(), currency: l.currency });

    let savedPlaceDistances: { savedPlaceId: string; name: string; distanceM: number; travelMinutes: null }[] = [];
    let lister = null;
    if (user) {
      const places = await this.prisma.$queryRaw<{ id: string; name: string; metres: number }[]>`
        SELECT sp."id", sp."name", ST_Distance(sp."location", (SELECT "location" FROM "Building" WHERE "id" = (SELECT "buildingId" FROM "Unit" WHERE "id" = ${l.unitId}::uuid))) AS "metres"
        FROM "SavedPlace" sp WHERE sp."userId" = ${user.id}::uuid ORDER BY sp."createdAt"`;
      // Straight-line distance for now; travel times need the maps provider.
      savedPlaceDistances = places.map((p) => ({ savedPlaceId: p.id, name: p.name, distanceM: roundedDistance(p.metres), travelMinutes: null }));
      lister = {
        id: l.createdById,
        displayName: `${createdBy.firstName} ${createdBy.lastName}`.trim(),
        role: l.createdById === row.ownerId ? 'LANDLORD' : 'AGENT',
        verified: !!createdBy.identityVerifiedAt && !createdBy.badgeRemovedAt,
        memberSince: createdBy.createdAt,
        typicalResponseMinutes: null,
      };
    }
    // Only the fee types shown in this country appear in the cost box (decision 55).
    const fees = shownFees(settings).map((f) => ({ type: f.type, field: f.field, minor: l[f.column] }));
    const fee = (field: string) => {
      const found = fees.find((f) => f.field === field);
      return found ? money(found.minor) : null;
    };
    const total = fees.reduce((sum, f) => sum + f.minor, l.rentMinor);
    // The exact position is released to a tenant whose inspection is confirmed (Specification 4.3).
    const released =
      !!user && (await this.prisma.inspection.count({ where: { listingId, tenantId: user.id, status: { in: ['CONFIRMED', 'COMPLETED'] } } })) > 0;
    return {
      ...card,
      kind: l.kind,
      description: l.description,
      moveInCost: {
        rent: money(l.rentMinor),
        agencyFee: fee('agencyFee'),
        legalFee: fee('legalFee'),
        cautionDeposit: fee('cautionDeposit'),
        serviceCharge: fee('serviceCharge'),
        fees: fees.map((f) => ({ type: f.type, amount: money(f.minor) })),
        total: money(total),
        inspectionFee: 'FREE',
      },
      serviceChargeCovers: l.serviceChargeCovers,
      availableFrom: l.availableFrom ? l.availableFrom.toISOString().slice(0, 10) : null,
      minTermMonths: l.minTermMonths,
      maxTermMonths: l.maxTermMonths,
      occupancyRules: l.occupancyRules,
      unit: {
        toilets: l.unit.toilets,
        floorLevel: l.unit.floorLevel,
        floorArea: l.unit.floorAreaSqm === null ? null : Number(l.unit.floorAreaSqm),
        areaUnit: settings.formats.areaUnit,
        details: l.unit.details,
      },
      gallery: l.unit.parts
        .filter((p) => p.mediaKind === 'PHOTO')
        .map((p) => ({ partCode: p.code, partLabel: p.label, note: p.note, media: items.filter((i) => i.partCode === p.code) }))
        .filter((g) => g.media.length > 0),
      // The watermarked copy of the walkthrough video, behind a 15-minute link (ADR 0009).
      walkthrough: await this.walkthrough(l.unitId),
      savedPlaceDistances,
      nearbyAmenities: await this.amenities(card.approximateLocation, row.countryCode, settings),
      lister,
      exactLocation: released ? { lat: row.lat, lng: row.lng } : null,
    };
  }

  /**
   * Schools, hospitals, markets and the like near a property, from the maps provider (ADR 0015), measured from the
   * approximate position and rounded like every other distance, so they do not point to the exact building.
   */
  private async amenities(at: { lat: number; lng: number } | null, countryCode: string, settings: Awaited<ReturnType<ControlsService['getCountrySettings']>>) {
    const m = settings.maps;
    if (!at || !m.amenityKinds.length || !m.amenityLimit || this.maps.amenities.provider === 'none') return [];
    const found = await this.answers.get(
      `amenities:${this.maps.amenities.provider}:${countryCode}:${at.lat.toFixed(4)},${at.lng.toFixed(4)}:${m.amenityRadiusMetres}:${[...m.amenityKinds].sort().join(',')}`,
      m.keepAnswersDays,
      () => this.maps.amenities.nearbyAmenities({ at, radiusMetres: m.amenityRadiusMetres, kinds: [...m.amenityKinds], limit: 20 }),
      [],
    );
    return found
      .map((a) => ({ kind: a.kind, name: a.name, distanceM: roundedDistance(metresBetween(at, a.location)) }))
      .sort((x, y) => x.distanceM - y.distanceM)
      .slice(0, m.amenityLimit);
  }

  private async walkthrough(unitId: string) {
    const video = await this.prisma.mediaAsset.findFirst({
      where: { unitId, kind: 'VIDEO', status: 'READY', unitPart: { code: 'walkthrough' } },
      include: { unitPart: true },
      orderBy: { capturedAt: 'desc' },
    });
    if (!video || !(video.variants as Record<string, string> | null)?.video) return null;
    const item = await this.media.toItem(video);
    return { id: item.id, durationSeconds: item.durationSeconds, capturedAt: item.capturedAt, url: item.display?.video ?? null, expiresAt: item.display?.expiresAt ?? null };
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  /** Live listings in switched-on cities, of kinds switched on for the caller, matching the filters. */
  private async baseWhere(f: SearchFiltersDto, ctx: EvaluationContext): Promise<Prisma.Sql> {
    const categories: string[] = [];
    for (const [category, feature] of Object.entries(CATEGORY_FEATURES)) {
      if (await this.controls.isEnabled(feature, ctx)) categories.push(category);
    }
    const parts: Prisma.Sql[] = [
      Prisma.sql`l."status" = 'LIVE'`,
      Prisma.sql`c."enabled"`,
      Prisma.sql`r."enabled"`,
      Prisma.sql`pt."category"::text = ANY(${categories}::text[])`,
    ];
    if (f.kind) parts.push(Prisma.sql`l."kind"::text = ${f.kind}`);
    if (f.category) parts.push(Prisma.sql`pt."category"::text = ${f.category}`);
    if (f.propertyType) parts.push(Prisma.sql`pt."code" = ${f.propertyType}`);
    if (f.minRent) parts.push(Prisma.sql`l."rentMinor" >= ${BigInt(f.minRent)}`);
    if (f.maxRent) parts.push(Prisma.sql`l."rentMinor" <= ${BigInt(f.maxRent)}`);
    if (f.minBedrooms !== undefined) parts.push(Prisma.sql`u."bedrooms" >= ${f.minBedrooms}`);
    if (f.furnished) parts.push(Prisma.sql`u."details"->>'furnishing' = ${f.furnished}`);
    return Prisma.join(parts, ' AND ');
  }

  private rows(where: Prisma.Sql, point: Prisma.Sql | null, order: Prisma.Sql, limit: number, offset = 0): Promise<Row[]> {
    const distance = point ? Prisma.sql`ST_Distance(b."location", ${point})` : Prisma.sql`NULL::float8`;
    return this.prisma.$queryRaw<Row[]>`
      SELECT l."id", l."title", l."kind"::text AS "kind", l."rentMinor", l."rentPeriod"::text AS "rentPeriod", l."currency", l."publishedAt",
             l."createdById", l."unitId", u."bedrooms", u."bathrooms", pt."label" AS "propertyTypeLabel", pt."code" AS "propertyTypeCode",
             b."area", b."ownerId", b."countryCode", b."cityId",
             ST_Y(b."location"::geometry) AS "lat", ST_X(b."location"::geometry) AS "lng", ${distance} AS "distance",
             (cu."badgeRemovedAt" IS NULL) AS "badge", c."name" AS "city", r."name" AS "region"
      FROM "Listing" l
        JOIN "User" cu ON cu."id" = l."createdById"
        JOIN "Unit" u ON u."id" = l."unitId"
        JOIN "Building" b ON b."id" = u."buildingId"
        JOIN "PropertyType" pt ON pt."id" = u."propertyTypeId"
        JOIN "City" c ON c."id" = b."cityId"
        JOIN "Region" r ON r."id" = c."regionId"
      WHERE ${where}
      ORDER BY ${order}
      LIMIT ${limit} OFFSET ${offset}`;
  }

  private async liveRow(listingId: string, ctx: EvaluationContext): Promise<Row> {
    const [row] = await this.rows(Prisma.sql`${await this.baseWhere({}, ctx)} AND l."id" = ${listingId}::uuid`, null, Prisma.sql`l."id"`, 1);
    if (!row) throw new NotFoundException('Listing not found.');
    return row;
  }

  /** One live listing's card, or "not found". */
  async cardFor(listingId: string, ctx: EvaluationContext) {
    const [card] = await this.cards([await this.liveRow(listingId, ctx)]);
    return card!;
  }

  /** Listing cards: cover photo behind an expiring link, approximate position, rounded distance and badges. */
  async cards(rows: Row[]) {
    if (!rows.length) return [];
    const unitIds = rows.map((r) => r.unitId);
    const media = await this.prisma.mediaAsset.findMany({
      where: { unitId: { in: unitIds }, status: 'READY', kind: 'PHOTO' },
      select: { unitId: true, variants: true, capturedAt: true, unitPart: { select: { sortOrder: true } } },
      orderBy: [{ unitPart: { sortOrder: 'asc' } }, { capturedAt: 'asc' }],
    });
    const settingsByCountry = new Map<string, number>();
    for (const c of new Set(rows.map((r) => r.countryCode))) {
      settingsByCountry.set(c, (await this.controls.getCountrySettings(c)).listings.approximateLocationMetres);
    }
    const expiresAt = new Date(Date.now() + DISPLAY_LINK_MINUTES * 60_000);
    return Promise.all(
      rows.map(async (r) => {
        const own = media.filter((m) => m.unitId === r.unitId);
        const coverKey = (own.find((m) => m.variants)?.variants as Record<string, string> | undefined)?.medium;
        const takenAt = own.length ? own.reduce((a, m) => (m.capturedAt < a ? m.capturedAt : a), own[0]!.capturedAt) : null;
        return {
          id: r.id,
          title: r.title,
          coverImage: coverKey ? await this.storage.createViewLink(coverKey, expiresAt) : null,
          propertyTypeLabel: r.propertyTypeLabel,
          bedrooms: r.bedrooms,
          bathrooms: r.bathrooms,
          rent: { amountMinor: r.rentMinor.toString(), currency: r.currency },
          rentPeriod: r.rentPeriod,
          area: r.area,
          city: r.city,
          region: r.region,
          approximateLocation: approximateLocation(r.id, { lat: r.lat, lng: r.lng }, settingsByCountry.get(r.countryCode)!),
          distanceM: r.distance === null ? null : roundedDistance(r.distance),
          // Every live listing has passed review: the lister is the identity-checked owner, or an agent with approved
          // authority. A lister whose badge staff removed shows none (decision 51).
          badges: r.badge ? [r.createdById === r.ownerId ? 'OWNER_VERIFIED' : 'AUTHORITY_VERIFIED'] : [],
          photosTakenAt: takenAt,
          publishedAt: r.publishedAt,
        };
      }),
    );
  }

  private async requireFeature(key: FeatureKey, ctx: EvaluationContext): Promise<void> {
    if (!(await this.controls.isEnabled(key, ctx))) throw apiError(403, 'FEATURE_UNAVAILABLE', 'This feature is not available at the moment.', { feature: key });
  }
}

function parsePoint(s: string) {
  const [lat, lng] = s.split(',').map(Number);
  if (lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180) throw apiError(400, 'BAD_REQUEST', 'near is not a valid position.');
  return { lat: lat!, lng: lng! };
}

function encodeCursor(offset: number): string {
  return Buffer.from(`o${offset}`).toString('base64url');
}

function decodeCursor(cursor: string): number {
  const m = /^o(\d{1,6})$/.exec(Buffer.from(cursor, 'base64url').toString());
  if (!m) throw apiError(400, 'BAD_REQUEST', 'cursor is not valid.');
  return Number(m[1]);
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}
