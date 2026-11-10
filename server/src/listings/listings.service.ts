import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { ControlsService } from '../controls/controls.service.js';
import type { CountrySettings } from '../controls/country-settings.schema.js';
import type { FeatureKey } from '../controls/feature-catalogue.js';
import type { RequestUser } from '../controls/request-context.js';
import { Prisma, type Listing } from '../generated/prisma/client.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PropertiesService } from '../properties/properties.service.js';
import { ACTIVE_AUTHORITY } from './authorities.service.js';
import type { CreateListingDto, ListingFieldsDto, ListingStatusDto, MoneyDto, MyListingsQuery } from './dto.js';

import { randomInt } from 'node:crypto';
import { AlertsService } from '../notifications/alerts.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { shownFees } from './fee-types.js';
import { ListingChecksService } from './listing-checks.service.js';

const FEE_FIELDS = ['agencyFee', 'legalFee', 'cautionDeposit', 'serviceCharge'] as const;
const MONEY_COLUMNS = {
  rent: 'rentMinor',
  agencyFee: 'agencyFeeMinor',
  legalFee: 'legalFeeMinor',
  cautionDeposit: 'cautionDepositMinor',
  serviceCharge: 'serviceChargeMinor',
} as const;
/** Fields a live or paused listing may still change: its text and its money (fee changes are recorded). */
const LIVE_EDITABLE = new Set(['title', 'description', 'rent', ...FEE_FIELDS, 'serviceChargeCovers']);
const PAGE_SIZE = 20;

type Missing = { kind: 'PART_MEDIA' | 'WALKTHROUGH' | 'OWNERSHIP_DOCUMENT' | 'AUTHORITY' | 'FEES'; partCode?: string; message: string };

/**
 * Listings and submission (Specification 6.2, 6.6 and 8.2; ADR 0009). A listing is for one unit, made and managed by
 * those who may manage its building. On submission the automatic checks decide whether it goes live at once, to a desk
 * review or to a site visit (ADR 0012).
 */
