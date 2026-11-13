import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { normalizePhone } from '../common/phone.js';
import { ControlsService } from '../controls/controls.service.js';
import type { RequestUser } from '../controls/request-context.js';
import { Prisma, type Inspection } from '../generated/prisma/client.js';
import { SMS_SENDER, type SmsSender } from '../integrations/sms/sms-sender.js';
import { ListingsService } from '../listings/listings.service.js';
import { LiveService } from '../live/live.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { availabilitySchema, freeSlots, localDate, type Availability } from './slots.js';
import { blockBetween } from '../messaging/blocks.js';

const PAGE_SIZE = 20;
const OPEN = ['REQUESTED', 'CONFIRMED'] as const;
export type InspectionAction = 'CONFIRM' | 'RESCHEDULE' | 'CANCEL' | 'COMPLETE' | 'NO_SHOW';

interface Place {
  listingId: string;
  title: string;
  status: string;
  hostId: string;
  countryCode: string;
  timezone: string;
  lat: number;
  lng: number;
  address: string;
}

/**
 * Inspections (Specification 7.2, decision 45): the lister sets the times they are available, the tenant books a
 * free slot, and the lister confirms or proposes another time. Booking is always free. Confirming releases the exact
 * position to the tenant (Specification 4.3).
 */
@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    private readonly listings: ListingsService,
    private readonly live: LiveService,
    private readonly notifications: NotificationsService,
    private readonly reports: ReportsService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  // Availability -----------------------------------------------------------------------------------

  async setAvailability(user: RequestUser, listingId: string, body: unknown) {
    await this.listings.get(user, listingId);
    const parsed = availabilitySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw apiError(400, 'INVALID_AVAILABILITY', 'The times are not valid.', {
        problems: parsed.error.issues.map((i) => `${i.path.join('.') || 'availability'}: ${i.message}`),
      });
    }
    const data = { slotMinutes: parsed.data.slotMinutes, weekly: parsed.data.weekly, blockedDates: parsed.data.blockedDates, updatedById: user.id };
    await this.prisma.inspectionAvailability.upsert({ where: { listingId }, create: { listingId, ...data }, update: data });
    return parsed.data;
  }

  async getAvailability(user: RequestUser, listingId: string): Promise<Availability> {
    await this.listings.get(user, listingId);
    return this.availability(listingId);
  }

  /** Free slots between two local dates, at most 14 days apart. */
  async slots(listingId: string, from: string, to: string) {
    const place = await this.place(listingId);
    if (place.status !== 'LIVE') throw new NotFoundException('Listing not found.');
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (!(days >= 0 && days <= 14)) throw apiError(400, 'BAD_REQUEST', 'to must be on or after from, and at most 14 days later.');
    return this.free(place, from, to);
  }

  // Booking ----------------------------------------------------------------------------------------

  async book(user: RequestUser, listingId: string, scheduledAt: Date, note?: string) {
    const place = await this.place(listingId);
    if (place.status !== 'LIVE') throw new NotFoundException('Listing not found.');
    if (place.hostId === user.id || (await this.listings.mayManage(user, listingId))) {
      throw apiError(400, 'OWN_LISTING', 'You cannot book an inspection of your own listing.');
    }
    // Not between two people where either has blocked the other (decision 88).
    if (await blockBetween(this.prisma, user.id, place.hostId)) throw apiError(403, 'BLOCKED', 'You cannot book an inspection of this listing.');
    const already = await this.prisma.inspection.count({ where: { listingId, tenantId: user.id, status: { in: [...OPEN] } } });
    if (already) throw apiError(409, 'ALREADY_BOOKED', 'You already have an inspection booked for this listing. Reschedule or cancel it instead.');
    await this.assertFree(place, scheduledAt);
    const created = await this.create(() =>
      this.prisma.inspection.create({ data: { listingId, tenantId: user.id, hostId: place.hostId, scheduledAt, note: note?.trim() || null, proposedById: user.id } }),
    );
    await this.announce(created, user.id, 'New inspection request', `A tenant asked to inspect ${place.title} on ${this.when(created.scheduledAt, place.timezone)}.`);
    return this.view(created, user.id, place);
  }

  async mine(user: RequestUser, cursor?: string) {
    const rows = await this.prisma.inspection.findMany({
      where: { OR: [{ tenantId: user.id }, { hostId: user.id }], ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
    });
    const page = rows.slice(0, PAGE_SIZE);
    const items = [];
    for (const i of page) items.push(await this.view(i, user.id));
    return { items, nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1]!.id : null };
  }

  async changeStatus(user: RequestUser, inspectionId: string, action: InspectionAction, scheduledAt?: Date, reason?: string) {
    const i = await this.participantOf(user, inspectionId);
    const place = await this.place(i.listingId);
    const isHost = i.hostId === user.id;
    const now = new Date();
    const isOpen = i.status === 'REQUESTED' || i.status === 'CONFIRMED';
    let data: Prisma.InspectionUncheckedUpdateInput;
    let title: string;
    let body: string;
    const when = () => this.when(scheduledAt ?? i.scheduledAt, place.timezone);

    switch (action) {
      case 'CONFIRM':
        if (i.status !== 'REQUESTED') throw apiError(409, 'WRONG_STATUS', 'Only a requested inspection can be confirmed.');
        // The side that proposed the time waits for the other side to confirm it.
        if ((i.proposedById ?? i.tenantId) === user.id) throw apiError(409, 'NOT_YOURS_TO_CONFIRM', 'The other side confirms the time you proposed.');
        if (i.scheduledAt <= now) throw apiError(409, 'TIME_PASSED', 'This time has passed. Propose another time.');
        data = { status: 'CONFIRMED' };
        title = 'Inspection confirmed';
        body = `Your inspection of ${place.title} on ${when()} is confirmed.`;
        break;
      case 'RESCHEDULE':
        if (!isOpen) throw apiError(409, 'WRONG_STATUS', 'This inspection is closed.');
        if (!scheduledAt) throw apiError(400, 'BAD_REQUEST', 'scheduledAt is needed to reschedule.');
        await this.assertFree(place, scheduledAt);
        data = { status: 'REQUESTED', scheduledAt, proposedById: user.id };
        title = 'New inspection time proposed';
        body = `A new time was proposed for the inspection of ${place.title}: ${when()}. Please confirm it.`;
        break;
      case 'CANCEL':
        if (!isOpen) throw apiError(409, 'WRONG_STATUS', 'This inspection is closed.');
        data = { status: 'CANCELLED', cancelReason: reason?.trim().slice(0, 500) || null, closedById: user.id };
        title = 'Inspection cancelled';
        body = `The inspection of ${place.title} on ${when()} was cancelled.`;
        break;
      case 'COMPLETE':
      case 'NO_SHOW':
        if (i.status !== 'CONFIRMED') throw apiError(409, 'WRONG_STATUS', 'Only a confirmed inspection can be closed this way.');
        if (i.scheduledAt > now) throw apiError(409, 'TOO_EARLY', 'This can be recorded once the inspection time has come.');
        data = { status: action === 'COMPLETE' ? 'COMPLETED' : 'NO_SHOW', closedById: user.id };
        title = action === 'COMPLETE' ? 'Inspection completed' : 'Inspection marked as missed';
        body =
          action === 'COMPLETE'
            ? `The inspection of ${place.title} was marked as done. Tell us how it went.`
            : `The other side said the inspection of ${place.title} did not take place.`;
        break;
    }
    const updated = await this.create(async () => {
      const { count } = await this.prisma.inspection.updateMany({ where: { id: i.id, status: i.status, updatedAt: i.updatedAt }, data: { ...data, updatedAt: now } });
      if (!count) throw apiError(409, 'WRONG_STATUS', 'This inspection has just changed. Please try again.');
      return this.prisma.inspection.findUniqueOrThrow({ where: { id: i.id } });
    });
    await this.prisma.auditLog.create({
      data: { actorId: user.id, action: `inspection.${action.toLowerCase()}`, entityType: 'Inspection', entityId: i.id, metadata: { by: isHost ? 'HOST' : 'TENANT' } },
    });
    await this.announce(updated, user.id, title, body);
    return this.view(updated, user.id, place);
  }

  // Safety and follow-up ---------------------------------------------------------------------------

  /** The tenant sends the address, time and lister's name to someone they trust, by SMS (Specification 7.2). */
  async safetyShare(user: RequestUser, inspectionId: string, contactName: string, contactPhone: string): Promise<void> {
    const i = await this.participantOf(user, inspectionId);
    if (i.tenantId !== user.id) throw new ForbiddenException('Only the tenant can share the inspection details.');
    if (i.status !== 'CONFIRMED') throw apiError(409, 'NOT_CONFIRMED', 'The details can be shared once the inspection is confirmed.');
    const place = await this.place(i.listingId);
    const settings = await this.controls.getCountrySettings(place.countryCode);
    const phone = normalizePhone(contactPhone);
    if (!phone) throw apiError(400, 'INVALID_PHONE', 'That phone number is not valid.');
    const { count } = await this.prisma.inspection.updateMany({
      where: { id: i.id, safetyShareCount: { lt: settings.inspections.maxSafetyShares } },
      data: { safetyShareCount: { increment: 1 } },
    });
    if (!count) throw apiError(429, 'TOO_MANY_SHARES', `The details of one inspection can be sent ${settings.inspections.maxSafetyShares} times.`);
    const [tenant, host] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: i.tenantId }, select: { firstName: true, lastName: true } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: i.hostId }, select: { firstName: true, lastName: true } }),
    ]);
    const text =
      `FindHouseQuick: ${contactName.trim()}, ${tenant.firstName} ${tenant.lastName} is inspecting a property at ${place.address} on ` +
      `${this.when(i.scheduledAt, place.timezone)}, meeting ${host.firstName} ${host.lastName}. Map: ${directions(place)}`;
    await this.sms.send(phone, text);
    // The contact's number is not kept; only that the details were shared.
    await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'inspection.safety_shared', entityType: 'Inspection', entityId: i.id } });
  }

  /**
   * Answers after a completed inspection. The tenant says whether the property matched the listing; either side says
   * whether it led to a rental. A "No" on the match raises the listing's risk score and goes to the team as a report.
   */
  async followUp(user: RequestUser, inspectionId: string, answers: { matchedListing?: boolean; rented?: boolean }) {
    const i = await this.participantOf(user, inspectionId);
    if (i.status !== 'COMPLETED') throw apiError(409, 'NOT_COMPLETED', 'These questions are answered after the inspection is completed.');
    const isTenant = i.tenantId === user.id;
    if (answers.matchedListing !== undefined && !isTenant) throw apiError(400, 'BAD_REQUEST', 'Only the tenant says whether the property matched.');
    const firstMismatch = isTenant && answers.matchedListing === false && i.matchedListing !== false;
    const updated = await this.prisma.inspection.update({
      where: { id: i.id },
      data: {
        ...(answers.matchedListing !== undefined ? { matchedListing: answers.matchedListing } : {}),
        ...(answers.rented !== undefined ? (isTenant ? { tenantSaysRented: answers.rented } : { hostSaysRented: answers.rented }) : {}),
      },
    });
    if (firstMismatch) {
      const place = await this.place(i.listingId);
      const settings = await this.controls.getCountrySettings(place.countryCode);
      await this.prisma.$executeRaw`UPDATE "Listing" SET "riskScore" = COALESCE("riskScore", 0) + ${settings.verification.riskPoints.tenantMismatch} WHERE "id" = ${i.listingId}::uuid`;
      await this.reports.fromInspection(user.id, i.listingId, place.countryCode, i.id);
    }
    return this.view(updated, user.id);
  }

  /** Whether the tenant has an inspection that releases the exact position (confirmed or completed). */
  async releasesLocation(userId: string, listingId: string): Promise<boolean> {
    return (await this.prisma.inspection.count({ where: { listingId, tenantId: userId, status: { in: ['CONFIRMED', 'COMPLETED'] } } })) > 0;
  }

  // Helpers ----------------------------------------------------------------------------------------

  private async participantOf(user: RequestUser, inspectionId: string): Promise<Inspection> {
    const i = await this.prisma.inspection.findUnique({ where: { id: inspectionId } });
    if (!i) throw new NotFoundException('Inspection not found.');
    if (i.tenantId !== user.id && i.hostId !== user.id) throw new ForbiddenException('This inspection is not yours.');
    return i;
  }

  private async availability(listingId: string): Promise<Availability> {
    const row = await this.prisma.inspectionAvailability.findUnique({ where: { listingId } });
    return availabilitySchema.parse(row ? { slotMinutes: row.slotMinutes, weekly: row.weekly, blockedDates: row.blockedDates } : { weekly: [] });
  }

  private async free(place: Place, from: string, to: string) {
    const settings = await this.controls.getCountrySettings(place.countryCode);
    const now = Date.now();
    const notBefore = new Date(now + settings.inspections.minLeadMinutes * 60_000);
    const last = localDate(new Date(now + settings.inspections.maxDaysAhead * 86_400_000), place.timezone);
    const taken = await this.prisma.inspection.findMany({ where: { listingId: place.listingId, status: { in: [...OPEN] }, scheduledAt: { gte: notBefore } }, select: { scheduledAt: true } });
    return freeSlots(await this.availability(place.listingId), from, to > last ? last : to, place.timezone, notBefore, taken.map((t) => t.scheduledAt));
  }

  private async assertFree(place: Place, scheduledAt: Date): Promise<void> {
    const date = localDate(scheduledAt, place.timezone);
    const slots = await this.free(place, date, date);
    if (!slots.some((s) => s.startsAt.getTime() === scheduledAt.getTime())) {
      throw apiError(409, 'SLOT_NOT_FREE', 'That time is not one of the free slots. Please choose another.');
    }
  }

  /** Runs a write that may lose the race for a slot; the database allows one open booking per slot. */
  private async create<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw apiError(409, 'SLOT_NOT_FREE', 'That time has just been taken. Please choose another.');
      }
      throw e;
    }
  }

  private async place(listingId: string): Promise<Place> {
    const [row] = await this.prisma.$queryRaw<(Omit<Place, 'address'> & { houseNumber: string | null; street: string; area: string; city: string })[]>`
      SELECT l."id" AS "listingId", l."title", l."status"::text AS "status", l."createdById" AS "hostId", b."countryCode", co."timezone",
             ST_Y(b."location"::geometry) AS "lat", ST_X(b."location"::geometry) AS "lng", b."houseNumber", b."street", b."area", c."name" AS "city"
      FROM "Listing" l JOIN "Unit" u ON u."id" = l."unitId" JOIN "Building" b ON b."id" = u."buildingId"
        JOIN "City" c ON c."id" = b."cityId" JOIN "Country" co ON co."code" = b."countryCode"
      WHERE l."id" = ${listingId}::uuid`;
    if (!row) throw new NotFoundException('Listing not found.');
    return { ...row, address: [[row.houseNumber, row.street].filter(Boolean).join(' '), row.area, row.city].join(', ') };
  }

  private when(at: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  }

  private async view(i: Inspection, viewerId: string, known?: Place) {
    const place = known ?? (await this.place(i.listingId));
    const isHost = i.hostId === viewerId;
    // The exact position and address are released to the tenant once the inspection is confirmed (Specification 4.3).
    const released = isHost || i.status === 'CONFIRMED' || i.status === 'COMPLETED';
    return {
      id: i.id,
      listingId: i.listingId,
      listingTitle: place.title,
      role: isHost ? 'HOST' : 'TENANT',
      scheduledAt: i.scheduledAt,
      status: i.status,
      /** True when the viewer is the one who must confirm the proposed time. */
      awaitingYou: i.status === 'REQUESTED' && (i.proposedById ?? i.tenantId) !== viewerId,
      note: i.note,
      cancelReason: i.cancelReason,
      exactLocation: released ? { lat: place.lat, lng: place.lng } : null,
      address: released ? place.address : null,
      directionsUrl: released ? directions(place) : null,
      followUp: { matchedListing: isHost ? null : i.matchedListing, rented: isHost ? i.hostSaysRented : i.tenantSaysRented },
    };
  }

  /**
   * Background job, every few minutes: reminds both sides before a confirmed inspection (the country's
   * inspections.reminderHoursBefore), and asks both the follow-up questions after a completed one
   * (inspections.followUpHoursAfter; Specification 14.2). Each is sent once.
   */
  async sendReminders(now = new Date()): Promise<{ reminded: number; asked: number }> {
    let reminded = 0;
    let asked = 0;
    // The longest reminder any country may set, so every candidate is looked at; each is then checked against its own country.
    const soon = await this.prisma.inspection.findMany({
      where: { status: 'CONFIRMED', remindedAt: null, scheduledAt: { gt: now, lte: new Date(now.getTime() + 72 * 3_600_000) } },
      take: 200,
    });
    for (const i of soon) {
      const place = await this.place(i.listingId);
      const { inspections } = await this.controls.getCountrySettings(place.countryCode);
      if (i.scheduledAt.getTime() - now.getTime() > inspections.reminderHoursBefore * 3_600_000) continue;
      const claimed = await this.prisma.inspection.updateMany({ where: { id: i.id, remindedAt: null }, data: { remindedAt: now } });
      if (!claimed.count) continue;
      const body = `Your inspection of ${place.title} is at ${this.when(i.scheduledAt, place.timezone)}.`;
      for (const userId of [i.tenantId, i.hostId]) {
        await this.notifications.notify(userId, 'REMINDER', { title: 'Inspection reminder', body, data: { inspectionId: i.id, listingId: i.listingId } });
      }
      reminded++;
    }
    const done = await this.prisma.inspection.findMany({ where: { status: 'COMPLETED', followUpAskedAt: null, scheduledAt: { lte: now } }, take: 200 });
    for (const i of done) {
      const place = await this.place(i.listingId);
      const { inspections } = await this.controls.getCountrySettings(place.countryCode);
      if (now.getTime() - i.scheduledAt.getTime() < inspections.followUpHoursAfter * 3_600_000) continue;
      const claimed = await this.prisma.inspection.updateMany({ where: { id: i.id, followUpAskedAt: null }, data: { followUpAskedAt: now } });
      if (!claimed.count) continue;
      const data = { inspectionId: i.id, listingId: i.listingId, followUp: 'true' };
      if (i.tenantSaysRented === null) {
        await this.notifications.notify(i.tenantId, 'INSPECTION_UPDATE', { title: 'How was the inspection?', body: `Did ${place.title} match the listing, and did you rent it?`, data });
      }
      if (i.hostSaysRented === null) {
        await this.notifications.notify(i.hostId, 'INSPECTION_UPDATE', { title: 'Was it rented?', body: `Did the inspection of ${place.title} lead to a rental?`, data });
      }
      asked++;
    }
    return { reminded, asked };
  }

  private async announce(i: Inspection, actorId: string, title: string, body: string): Promise<void> {
    const otherId = i.tenantId === actorId ? i.hostId : i.tenantId;
    await this.live.publish([i.tenantId, i.hostId], 'inspection.updated', { inspectionId: i.id, listingId: i.listingId, status: i.status, scheduledAt: i.scheduledAt });
    await this.notifications.notify(otherId, 'INSPECTION_UPDATE', { title, body, data: { inspectionId: i.id, listingId: i.listingId } });
  }
}

/** A link that opens directions in a maps app. It moves to the maps provider adapter when that is built. */
function directions(p: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}
