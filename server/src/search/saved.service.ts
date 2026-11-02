import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { geographyPoint } from '../common/geo.js';
import { uuidv7 } from '../common/ids.js';
import type { EvaluationContext } from '../controls/feature-evaluator.js';
import type { RequestUser } from '../controls/request-context.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SavedPlaceDto, SavedSearchDto } from './dto.js';
import { SearchService } from './search.service.js';

const MAX_SAVED_SEARCHES = 20;
const MAX_SAVED_PLACES = 10;
const MAX_SAVED_LISTINGS = 200;

/**
 * Saved areas with alerts (Specification 4.2), saved places for travel distances (decision 48) and favourite listings.
 * Alerts themselves are sent with notifications (step 5, part 3).
 */
@Injectable()
export class SavedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
  ) {}

  // Saved searches -------------------------------------------------------------------------------

  async addSearch(user: RequestUser, dto: SavedSearchDto) {
    const { polygon, centre, radiusM } = dto.area;
    const circle = centre && radiusM ? { centre, radiusM } : null;
    if (!!polygon === !!(centre || radiusM) || (!polygon && !circle)) {
      throw apiError(400, 'BAD_REQUEST', 'area needs either polygon, or centre with radiusM.');
    }
    if ((await this.prisma.savedSearch.count({ where: { userId: user.id } })) >= MAX_SAVED_SEARCHES) {
      throw apiError(409, 'TOO_MANY', `You can save up to ${MAX_SAVED_SEARCHES} searches. Delete one first.`);
    }
    let shape: Prisma.Sql;
    if (polygon) {
      const ring = [...polygon, polygon[0]!];
      const wkt = `POLYGON((${ring.map((p) => `${p.lng} ${p.lat}`).join(', ')}))`;
      shape = Prisma.sql`ST_GeogFromText(${`SRID=4326;${wkt}`})`;
    } else {
      shape = Prisma.sql`ST_Buffer(${geographyPoint(circle!.centre)}, ${circle!.radiusM})`;
    }
    const id = uuidv7();
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "SavedSearch" ("id", "userId", "name", "area", "filters", "alertsEnabled")
        VALUES (${id}::uuid, ${user.id}::uuid, ${dto.name}, ${shape}, ${JSON.stringify(dto.filters ?? {})}::jsonb, ${dto.alertsEnabled ?? true})`;
    } catch {
      throw apiError(400, 'BAD_REQUEST', 'The area drawn is not a valid shape. Draw it again without crossing lines.');
    }
    return (await this.listSearches(user)).find((s) => s.id === id)!;
  }

  async listSearches(user: RequestUser) {
    const rows = await this.prisma.$queryRaw<{ id: string; name: string; geojson: string; filters: unknown; alertsEnabled: boolean; createdAt: Date }[]>`
      SELECT "id", "name", ST_AsGeoJSON("area", 6) AS "geojson", "filters", "alertsEnabled", "createdAt"
      FROM "SavedSearch" WHERE "userId" = ${user.id}::uuid ORDER BY "createdAt" DESC`;
    return rows.map((r) => {
      const ring = (JSON.parse(r.geojson) as { coordinates: number[][][] }).coordinates[0]!;
      return {
        id: r.id,
        name: r.name,
        area: { polygon: ring.slice(0, -1).map(([lng, lat]) => ({ lat: lat!, lng: lng! })) },
        filters: r.filters,
        alertsEnabled: r.alertsEnabled,
        createdAt: r.createdAt,
      };
    });
  }

  async deleteSearch(user: RequestUser, id: string): Promise<void> {
    const { count } = await this.prisma.savedSearch.deleteMany({ where: { id, userId: user.id } });
    if (!count) throw new NotFoundException('Saved search not found.');
  }

  // Saved places ---------------------------------------------------------------------------------

  async addPlace(user: RequestUser, dto: SavedPlaceDto) {
    if ((await this.prisma.savedPlace.count({ where: { userId: user.id } })) >= MAX_SAVED_PLACES) {
      throw apiError(409, 'TOO_MANY', `You can save up to ${MAX_SAVED_PLACES} places. Delete one first.`);
    }
    const id = uuidv7();
    await this.prisma.$executeRaw`
      INSERT INTO "SavedPlace" ("id", "userId", "name", "location") VALUES (${id}::uuid, ${user.id}::uuid, ${dto.name}, ${geographyPoint(dto.location)})`;
    return (await this.listPlaces(user)).find((p) => p.id === id)!;
  }

  async listPlaces(user: RequestUser) {
    const rows = await this.prisma.$queryRaw<{ id: string; name: string; lat: number; lng: number; createdAt: Date }[]>`
      SELECT "id", "name", ST_Y("location"::geometry) AS "lat", ST_X("location"::geometry) AS "lng", "createdAt"
      FROM "SavedPlace" WHERE "userId" = ${user.id}::uuid ORDER BY "createdAt"`;
    return rows.map((r) => ({ id: r.id, name: r.name, location: { lat: r.lat, lng: r.lng }, createdAt: r.createdAt }));
  }

  async deletePlace(user: RequestUser, id: string): Promise<void> {
    const { count } = await this.prisma.savedPlace.deleteMany({ where: { id, userId: user.id } });
    if (!count) throw new NotFoundException('Saved place not found.');
  }

  // Favourite listings ---------------------------------------------------------------------------

  async saveListing(user: RequestUser, listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { status: true } });
    if (!listing || listing.status !== 'LIVE') throw new NotFoundException('Listing not found.');
    if ((await this.prisma.savedListing.count({ where: { userId: user.id } })) >= MAX_SAVED_LISTINGS) {
      throw apiError(409, 'TOO_MANY', `You can save up to ${MAX_SAVED_LISTINGS} homes. Remove one first.`);
    }
    await this.prisma.savedListing.upsert({ where: { userId_listingId: { userId: user.id, listingId } }, create: { userId: user.id, listingId }, update: {} });
  }

  async unsaveListing(user: RequestUser, listingId: string): Promise<void> {
    await this.prisma.savedListing.deleteMany({ where: { userId: user.id, listingId } });
  }

  /** Favourites that are still live, newest saved first. Ones that were rented or closed drop out of the list. */
  async listListings(user: RequestUser, ctx: EvaluationContext) {
    const saved = await this.prisma.savedListing.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { listingId: true } });
    const cards = [];
    for (const s of saved) {
      try {
        cards.push(await this.search.cardFor(s.listingId, ctx));
      } catch {
        // No longer live, or not offered where the user is: left out.
      }
    }
    return cards;
  }
}