@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    private readonly properties: PropertiesService,
    private readonly media: MediaService,
    private readonly checks: ListingChecksService,
    private readonly notifications: NotificationsService,
    private readonly alerts: AlertsService,
  ) {}

  async create(user: RequestUser, dto: CreateListingDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId }, include: { propertyType: true, building: { include: { city: true } } } });
    if (!unit) throw new NotFoundException('Unit not found.');
    const building = await this.properties.assertMayManage(user, unit.buildingId);
    const settings = await this.controls.getCountrySettings(building.countryCode);
    const country = await this.prisma.country.findUniqueOrThrow({ where: { code: building.countryCode } });

    // The kind of rental must suit the property type, and be switched on where the property is.
    const category = unit.propertyType.category;
    if ((category === 'SHORT_LET') !== (dto.kind === 'SHORT_LET')) {
      throw apiError(400, 'WRONG_KIND', category === 'SHORT_LET' ? 'This property type is let as a short let.' : 'This property type is let long-term.');
    }
    if (dto.kind === 'SHORT_LET' && !settings.shortLet.allowed) throw apiError(400, 'SHORT_LETS_NOT_ALLOWED', 'Short lets are not allowed in this country.');
    const feature: FeatureKey = category === 'SHORT_LET' ? 'listings.short_let' : category === 'COMMERCIAL' ? 'listings.commercial' : 'listings.long_term';
    const ctx = { countryCode: building.countryCode, regionId: unit.building.city.regionId, cityId: unit.building.cityId, userTypes: user.types, userId: user.id };
    if (!(await this.controls.isEnabled(feature, ctx))) {
      throw apiError(403, 'FEATURE_UNAVAILABLE', 'This kind of listing is not available at the moment.', { feature });
    }

    // Every fee shown in this country must be entered (decision 55).
    for (const field of ['title', 'description', 'rent', 'rentPeriod', ...shownFees(settings).map((f) => f.field)] as const) {
      if (dto[field] === undefined) {
        throw apiError(400, 'BAD_REQUEST', `${field} is needed. Enter every fee, using 0 when there is none: no fee may be charged that is not shown.`);
      }
    }
    const data = this.fields(dto, dto.kind, country.currency, settings);
    try {
      const listing = await this.prisma.listing.create({
        data: { ...data, unitId: unit.id, kind: dto.kind, currency: country.currency, createdById: user.id } as Prisma.ListingUncheckedCreateInput,
      });
      return this.ownerView(listing.id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw apiError(409, 'LISTING_EXISTS', 'This unit already has an open listing.');
      }
      throw e;
    }
  }

  /** Whether the user may manage the listing's building (and so sees the owner view). */
  async mayManage(user: RequestUser, listingId: string): Promise<boolean> {
    return this.findManaged(user, listingId).then(
      () => true,
      () => false,
    );
  }

  async get(user: RequestUser, listingId: string) {
    await this.findManaged(user, listingId);
    return this.ownerView(listingId);
  }

  async update(user: RequestUser, listingId: string, dto: ListingFieldsDto) {
    const listing = await this.findManaged(user, listingId);
    const sent = Object.keys(dto).filter((k) => (dto as Record<string, unknown>)[k] !== undefined);
    if (['SUBMITTED', 'IN_REVIEW'].includes(listing.status)) {
      throw apiError(409, 'LISTING_LOCKED', 'This listing is waiting for review and cannot change until it is decided.');
    }
    if (['RENTED', 'EXPIRED', 'REMOVED'].includes(listing.status)) {
      throw apiError(409, 'LISTING_CLOSED', 'This listing is closed. Make a new listing for the unit instead.');
    }
    const live = listing.status === 'LIVE' || listing.status === 'PAUSED';
    if (live) {
      const locked = sent.filter((k) => !LIVE_EDITABLE.has(k));
      if (locked.length) throw apiError(409, 'FIELD_LOCKED', `A live listing can change only its text and fees, not: ${locked.join(', ')}.`, { fields: locked });
    }
    const unit = await this.prisma.unit.findUniqueOrThrow({ where: { id: listing.unitId }, include: { building: true } });
    const settings = await this.controls.getCountrySettings(unit.building.countryCode);
    const data = this.fields(dto, listing.kind, listing.currency, settings, listing);

    await this.prisma.$transaction(async (tx) => {
      await tx.listing.update({ where: { id: listing.id }, data });
      // Every change to the rent or a fee on a live listing is recorded (Specification 8.2).
      const changed = Object.entries(MONEY_COLUMNS).filter(([, col]) => col in data && (data as Record<string, bigint>)[col] !== listing[col]);
      if (live && changed.length) {
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'listing.fees_changed',
            entityType: 'Listing',
            entityId: listing.id,
            metadata: Object.fromEntries(changed.map(([name, col]) => [name, { from: listing[col].toString(), to: (data as Record<string, bigint>)[col]!.toString() }])),
          },
        });
      }
    });
    return this.ownerView(listing.id);
  }

  /** Submits a complete listing: the automatic checks run and their risk score decides the next step (ADR 0012). */
  async submit(user: RequestUser, listingId: string) {
    const listing = await this.findManaged(user, listingId);
    if (listing.status !== 'DRAFT' && listing.status !== 'REJECTED') {
      throw apiError(409, 'NOT_A_DRAFT', 'Only a draft, or a listing returned by the review, can be submitted.');
    }
    const unit = await this.prisma.unit.findUniqueOrThrow({ where: { id: listing.unitId }, include: { building: true } });
    const missing = await this.missing(user, listing, unit.buildingId, unit.building.ownerId);
    if (missing.length) throw apiError(422, 'LISTING_INCOMPLETE', 'This listing is not ready to submit yet.', { missing });

    // The automatic checks decide what happens next (Specification 6.4): green goes live at once, amber goes to a desk
    // review, red waits for a site visit.
    const settings = await this.controls.getCountrySettings(unit.building.countryCode);
    const assessment = await this.checks.assess(listing, unit.buildingId, settings);
    const now = new Date();
    const green = assessment.band === 'GREEN';
    const audit = green && randomInt(0, 10_000) < settings.verification.randomAuditPercent * 100;
    const findings = assessment.checks.filter((c) => c.riskPoints > 0).map((c) => c.summary).join(' ');

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.ListingUpdateManyMutationInput = green
        ? { status: 'LIVE', submittedAt: now, publishedAt: now, lastConfirmedAt: now, expiresAt: addDays(now, settings.listings.confirmAvailabilityDays) }
        : { status: 'IN_REVIEW', submittedAt: now };
      const moved = await tx.listing.updateMany({ where: { id: listing.id, status: listing.status }, data });
      if (moved.count !== 1) throw apiError(409, 'NOT_A_DRAFT', 'This listing has just changed. Please try again.');
      await this.checks.record(tx, listing.id, assessment);
      const task = (type: 'LISTING_REVIEW' | 'SITE_VISIT' | 'RANDOM_AUDIT', notes: string) =>
        tx.reviewTask.create({ data: { type, countryCode: unit.building.countryCode, entityType: 'Listing', entityId: listing.id, notes: notes.slice(0, 1000) } });
      if (assessment.band === 'AMBER') await task('LISTING_REVIEW', `Desk review before the listing goes live. ${findings}`);
      else if (assessment.band === 'RED') await task('SITE_VISIT', `Site visit needed before the listing goes live. ${findings}`);
      else if (audit) await task('RANDOM_AUDIT', 'Random visit of a listing that was approved automatically.');
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'listing.submitted', entityType: 'Listing', entityId: listing.id, metadata: { riskScore: assessment.score, riskBand: assessment.band } },
      });
    });
    if (green) {
      await this.notifications.notify(listing.createdById, 'LISTING_UPDATE', {
        title: 'Your listing is live',
        body: `${listing.title} passed the automatic checks and is now live on FindHouseQuick.`,
        data: { listingId: listing.id },
      });
      await this.alerts.listingWentLive(listing.id);
    }
    return this.ownerView(listing.id);
  }

  /** The lister confirms the home is still available, which restarts the expiry clock (Specification 6.6). */
  async confirmAvailable(user: RequestUser, listingId: string) {
    const listing = await this.findManaged(user, listingId);
    if (listing.status !== 'LIVE' && listing.status !== 'PAUSED') throw apiError(409, 'NOT_LIVE', 'Only a live or paused listing can be confirmed.');
    const days = await this.availabilityDays(listing.unitId);
    const now = new Date();
    await this.prisma.listing.update({ where: { id: listing.id }, data: { lastConfirmedAt: now, expiresAt: addDays(now, days) } });
    return this.ownerView(listing.id);
  }

  async changeStatus(user: RequestUser, listingId: string, dto: ListingStatusDto) {
    const listing = await this.findManaged(user, listingId);
    const now = new Date();
    const allowed: Record<ListingStatusDto['action'], string[]> = {
      PAUSE: ['LIVE'],
      RESUME: ['PAUSED'],
      MARK_RENTED: ['LIVE', 'PAUSED'],
      CLOSE: ['DRAFT', 'LIVE', 'PAUSED', 'REJECTED'],
    };
    if (!allowed[dto.action].includes(listing.status)) {
      throw apiError(409, 'WRONG_STATUS', `A ${listing.status.toLowerCase().replace('_', ' ')} listing cannot do this.`);
    }
    if (dto.rentedToUserId && dto.action !== 'MARK_RENTED') throw apiError(400, 'BAD_REQUEST', 'rentedToUserId goes with MARK_RENTED only.');
    let data: Prisma.ListingUpdateInput;
    if (dto.action === 'PAUSE') data = { status: 'PAUSED' };
    else if (dto.action === 'RESUME') data = { status: 'LIVE', lastConfirmedAt: now, expiresAt: addDays(now, await this.availabilityDays(listing.unitId)) };
    else if (dto.action === 'MARK_RENTED') data = { status: 'RENTED' };
    else data = { status: 'REMOVED' };
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.listing.updateMany({ where: { id: listing.id, status: listing.status }, data: data as Prisma.ListingUpdateManyMutationInput });
      if (moved.count !== 1) throw apiError(409, 'WRONG_STATUS', 'This listing has just changed. Please try again.');
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: dto.action === 'CLOSE' ? 'listing.closed_by_lister' : `listing.${dto.action.toLowerCase()}`,
          entityType: 'Listing',
          entityId: listing.id,
          // The tenant is recorded for the completed rental fee (Release 2).
          metadata: dto.rentedToUserId ? { rentedToUserId: dto.rentedToUserId } : undefined,
        },
      });
    });
    return this.ownerView(listing.id);
  }

  /** Listings for buildings the user owns, registered, or has approved authority for, newest first. */
  async mine(user: RequestUser, q: MyListingsQuery) {
    const rows = await this.prisma.listing.findMany({
      where: {
        ...(q.status ? { status: q.status as Listing['status'] } : {}),
        ...(q.cursor ? { id: { lt: q.cursor } } : {}),
        OR: [
          { createdById: user.id },
          { unit: { building: { ownerId: user.id } } },
          { unit: { building: { createdById: user.id } } },
          { unit: { building: { authorities: { some: { agentId: user.id, ...ACTIVE_AUTHORITY() } } } } },
        ],
      },
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
      select: { id: true },
    });
    const page = rows.slice(0, PAGE_SIZE);
    return { items: await Promise.all(page.map((r) => this.ownerView(r.id))), nextCursor: rows.length > PAGE_SIZE ? page.at(-1)!.id : null };
  }

  /** Marks live listings whose lister did not confirm availability in time as expired. Run hourly. */
  async expireOverdue(): Promise<number> {
    const { count } = await this.prisma.listing.updateMany({ where: { status: 'LIVE', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
    return count;
  }

  /** What the lister sees: the whole listing with its state, costs and photos (only display copies). */
  async ownerView(listingId: string) {
    const l = await this.prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
      include: { unit: { include: { propertyType: true, building: true, parts: { orderBy: { sortOrder: 'asc' } } } } },
    });
    const media = await this.prisma.mediaAsset.findMany({
      where: { unitId: l.unitId, status: { in: ['READY', 'PROCESSING', 'REJECTED'] } },
      include: { unitPart: true },
      orderBy: { capturedAt: 'asc' },
    });
    const items = await Promise.all(media.map((m) => this.media.toItem(m)));
    const byPart = new Map<string, typeof items>();
    for (const it of items) if (it.partCode) byPart.set(it.partCode, [...(byPart.get(it.partCode) ?? []), it]);
    const ready = items.filter((i) => i.status === 'READY');
    const walkthrough = ready.find((i) => i.partCode === 'walkthrough') ?? null;
    const cover = ready.find((i) => i.kind === 'PHOTO' && i.display);
    const money = (minor: bigint) => ({ amountMinor: minor.toString(), currency: l.currency });
    const total = l.rentMinor + l.agencyFeeMinor + l.legalFeeMinor + l.cautionDepositMinor + l.serviceChargeMinor;
    const task = ['IN_REVIEW', 'REJECTED'].includes(l.status)
      ? await this.prisma.reviewTask.findFirst({ where: { type: 'LISTING_REVIEW', entityId: l.id }, orderBy: { createdAt: 'desc' }, select: { status: true, notes: true, outcome: true } })
      : null;
    return {
      id: l.id,
      unitId: l.unitId,
      kind: l.kind,
      status: l.status,
      title: l.title,
      description: l.description,
      propertyTypeLabel: l.unit.propertyType.label,
      bedrooms: l.unit.bedrooms,
      bathrooms: l.unit.bathrooms,
      toilets: l.unit.toilets,
      area: l.unit.building.area,
      rent: money(l.rentMinor),
      rentPeriod: l.rentPeriod,
      moveInCost: {
        rent: money(l.rentMinor),
        agencyFee: money(l.agencyFeeMinor),
        legalFee: money(l.legalFeeMinor),
        cautionDeposit: money(l.cautionDepositMinor),
        serviceCharge: money(l.serviceChargeMinor),
        total: money(total),
        inspectionFee: 'FREE',
      },
      serviceChargeCovers: l.serviceChargeCovers,
      availableFrom: l.availableFrom ? l.availableFrom.toISOString().slice(0, 10) : null,
      minTermMonths: l.minTermMonths,
      maxTermMonths: l.maxTermMonths,
      occupancyRules: l.occupancyRules,
      coverImage: cover?.display ? (cover.display as Record<string, unknown>).medium ?? null : null,
      photosTakenAt: ready.length ? ready.map((i) => i.capturedAt).sort((a, b) => +a - +b)[0] : null,
      gallery: l.unit.parts
        .filter((p) => p.mediaKind === 'PHOTO')
        .map((p) => ({ partCode: p.code, partLabel: p.label, note: p.note, media: byPart.get(p.code) ?? [] })),
      walkthrough,
      riskBand: l.riskBand,
      review: task ? { status: task.status, outcome: task.outcome, notes: task.status === 'DONE' ? task.notes : null } : null,
      submittedAt: l.submittedAt,
      publishedAt: l.publishedAt,
      lastConfirmedAt: l.lastConfirmedAt,
      expiresAt: l.expiresAt,
      createdAt: l.createdAt,
    };
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  /** What still stops the listing being submitted (Specification 6.2). */
  private async missing(user: RequestUser, listing: Listing, buildingId: string, ownerId: string | null): Promise<Missing[]> {
    const missing: Missing[] = [];
    const parts = await this.prisma.unitPart.findMany({
      where: { unitId: listing.unitId, required: true },
      include: { _count: { select: { media: { where: { status: 'READY', removedAt: null } } } } },
      orderBy: { sortOrder: 'asc' },
    });
    for (const p of parts) {
      const need = Math.max(p.minPhotos, 1);
      if (p._count.media >= need) continue;
      if (p.mediaKind === 'VIDEO') missing.push({ kind: 'WALKTHROUGH', partCode: p.code, message: `${p.label} is needed.` });
      else missing.push({ kind: 'PART_MEDIA', partCode: p.code, message: `${p.label} needs ${need} photo${need === 1 ? '' : 's'}; it has ${p._count.media}.` });
    }
    if (listing.rentMinor <= 0n) missing.push({ kind: 'FEES', message: 'Enter the rent.' });

    if (ownerId === user.id) {
      const doc = await this.prisma.document.findFirst({ where: { buildingId, ownerId: user.id, purpose: 'OWNERSHIP', uploadedAt: { not: null }, deletedAt: null } });
      if (!doc) missing.push({ kind: 'OWNERSHIP_DOCUMENT', message: 'Upload at least one ownership document for this building, such as the Certificate of Occupancy.' });
    } else {
      const authority = await this.prisma.propertyAuthority.findFirst({ where: { buildingId, agentId: user.id, ...ACTIVE_AUTHORITY() } });
      if (!authority) missing.push({ kind: 'AUTHORITY', message: "Your authority from the landlord must be approved before you can submit." });
    }
    return missing;
  }

  /** The listing, if the user may manage its building; otherwise "not found". */
  private async findManaged(user: RequestUser, listingId: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, include: { unit: { select: { buildingId: true } } } });
    if (!listing) throw new NotFoundException('Listing not found.');
    await this.properties.assertMayManage(user, listing.unit.buildingId).catch(() => {
      throw new NotFoundException('Listing not found.');
    });
    return listing;
  }

  private async availabilityDays(unitId: string): Promise<number> {
    const unit = await this.prisma.unit.findUniqueOrThrow({ where: { id: unitId }, include: { building: { select: { countryCode: true } } } });
    return (await this.controls.getCountrySettings(unit.building.countryCode)).listings.confirmAvailabilityDays;
  }

  /** Checks and converts the fields sent into database columns. */
  private fields(dto: ListingFieldsDto, kind: string, currency: string, settings: CountrySettings, current?: Listing) {
    const data: Record<string, unknown> = {};
    const shown = new Set<string>(shownFees(settings).map((f) => f.field));
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.rentPeriod !== undefined) {
      const ok = kind === 'SHORT_LET' ? ['NIGHT', 'WEEK'] : ['YEAR', 'MONTH'];
      if (!ok.includes(dto.rentPeriod)) throw apiError(400, 'BAD_REQUEST', `The rent period for this listing is ${ok.join(' or ').toLowerCase()}.`);
      data.rentPeriod = dto.rentPeriod;
    }
    for (const [field, column] of Object.entries(MONEY_COLUMNS) as [keyof typeof MONEY_COLUMNS, string][]) {
      const value = dto[field] as MoneyDto | undefined;
      if (value === undefined) continue;
      if (value.currency !== currency) throw apiError(400, 'WRONG_CURRENCY', `Amounts for this listing are in ${currency}.`);
      const minor = BigInt(value.amountMinor);
      if (field === 'rent' && minor <= 0n) throw apiError(400, 'BAD_REQUEST', 'The rent must be more than zero.');
      if (field !== 'rent' && minor > 0n && !shown.has(field)) {
        throw apiError(400, 'FEE_NOT_ALLOWED', `${field} is not a fee shown on listings in this country, so it cannot be charged.`);
      }
      data[column] = minor;
    }
    if (dto.serviceChargeCovers !== undefined) data.serviceChargeCovers = dto.serviceChargeCovers || null;
    if (dto.availableFrom !== undefined) data.availableFrom = new Date(`${dto.availableFrom}T00:00:00Z`);
    if (dto.minTermMonths !== undefined) data.minTermMonths = dto.minTermMonths;
    if (dto.maxTermMonths !== undefined) data.maxTermMonths = dto.maxTermMonths;
    const min = (data.minTermMonths as number | undefined) ?? current?.minTermMonths;
    const max = (data.maxTermMonths as number | undefined) ?? current?.maxTermMonths;
    if (min && max && min > max) throw apiError(400, 'BAD_REQUEST', 'The minimum tenancy cannot be longer than the maximum.');
    if (dto.occupancyRules !== undefined) {
      const bad = (dto.occupancyRules.allowed ?? []).filter((a) => !settings.unitDetails.whoMayRent.includes(a));
      if (bad.length) throw apiError(400, 'INVALID_DETAILS', `Not a choice here: ${bad.join(', ')}. Choose from ${settings.unitDetails.whoMayRent.join(', ')}.`);
      data.occupancyRules = dto.occupancyRules as Prisma.InputJsonValue;
    }
    return data as Prisma.ListingUpdateInput;
  }
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}
