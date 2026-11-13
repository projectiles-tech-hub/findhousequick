import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { hashPassword } from '../src/accounts/secrets.js';
import { uuidv7 } from '../src/common/ids.js';
import type { StaffRole, UserType } from '../src/generated/prisma/client.js';
import { freeSlots, availabilitySchema, localDate } from '../src/inspections/slots.js';
import type { LogSmsAdapter } from '../src/integrations/sms/log-sms.adapter.js';
import { SMS_SENDER } from '../src/integrations/sms/sms-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InspectionsService } from '../src/inspections/inspections.service.js';
import { createTestApp } from './helpers.js';

const PASSWORD = 'a good long password';
/** A spot in Benin City used only by these tests. */
const BASE = { lat: 6.2901, lng: 5.6702 };
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, from: '08:00', to: '18:00' }));

describe('Inspections, reports and enforcement (API, step 5 part 4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: LogSmsAdapter;
  let seq = 0;
  let cityId: string;
  let flatType: string;
  let original: { regionId: string; region: boolean; city: boolean };
  const run = randomUUID().slice(0, 8);

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  interface Person {
    id: string;
    token: string;
    phone: string;
  }

  async function person(types: UserType[] = ['TENANT'], staff?: StaffRole[]): Promise<Person> {
    const phone = `+234808${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        email: `insp${process.pid}.${seq}.${run}@example.com`,
        emailVerifiedAt: new Date(),
        identityVerifiedAt: new Date(),
        passwordHash: await hashPassword(PASSWORD),
        firstName: 'Itohan',
        lastName: `Visit ${seq}`,
        countryCode: 'NG',
        types,
        ...(staff ? { staff: { create: { roles: staff, countryScopes: ['NG'] } } } : {}),
      },
    });
    const res = await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
    if (staff) await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { twoStepAt: new Date() } });
    return { id: user.id, token: res.body.accessToken, phone };
  }

  async function liveListing(owner: Person) {
    const buildingId = uuidv7();
    const where = { lat: BASE.lat + ++seq * 0.003, lng: BASE.lng };
    await prisma.$executeRaw`
      INSERT INTO "Building" ("id", "countryCode", "cityId", "area", "street", "houseNumber", "addressKey", "location", "ownerId", "createdById", "updatedAt")
      VALUES (${buildingId}::uuid, 'NG', ${cityId}::uuid, 'Ekosodin', ${`Visit Street ${seq}`}, '12', ${`i${run}${seq}`},
        ST_SetSRID(ST_MakePoint(${where.lng}, ${where.lat}), 4326)::geography, ${owner.id}::uuid, ${owner.id}::uuid, now())`;
    const unit = await prisma.unit.create({ data: { buildingId, label: 'Flat 1', propertyTypeId: flatType, bedrooms: 2, bathrooms: 1, toilets: 1 } });
    const listing = await prisma.listing.create({
      data: {
        unitId: unit.id,
        kind: 'LONG_TERM',
        status: 'LIVE',
        title: `Visit home ${seq}`,
        description: 'A home used by the inspection tests, with enough words to pass.',
        currency: 'NGN',
        rentMinor: 70_000_000n,
        rentPeriod: 'YEAR',
        publishedAt: new Date(),
        createdById: owner.id,
      },
    });
    return { ...listing, where };
  }

  /** A listing open for inspections every day, and its first free slots. */
  async function bookable() {
    const lister = await person(['LANDLORD']);
    const listing = await liveListing(lister);
    await api().put(`/v1/listings/${listing.id}/inspection-availability`).set(bearer(lister.token)).send({ slotMinutes: 60, weekly: EVERY_DAY }).expect(200);
    const from = localDate(new Date(), 'Africa/Lagos');
    const to = localDate(new Date(Date.now() + 3 * 86_400_000), 'Africa/Lagos');
    const slots = (await api().get(`/v1/listings/${listing.id}/inspection-slots?from=${from}&to=${to}`).set(bearer(lister.token)).expect(200)).body as { startsAt: string }[];
    return { lister, listing, slots, from, to };
  }

  const status = (p: Person, id: string, body: Record<string, unknown>) => api().post(`/v1/inspections/${id}/status`).set(bearer(p.token)).send(body);
  const decide = (staff: Person, taskId: string, body: Record<string, unknown>) =>
    api().post(`/v1/admin/review-tasks/${taskId}/decision`).set(bearer(staff.token)).send({ notes: 'Checked by the team', ...body });

  /** A confirmed inspection whose time has come, so it can be completed. */
  async function confirmedAndDue() {
    const { lister, listing, slots } = await bookable();
    const tenant = await person();
    const booked = (await api().post(`/v1/listings/${listing.id}/inspections`).set(bearer(tenant.token)).send({ scheduledAt: slots[0]!.startsAt }).expect(201)).body;
    await status(lister, booked.id, { action: 'CONFIRM' }).expect(200);
    await prisma.inspection.update({ where: { id: booked.id }, data: { scheduledAt: new Date(Date.now() - 3_600_000) } });
    return { lister, tenant, listing, inspectionId: booked.id as string };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sms = app.get(SMS_SENDER);
    const city = await prisma.city.findFirstOrThrow({ where: { name: 'Benin City' }, include: { region: true } });
    cityId = city.id;
    original = { regionId: city.regionId, region: city.region.enabled, city: city.enabled };
    await prisma.region.update({ where: { id: city.regionId }, data: { enabled: true } });
    await prisma.city.update({ where: { id: cityId }, data: { enabled: true } });
    flatType = (await prisma.propertyType.findFirstOrThrow({ where: { countryCode: 'NG', code: 'flat' } })).id;
  });

  afterAll(async () => {
    await prisma.city.update({ where: { id: cityId }, data: { enabled: original.city } });
    await prisma.region.update({ where: { id: original.regionId }, data: { enabled: original.region } });
    await app.close();
  });

  describe('inspections', () => {
    it('offers the free slots of the times the lister set, and only the lister sets them', async () => {
      const { lister, listing, slots, from, to } = await bookable();
      expect(slots.length).toBeGreaterThan(10);
      // Nothing sooner than the notice period (2 hours), all on the hour, in order.
      expect(new Date(slots[0]!.startsAt).getTime()).toBeGreaterThan(Date.now() + 119 * 60_000);
      expect(slots.every((s) => new Date(s.startsAt).getUTCMinutes() === 0)).toBe(true);
      const expected = freeSlots(availabilitySchema.parse({ slotMinutes: 60, weekly: EVERY_DAY }), from, to, 'Africa/Lagos', new Date(Date.now() + 120 * 60_000), []);
      expect(slots.length).toBe(expected.length);

      const tenant = await person();
      await api().put(`/v1/listings/${listing.id}/inspection-availability`).set(bearer(tenant.token)).send({ weekly: EVERY_DAY }).expect(404);
      const bad = await api().put(`/v1/listings/${listing.id}/inspection-availability`).set(bearer(lister.token)).send({ weekly: [{ weekday: 1, from: '18:00', to: '08:00' }] }).expect(400);
      expect(bad.body.code).toBe('INVALID_AVAILABILITY');
      await api().get(`/v1/listings/${listing.id}/inspection-slots?from=${from}&to=2099-01-01`).set(bearer(tenant.token)).expect(400);
    });

    it('books a free slot once, and releases the exact position only when the lister confirms', async () => {
      const { lister, listing, slots } = await bookable();
      const tenant = await person();
      const other = await person();
      const at = slots[2]!.startsAt;
      await api().post(`/v1/listings/${listing.id}/inspections`).set(bearer(tenant.token)).send({ scheduledAt: new Date(new Date(at).getTime() + 60_000).toISOString() }).expect(409);
      const booked = (await api().post(`/v1/listings/${listing.id}/inspections`).set(bearer(tenant.token)).send({ scheduledAt: at, note: 'I will come with my wife' }).expect(201)).body;
      expect(booked).toMatchObject({ status: 'REQUESTED', role: 'TENANT', awaitingYou: false, exactLocation: null, address: null, directionsUrl: null });

      // The slot is taken; the same tenant cannot book twice; the lister cannot book his own listing.
      expect((await api().post(`/v1/listings/${listing.id}/inspections`).set(bearer(other.token)).send({ scheduledAt: at }).expect(409)).body.code).toBe('SLOT_NOT_FREE');
      expect((await api().post(`/v1/listings/${listing.id}/inspections`).set(bearer(tenant.token)).send({ scheduledAt: slots[3]!.startsAt }).expect(409)).body.code).toBe('ALREADY_BOOKED');
      expect((await api().post(`/v1/listings/${listing.id}/inspections`).set(bearer(lister.token)).send({ scheduledAt: slots[3]!.startsAt }).expect(400)).body.code).toBe('OWN_LISTING');
      const page = (await api().get(`/v1/listings/${listing.id}`).set(bearer(tenant.token)).expect(200)).body;
      expect(page.exactLocation).toBeNull();

      // The tenant proposed the time, so the lister confirms it.
      expect((await status(tenant, booked.id, { action: 'CONFIRM' }).expect(409)).body.code).toBe('NOT_YOURS_TO_CONFIRM');
      await status(other, booked.id, { action: 'CONFIRM' }).expect(403);
      const hosting = (await api().get('/v1/me/inspections').set(bearer(lister.token)).expect(200)).body;
      expect(hosting.items[0]).toMatchObject({ id: booked.id, role: 'HOST', awaitingYou: true, note: 'I will come with my wife' });
      const confirmed = (await status(lister, booked.id, { action: 'CONFIRM' }).expect(200)).body;
      expect(confirmed.status).toBe('CONFIRMED');

      const mine = (await api().get('/v1/me/inspections').set(bearer(tenant.token)).expect(200)).body.items[0];
      expect(mine.exactLocation.lat).toBeCloseTo(listing.where.lat, 5);
      expect(mine.address).toMatch(/^12 Visit Street \d+, Ekosodin, Benin City$/);
      expect(mine.directionsUrl).toContain(`${mine.exactLocation.lat},${mine.exactLocation.lng}`);
      const after = (await api().get(`/v1/listings/${listing.id}`).set(bearer(tenant.token)).expect(200)).body;
      expect(after.exactLocation.lng).toBeCloseTo(listing.where.lng, 5);
      expect((await api().get(`/v1/listings/${listing.id}`).set(bearer(other.token)).expect(200)).body.exactLocation).toBeNull();
    });

    it('lets the lister propose another time for the tenant to confirm, and either side cancel', async () => {
      const { lister, listing, slots } = await bookable();
      const tenant = await person();
      const booked = (await api().post(`/v1/listings/${listing.id}/inspections`).set(bearer(tenant.token)).send({ scheduledAt: slots[1]!.startsAt }).expect(201)).body;
      await status(lister, booked.id, { action: 'RESCHEDULE' }).expect(400);
      const moved = (await status(lister, booked.id, { action: 'RESCHEDULE', scheduledAt: slots[4]!.startsAt }).expect(200)).body;
      expect(moved).toMatchObject({ status: 'REQUESTED', awaitingYou: false, scheduledAt: slots[4]!.startsAt });
      expect((await status(lister, booked.id, { action: 'CONFIRM' }).expect(409)).body.code).toBe('NOT_YOURS_TO_CONFIRM');
      expect((await status(tenant, booked.id, { action: 'CONFIRM' }).expect(200)).body.status).toBe('CONFIRMED');
      // Too early to say it happened.
      expect((await status(lister, booked.id, { action: 'COMPLETE' }).expect(409)).body.code).toBe('TOO_EARLY');
      const cancelled = (await status(tenant, booked.id, { action: 'CANCEL', reason: 'I found another place' }).expect(200)).body;
      expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelReason: 'I found another place' });
      await status(lister, booked.id, { action: 'CONFIRM' }).expect(409);
      // The slot is free again.
      await api().post(`/v1/listings/${listing.id}/inspections`).set(bearer(tenant.token)).send({ scheduledAt: slots[4]!.startsAt }).expect(201);
    });

    it('sends the details to a trusted contact a limited number of times, once confirmed', async () => {
      const { lister, listing, slots } = await bookable();
      const tenant = await person();
      const booked = (await api().post(`/v1/listings/${listing.id}/inspections`).set(bearer(tenant.token)).send({ scheduledAt: slots[0]!.startsAt }).expect(201)).body;
      const contact = { contactName: 'Mama Itohan', contactPhone: '+2348031234567' };
      expect((await api().post(`/v1/inspections/${booked.id}/safety-share`).set(bearer(tenant.token)).send(contact).expect(409)).body.code).toBe('NOT_CONFIRMED');
      await status(lister, booked.id, { action: 'CONFIRM' }).expect(200);
      await api().post(`/v1/inspections/${booked.id}/safety-share`).set(bearer(lister.token)).send(contact).expect(403);
      await api().post(`/v1/inspections/${booked.id}/safety-share`).set(bearer(tenant.token)).send(contact).expect(202);
      const text = sms.messagesTo('+2348031234567').at(-1)!.text;
      expect(text).toMatch(/Mama Itohan, Itohan Visit \d+ is inspecting a property at 12 Visit Street \d+, Ekosodin, Benin City/);
      expect(text).toContain('meeting Itohan Visit');
      await api().post(`/v1/inspections/${booked.id}/safety-share`).set(bearer(tenant.token)).send(contact).expect(202);
      await api().post(`/v1/inspections/${booked.id}/safety-share`).set(bearer(tenant.token)).send(contact).expect(202);
      expect((await api().post(`/v1/inspections/${booked.id}/safety-share`).set(bearer(tenant.token)).send(contact).expect(429)).body.code).toBe('TOO_MANY_SHARES');
    });

    it('records the follow-up, and a "did not match" answer reaches the team and raises the risk score', async () => {
      const { lister, tenant, listing, inspectionId } = await confirmedAndDue();
      expect((await api().post(`/v1/inspections/${inspectionId}/follow-up`).set(bearer(tenant.token)).send({ matchedListing: true }).expect(409)).body.code).toBe('NOT_COMPLETED');
      expect((await status(lister, inspectionId, { action: 'COMPLETE' }).expect(200)).body.status).toBe('COMPLETED');
      await api().post(`/v1/inspections/${inspectionId}/follow-up`).set(bearer(lister.token)).send({ matchedListing: false }).expect(400);
      const hostAnswer = (await api().post(`/v1/inspections/${inspectionId}/follow-up`).set(bearer(lister.token)).send({ rented: false }).expect(200)).body;
      expect(hostAnswer.followUp).toEqual({ matchedListing: null, rented: false });
      const answer = (await api().post(`/v1/inspections/${inspectionId}/follow-up`).set(bearer(tenant.token)).send({ matchedListing: false, rented: false }).expect(200)).body;
      expect(answer.followUp).toEqual({ matchedListing: false, rented: false });
      // Answering again does not report twice.
      await api().post(`/v1/inspections/${inspectionId}/follow-up`).set(bearer(tenant.token)).send({ matchedListing: false }).expect(200);
      const reports = await prisma.listingReport.findMany({ where: { listingId: listing.id } });
      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({ reason: 'DOES_NOT_MATCH', reporterId: tenant.id });
      expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).riskScore).toBe(20);
      expect(await prisma.reviewTask.count({ where: { type: 'REPORT', entityId: reports[0]!.id } })).toBe(1);
    });
  });

  describe('reminders and follow-up questions', () => {
    it('reminds both sides once before a confirmed inspection, and asks the follow-up questions once after a completed one', async () => {
      const due = await confirmedAndDue();
      const soon = await confirmedAndDue();
      const later = await confirmedAndDue();
      const now = Date.now();
      await prisma.inspection.update({ where: { id: soon.inspectionId }, data: { scheduledAt: new Date(now + 2 * 3_600_000) } });
      await prisma.inspection.update({ where: { id: later.inspectionId }, data: { scheduledAt: new Date(now + 10 * 3_600_000) } });
      await status(due.lister, due.inspectionId, { action: 'COMPLETE' }).expect(200);
      await prisma.inspection.update({ where: { id: due.inspectionId }, data: { scheduledAt: new Date(now - 3 * 3_600_000) } });

      const jobs = app.get(InspectionsService);
      await jobs.sendReminders();
      const rows = async () =>
        Object.fromEntries(
          (await prisma.inspection.findMany({ where: { id: { in: [due.inspectionId, soon.inspectionId, later.inspectionId] } } })).map((r) => [r.id, r]),
        );
      let r = await rows();
      expect(r[soon.inspectionId]!.remindedAt).not.toBeNull();
      expect(r[later.inspectionId]!.remindedAt).toBeNull();
      expect(r[due.inspectionId]!.followUpAskedAt).not.toBeNull();
      const first = r[soon.inspectionId]!.remindedAt!.getTime();

      await jobs.sendReminders();
      r = await rows();
      expect(r[soon.inspectionId]!.remindedAt!.getTime()).toBe(first);
    });
  });

  describe('reports and enforcement', () => {
    async function reported(reason = 'INSPECTION_FEE_DEMANDED') {
      const lister = await person(['LANDLORD']);
      const listing = await liveListing(lister);
      const reporter = await person();
      const report = (await api().post(`/v1/listings/${listing.id}/reports`).set(bearer(reporter.token)).send({ reason, details: 'He asked for 5,000 naira to view it.' }).expect(201)).body;
      const task = await prisma.reviewTask.findFirstOrThrow({ where: { type: 'REPORT', entityId: report.id } });
      return { lister, listing, reporter, report, task };
    }

    it('takes a report once per user, and not about your own listing', async () => {
      const { lister, listing, reporter } = await reported();
      expect((await api().post(`/v1/listings/${listing.id}/reports`).set(bearer(reporter.token)).send({ reason: 'FAKE_LISTING' }).expect(409)).body.code).toBe('ALREADY_REPORTED');
      expect((await api().post(`/v1/listings/${listing.id}/reports`).set(bearer(lister.token)).send({ reason: 'OTHER' }).expect(400)).body.code).toBe('OWN_LISTING');
      await api().post(`/v1/listings/${listing.id}/reports`).set(bearer(reporter.token)).send({ reason: 'NOT_A_REASON' }).expect(400);
    });

    it('warns, then removes the badge, each recorded against the lister, and can take the listing down', async () => {
      const verifier = await person(['TENANT'], ['VERIFIER']);
      const first = await reported();
      const queue = (await api().get('/v1/admin/review-tasks?type=REPORT').set(bearer(verifier.token)).expect(200)).body;
      expect(queue.items.find((t: { id: string }) => t.id === first.task.id).details).toMatchObject({ reason: 'INSPECTION_FEE_DEMANDED', listerId: first.lister.id, earlierSanctions: [] });
      expect((await decide(verifier, first.task.id, { outcome: 'APPROVE' }).expect(400)).body.code).toBe('OUTCOME_NOT_SUPPORTED');
      await decide(verifier, first.task.id, { outcome: 'WARN_USER' }).expect(200);
      expect(await prisma.enforcementAction.findMany({ where: { userId: first.lister.id } })).toMatchObject([{ kind: 'WARNING', staffId: verifier.id, reason: 'Checked by the team' }]);
      expect((await prisma.listing.findUniqueOrThrow({ where: { id: first.listing.id } })).status).toBe('LIVE');
      expect((await prisma.listingReport.findUniqueOrThrow({ where: { id: first.report.id } })).status).toBe('DONE');

      // A second report: the badge goes, and this time the listing is taken down.
      const again = await person();
      const second = (await api().post(`/v1/listings/${first.listing.id}/reports`).set(bearer(again.token)).send({ reason: 'FAKE_LISTING' }).expect(201)).body;
      const before = (await api().get(`/v1/listings/${first.listing.id}`).set(bearer(again.token)).expect(200)).body;
      expect(before).toMatchObject({ badges: ['OWNER_VERIFIED'], lister: { verified: true } });
      const other = await liveListing(first.lister);
      const task = await prisma.reviewTask.findFirstOrThrow({ where: { type: 'REPORT', entityId: second.id } });
      await decide(verifier, task.id, { outcome: 'REMOVE_BADGE', removeListing: true }).expect(200);
      expect((await prisma.listing.findUniqueOrThrow({ where: { id: first.listing.id } })).status).toBe('REMOVED');
      const page = (await api().get(`/v1/listings/${other.id}`).set(bearer(again.token)).expect(200)).body;
      expect(page).toMatchObject({ badges: [], lister: { verified: false } });
      // The lister can still sign in and use the account.
      await api().get('/v1/me').set(bearer(first.lister.token)).expect(200);
    });

    it('suspends: the account is signed out and its listings paused; a ban removes them and blocks the ID', async () => {
      const verifier = await person(['TENANT'], ['VERIFIER']);
      const s = await reported('EXTRA_FEES_DEMANDED');
      await decide(verifier, s.task.id, { outcome: 'SUSPEND_USER' }).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: s.lister.id } })).status).toBe('SUSPENDED');
      expect((await prisma.listing.findUniqueOrThrow({ where: { id: s.listing.id } })).status).toBe('PAUSED');
      await api().get('/v1/me').set(bearer(s.lister.token)).expect((r) => expect([401, 403]).toContain(r.status));

      const b = await reported('FAKE_LISTING');
      // The lister's verified ID, as the identity check stored it.
      await prisma.identityVerification.create({
        data: { userId: b.lister.id, provider: 'test', idType: 'NIN', idNumberEncrypted: 'x', idNumberLast4: '0001', idNumberHash: `hash-${run}`, status: 'PASSED', completedAt: new Date() },
      });
      await decide(verifier, b.task.id, { outcome: 'BAN_USER' }).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: b.lister.id } })).status).toBe('BANNED');
      expect((await prisma.listing.findUniqueOrThrow({ where: { id: b.listing.id } })).status).toBe('REMOVED');
      expect(await prisma.enforcementAction.findFirstOrThrow({ where: { userId: b.lister.id } })).toMatchObject({ kind: 'BAN', idType: 'NIN', idNumberHash: `hash-${run}` });
      expect(await prisma.refreshToken.count({ where: { userId: b.lister.id, revokedAt: null } })).toBe(0);
    });

    it('does not let staff decide a report about themselves, or sanction a staff account', async () => {
      const verifier = await person(['LANDLORD'], ['VERIFIER']);
      const listing = await liveListing(verifier);
      const reporter = await person();
      const report = (await api().post(`/v1/listings/${listing.id}/reports`).set(bearer(reporter.token)).send({ reason: 'OTHER' }).expect(201)).body;
      const task = await prisma.reviewTask.findFirstOrThrow({ where: { type: 'REPORT', entityId: report.id } });
      expect((await decide(verifier, task.id, { outcome: 'NO_ACTION' }).expect(403)).body.code).toBe('OWN_CASE');
      const second = await person(['TENANT'], ['VERIFIER']);
      expect((await decide(second, task.id, { outcome: 'BAN_USER' }).expect(409)).body.code).toBe('STAFF_ACCOUNT');
      await decide(second, task.id, { outcome: 'NO_ACTION' }).expect(200);
      expect(await prisma.enforcementAction.count({ where: { userId: verifier.id } })).toBe(0);
    });
  });
});
