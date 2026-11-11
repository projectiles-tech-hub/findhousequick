import type { INestApplication } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import { hashPassword } from '../src/accounts/secrets.js';
import { ControlsService } from '../src/controls/controls.service.js';
import type { StaffRole, UserType } from '../src/generated/prisma/client.js';
import type { LogSmsAdapter } from '../src/integrations/sms/log-sms.adapter.js';
import { SMS_SENDER } from '../src/integrations/sms/sms-sender.js';
import { PRIVATE_STORAGE, type PrivateStorage } from '../src/integrations/storage/private-storage.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ScoutsService } from '../src/scouts/scouts.service.js';
import { createTestApp } from './helpers.js';

const PASSWORD = 'a good long password';
/** A spot in Benin City used only by these tests. */
const BASE = { lat: 6.4101, lng: 5.5902 };

describe('Scouts and the referral record (API, step 5a)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: LogSmsAdapter;
  let seq = 0;
  let cityId: string;
  let flatTypeId: string;
  let original: { regionId: string; region: boolean; city: boolean };
  const run = randomUUID().slice(0, 8);

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const newPhone = () => `+234809${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;
  /** A place of its own, a kilometre from the last one. */
  const place = () => ({ lat: BASE.lat + ++seq * 0.01, lng: BASE.lng });

  interface Person {
    id: string;
    token: string;
    phone: string;
  }

  async function person(types: UserType[] = ['TENANT'], staff?: StaffRole[], deviceId?: string): Promise<Person> {
    const phone = newPhone();
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        email: `scout${process.pid}.${seq}.${run}@example.com`,
        emailVerifiedAt: new Date(),
        identityVerifiedAt: new Date(),
        passwordHash: await hashPassword(PASSWORD),
        firstName: 'Efe',
        lastName: `Scout ${seq}`,
        countryCode: 'NG',
        types,
        ...(staff ? { staff: { create: { roles: staff, countryScopes: ['NG'] } } } : {}),
      },
    });
    const login = api().post('/v1/auth/login');
    if (deviceId) void login.set('X-Device-Id', deviceId);
    const res = await login.send({ phone, password: PASSWORD }).expect(200);
    if (staff) await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { twoStepAt: new Date() } });
    return { id: user.id, token: res.body.accessToken, phone };
  }

  /** A scout with a report at a fresh place and its invitation code. */
  async function scoutWithInvitation(deviceId?: string) {
    const scout = await person(['TENANT'], undefined, deviceId);
    await api().post('/v1/me/scout').set(bearer(scout.token)).expect(200);
    const at = place();
    const report = (await api().post('/v1/scout/reports').set(bearer(scout.token)).send({ location: at, description: 'Blue gate opposite the mosque, upstairs flat', landlordName: 'Mr Osagie' }).expect(201)).body;
    const invitation = (await api().post(`/v1/scout/reports/${report.id}/invitations`).set(bearer(scout.token)).expect(201)).body;
    return { scout, at, report, code: invitation.code as string, link: invitation.link as string };
  }

  /** A new landlord who registers through the API with an invitation code, then passes the identity check. */
  async function invitedLandlord(code: string, deviceId?: string): Promise<Person> {
    const phone = newPhone();
    const email = `invited${process.pid}.${seq}.${run}@example.com`;
    await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
    const otp = /\b(\d{6})\b/.exec(sms.messagesTo(phone).at(-1)!.text)![1];
    const register = api().post('/v1/auth/register');
    if (deviceId) void register.set('X-Device-Id', deviceId);
    const res = await register
      .send({ phone, email, signUpWith: 'SMS', otp, password: PASSWORD, firstName: 'Osagie', lastName: 'Owner', countryCode: 'NG', types: ['LANDLORD'], consent: { termsVersion: '2026-10', privacyVersion: '2026-10' }, invitationCode: code })
      .expect(201);
    const id = res.body.user.id as string;
    await prisma.user.update({ where: { id }, data: { emailVerifiedAt: new Date(), identityVerifiedAt: new Date() } });
    return { id, token: res.body.accessToken, phone };
  }

  async function building(owner: Person, at: { lat: number; lng: number }, units = 1) {
    const b = (await api().post('/v1/buildings').set(bearer(owner.token)).send({ cityId, area: 'Ugbowo', street: `Scout Road ${++seq}`, houseNumber: String(seq), location: at, locationAccuracyM: 5 }).expect(201)).body;
    const unitIds: string[] = [];
    for (let i = 1; i <= units; i++) unitIds.push(await addUnit(owner, b.id, `Flat ${i}`));
    return { id: b.id as string, unitIds };
  }
  const addUnit = async (owner: Person, buildingId: string, label: string) =>
    (await api().post(`/v1/buildings/${buildingId}/units`).set(bearer(owner.token)).send({ label, propertyTypeId: flatTypeId, bedrooms: 1, bathrooms: 1, toilets: 1 }).expect(201)).body.id as string;

  const setSwitch = async (on: boolean) => {
    await prisma.featureFlag.update({ where: { key: 'growth.scouts' }, data: { defaultEnabled: on } });
    app.get(ControlsService).invalidate();
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sms = app.get(SMS_SENDER);
    const city = await prisma.city.findFirstOrThrow({ where: { name: 'Benin City' }, include: { region: true } });
    cityId = city.id;
    original = { regionId: city.regionId, region: city.region.enabled, city: city.enabled };
    await prisma.region.update({ where: { id: city.regionId }, data: { enabled: true } });
    await prisma.city.update({ where: { id: cityId }, data: { enabled: true } });
    flatTypeId = (await prisma.propertyType.findFirstOrThrow({ where: { countryCode: 'NG', code: 'flat' } })).id;
    await setSwitch(true);
  });

  afterAll(async () => {
    await prisma.city.update({ where: { id: cityId }, data: { enabled: original.city } });
    await prisma.region.update({ where: { id: original.regionId }, data: { enabled: original.region } });
    await setSwitch(false);
    await app.close();
  });

  it('refuses every scout route while the switch is off', async () => {
    const user = await person();
    await setSwitch(false);
    try {
      await api().post('/v1/me/scout').set(bearer(user.token)).expect(403);
      await api().get('/v1/invitations/ABCDEFGH23').expect(403);
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const otp = /\b(\d{6})\b/.exec(sms.messagesTo(phone).at(-1)!.text)![1];
      const refused = await api()
        .post('/v1/auth/register')
        .send({ phone, email: `off${run}@example.com`, signUpWith: 'SMS', otp, password: PASSWORD, firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['LANDLORD'], consent: { termsVersion: '2026-10', privacyVersion: '2026-10' }, invitationCode: 'ABCDEFGH23' })
        .expect(400);
      expect(refused.body.code).toBe('INVALID_INVITATION');
    } finally {
      await setSwitch(true);
    }
  });

  it('lets a user join, report a vacant property and make an invitation; a place already listed earns nothing', async () => {
    const user = await person();
    await api().get('/v1/me/scout').set(bearer(user.token)).expect(404);
    expect((await api().post('/v1/scout/reports').set(bearer(user.token)).send({ location: place(), description: 'A vacant flat by the junction' }).expect(403)).body.code).toBe('NOT_A_SCOUT');
    expect((await api().post('/v1/me/scout').set(bearer(user.token)).expect(200)).body.status).toBe('ACTIVE');

    const at = place();
    const report = (await api().post('/v1/scout/reports').set(bearer(user.token)).send({ location: at, description: 'A vacant flat by the junction' }).expect(201)).body;
    expect(report).toMatchObject({ alreadyOnPlatform: false, stage: 'REPORTED', location: at });
    const invitation = (await api().post(`/v1/scout/reports/${report.id}/invitations`).set(bearer(user.token)).expect(201)).body;
    expect(invitation.code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(invitation.link).toBe(`http://localhost:3100/invite/${invitation.code.replace('-', '')}`);
    // Only a hash is stored; the code works however it is typed; a new one replaces it.
    expect(await prisma.scoutInvitation.count({ where: { codeHash: invitation.code } })).toBe(0);
    expect((await api().get(`/v1/invitations/${invitation.code.toLowerCase()}`).expect(200)).body).toEqual({ valid: true, invitedBy: 'Efe' });
    const again = (await api().post(`/v1/scout/reports/${report.id}/invitations`).set(bearer(user.token)).expect(201)).body;
    await api().get(`/v1/invitations/${invitation.code}`).expect(404);
    await api().get(`/v1/invitations/${again.code}`).expect(200);
    const mine = (await api().get('/v1/scout/reports').set(bearer(user.token)).expect(200)).body;
    expect(mine.items[0]).toMatchObject({ id: report.id, stage: 'INVITED' });

    // A place that already has a building: recorded, but no invitation and so no reward.
    const landlord = await person(['LANDLORD']);
    const existing = place();
    await building(landlord, existing);
    const dup = (await api().post('/v1/scout/reports').set(bearer(user.token)).send({ location: { lat: existing.lat + 0.0001, lng: existing.lng }, description: 'House with a red roof' }).expect(201)).body;
    expect(dup).toMatchObject({ alreadyOnPlatform: true, stage: 'ALREADY_ON_PLATFORM' });
    expect((await api().post(`/v1/scout/reports/${dup.id}/invitations`).set(bearer(user.token)).expect(409)).body.code).toBe('ALREADY_ON_PLATFORM');
    // Another scout cannot invite for someone else's report.
    const other = await person();
    await api().post('/v1/me/scout').set(bearer(other.token)).expect(200);
    await api().post(`/v1/scout/reports/${report.id}/invitations`).set(bearer(other.token)).expect(403);
  });

  it('links the invited landlord, his building and each of its units to the scout, once', async () => {
    const { scout, at, report, code } = await scoutWithInvitation();
    const landlord = await invitedLandlord(code);
    // The code is used up.
    await api().get(`/v1/invitations/${code}`).expect(404);
    expect((await api().post(`/v1/scout/reports/${report.id}/invitations`).set(bearer(scout.token)).expect(409)).body.code).toBe('INVITATION_USED');
    const pending = (await api().get('/v1/me/scout-invitation').set(bearer(landlord.token)).expect(200)).body;
    expect(pending.invitation).toMatchObject({ invitedBy: 'Efe', reportedPlace: 'Blue gate opposite the mosque, upstairs flat', linkedBuildingId: null });

    // A building somewhere else is not the reported property.
    const elsewhere = await building(landlord, place());
    expect((await api().post('/v1/me/scout-invitation/link').set(bearer(landlord.token)).send({ buildingId: elsewhere.id }).expect(409)).body.code).toBe('NOT_THE_REPORTED_PROPERTY');
    // Nor can someone else confirm for him.
    const b = await building(landlord, { lat: at.lat + 0.0003, lng: at.lng }, 2);
    const stranger = await person(['LANDLORD']);
    await api().post('/v1/me/scout-invitation/link').set(bearer(stranger.token)).send({ buildingId: b.id }).expect(404);

    const linked = (await api().post('/v1/me/scout-invitation/link').set(bearer(landlord.token)).send({ buildingId: b.id }).expect(200)).body;
    expect((await api().post('/v1/me/scout-invitation/link').set(bearer(landlord.token)).send({ buildingId: b.id }).expect(409)).body.code).toBe('ALREADY_LINKED');
    // A unit added later joins the same referral.
    const third = await addUnit(landlord, b.id, 'Flat 3');

    const referrals = (await api().get('/v1/me/scout/referrals').set(bearer(scout.token)).expect(200)).body;
    expect(referrals.items).toHaveLength(1);
    expect(referrals.items[0]).toMatchObject({ id: linked.referralId, property: { area: 'Ugbowo', city: 'Benin City' } });
    expect(referrals.items[0].property.street).toBeUndefined();
    expect(referrals.items[0].landlordId).toBeUndefined();
    expect(referrals.items[0].rewards.map((r: { unitLabel: string; status: string }) => [r.unitLabel, r.status])).toEqual([
      ['Flat 1', 'WAITING_FOR_RENTAL'],
      ['Flat 2', 'WAITING_FOR_RENTAL'],
      ['Flat 3', 'WAITING_FOR_RENTAL'],
    ]);
    expect((await api().get('/v1/scout/reports').set(bearer(scout.token)).expect(200)).body.items[0].stage).toBe('PROPERTY_ADDED');
    // The scout has no rights over the property.
    await api().get(`/v1/buildings/${b.id}`).set(bearer(scout.token)).expect((r) => expect([403, 404]).toContain(r.status));

    // Rewards (the rentals part calls these in Release 2): only the first rental counts; escrow voids only that unit;
    // the amount is the country's reward on the day the fee is received.
    const scouts = app.get(ScoutsService);
    const tenant = await person();
    const [flat1, flat2] = b.unitIds as [string, string];
    expect((await scouts.recordFirstRental(flat1, { throughEscrow: true, tenantId: tenant.id }))!).toMatchObject({ status: 'VOID', voidReason: 'RENTED_THROUGH_ESCROW' });
    expect((await scouts.recordFirstRental(flat2, { throughEscrow: false, tenantId: tenant.id }))!.status).toBe('WAITING_FOR_RENTAL');
    // No reward amount is set for the country yet (open point 16): nothing becomes eligible.
    expect((await scouts.recordFeeReceived(flat2))!.status).toBe('WAITING_FOR_RENTAL');
    const ng = await prisma.country.findUniqueOrThrow({ where: { code: 'NG' } });
    await prisma.country.update({ where: { code: 'NG' }, data: { settings: { ...(ng.settings as object), scouts: { rewardMinor: '500000' } } } });
    app.get(ControlsService).invalidate();
    try {
      expect((await scouts.recordFeeReceived(flat2))!).toMatchObject({ status: 'ELIGIBLE', amountMinor: 500000n, currency: 'NGN' });
      expect((await scouts.recordFeeReceived(third))!.status).toBe('WAITING_FOR_RENTAL');
      // The scout as tenant of the first rental is a conflict.
      expect((await scouts.recordFirstRental(third, { throughEscrow: false, tenantId: scout.id }))!).toMatchObject({ status: 'VOID', voidReason: 'CONFLICT_OF_INTEREST', voidNote: 'SCOUT_IS_TENANT' });
    } finally {
      await prisma.country.update({ where: { code: 'NG' }, data: { settings: ng.settings as object } });
      app.get(ControlsService).invalidate();
    }
    const after = (await api().get('/v1/me/scout/referrals').set(bearer(scout.token)).expect(200)).body.items[0].rewards;
    expect(after.find((r: { unitLabel: string }) => r.unitLabel === 'Flat 2')).toMatchObject({ status: 'ELIGIBLE', amount: { amountMinor: '500000', currency: 'NGN' } });
  });

  it('lets only one referral hold a property when two scouts reported it', async () => {
    const first = await scoutWithInvitation();
    const second = await person();
    await api().post('/v1/me/scout').set(bearer(second.token)).expect(200);
    const report2 = (await api().post('/v1/scout/reports').set(bearer(second.token)).send({ location: { lat: first.at.lat + 0.0002, lng: first.at.lng }, description: 'Same compound, seen from the back' }).expect(201)).body;
    expect(report2.alreadyOnPlatform).toBe(false);
    const code2 = (await api().post(`/v1/scout/reports/${report2.id}/invitations`).set(bearer(second.token)).expect(201)).body.code;
    const landlord = await invitedLandlord(first.code);
    const b = await building(landlord, first.at);
    await api().post('/v1/me/scout-invitation/link').set(bearer(landlord.token)).send({ buildingId: b.id }).expect(200);
    // A second account using the other invitation cannot claim the same building: it is not its owner.
    const impostor = await invitedLandlord(code2);
    await api().post('/v1/me/scout-invitation/link').set(bearer(impostor.token)).send({ buildingId: b.id }).expect(403);
    expect(await prisma.scoutReferral.count({ where: { buildingId: b.id } })).toBe(1);
  });

  it('voids the rewards when scout and landlord share a device, and lets staff put a mistake right', async () => {
    const device = `install-${run}-shared`;
    const { scout, at, code } = await scoutWithInvitation(device);
    const landlord = await invitedLandlord(code, device);
    const b = await building(landlord, at);
    const linked = (await api().post('/v1/me/scout-invitation/link').set(bearer(landlord.token)).send({ buildingId: b.id }).expect(200)).body;
    const mine = (await api().get('/v1/me/scout/referrals').set(bearer(scout.token)).expect(200)).body.items[0];
    expect(mine.rewards[0]).toMatchObject({ status: 'VOID', voidReason: 'CONFLICT_OF_INTEREST' });
    expect(mine.rewards[0].voidNote).toBeUndefined();

    const verifier = await person(['TENANT'], ['VERIFIER']);
    const manager = await person(['TENANT'], ['COUNTRY_MANAGER']);
    const list = (await api().get('/v1/admin/scout-referrals?status=VOID').set(bearer(verifier.token)).expect(200)).body;
    expect(list.items.find((r: { id: string }) => r.id === linked.referralId)).toMatchObject({ scoutId: scout.id, landlordId: landlord.id, rewards: [{ voidNote: 'SHARED_DEVICE' }] });
    const task = await prisma.reviewTask.findFirstOrThrow({ where: { type: 'SCOUT_CONFLICT', entityId: linked.referralId } });
    await api().post(`/v1/admin/review-tasks/${task.id}/decision`).set(bearer(verifier.token)).send({ outcome: 'APPROVE', notes: 'They are neighbours who shared one phone to sign up' }).expect(200);
    expect((await api().get('/v1/me/scout/referrals').set(bearer(scout.token)).expect(200)).body.items[0].rewards[0].status).toBe('WAITING_FOR_RENTAL');

    // Staff can void a referral and suspend a scout; a verifier alone cannot.
    await api().post(`/v1/admin/scout-referrals/${linked.referralId}/void`).set(bearer(verifier.token)).send({ reason: 'Confirmed abuse of the scheme' }).expect(403);
    const voided = (await api().post(`/v1/admin/scout-referrals/${linked.referralId}/void`).set(bearer(manager.token)).send({ reason: 'Confirmed abuse of the scheme' }).expect(200)).body;
    expect(voided.rewards[0]).toMatchObject({ status: 'VOID', voidReason: 'VOIDED_BY_STAFF', voidNote: 'Confirmed abuse of the scheme' });
    await api().post(`/v1/admin/scouts/${scout.id}/status`).set(bearer(manager.token)).send({ status: 'SUSPENDED', reason: 'Confirmed abuse of the scheme' }).expect(200);
    expect((await api().post('/v1/scout/reports').set(bearer(scout.token)).send({ location: place(), description: 'Another vacant place' }).expect(403)).body.code).toBe('SCOUT_SUSPENDED');
    expect((await api().get('/v1/me/scout').set(bearer(scout.token)).expect(200)).body).toMatchObject({ status: 'SUSPENDED', suspendedReason: 'Confirmed abuse of the scheme' });
  });
  it('takes up to five photos for a report, saved without location details, seen only by the scout and by staff', async () => {
    const { scout, report } = await scoutWithInvitation();
    const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#7a9' } }).png().toBuffer();
    const describe = (b: Buffer, contentType = 'image/png') => ({ contentType, sizeBytes: b.length, sha256: createHash('sha256').update(b).digest('hex') });
    const send = async (b: Buffer, as = describe(b)) => {
      const start = (await api().post(`/v1/scout/reports/${report.id}/photos`).set(bearer(scout.token)).send(as).expect(201)).body;
      await api().put(new URL(start.upload.url).pathname).set(start.upload.headers).send(b).expect(200);
      return start.photoId as string;
    };

    const first = await send(png);
    await api().post(`/v1/scout/reports/${report.id}/photos/${first}/complete`).set(bearer(scout.token)).expect(200);
    await api().post(`/v1/scout/reports/${report.id}/photos/${first}/complete`).set(bearer(scout.token)).expect(200);
    // Saved again as a JPEG, which drops whatever the camera wrote into the file.
    const row = await prisma.scoutReportPhoto.findUniqueOrThrow({ where: { id: first } });
    expect(row.contentType).toBe('image/jpeg');
    const stored = await app.get<PrivateStorage>(PRIVATE_STORAGE).read(row.storageKey);
    expect(stored.subarray(0, 2).toString('hex')).toBe('ffd8');
    expect((await sharp(stored).metadata()).exif).toBeUndefined();

    // A file that is not a photo is refused and removed.
    const text = Buffer.from('this is not a photo at all');
    const bad = await send(text, describe(text, 'image/jpeg'));
    expect((await api().post(`/v1/scout/reports/${report.id}/photos/${bad}/complete`).set(bearer(scout.token)).expect(400)).body.code).toBe('NOT_A_PHOTO');
    expect(await prisma.scoutReportPhoto.count({ where: { id: bad } })).toBe(0);
    await api().post(`/v1/scout/reports/${report.id}/photos`).set(bearer(scout.token)).send({ ...describe(png), sizeBytes: 11 * 1024 * 1024 }).expect(400);

    expect((await api().get('/v1/scout/reports').set(bearer(scout.token)).expect(200)).body.items[0].photoCount).toBe(1);
    const mine = (await api().get(`/v1/scout/reports/${report.id}/photos`).set(bearer(scout.token)).expect(200)).body;
    expect(mine.items).toHaveLength(1);
    const other = await person();
    await api().post('/v1/me/scout').set(bearer(other.token)).expect(200);
    await api().get(`/v1/scout/reports/${report.id}/photos`).set(bearer(other.token)).expect(403);
    await api().post(`/v1/scout/reports/${report.id}/photos`).set(bearer(other.token)).send(describe(png)).expect(403);
    const verifier = await person(['TENANT'], ['VERIFIER']);
    expect((await api().get(`/v1/admin/scout-reports/${report.id}/photos`).set(bearer(verifier.token)).expect(200)).body.items).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: 'scout.report_photos_viewed', entityId: report.id, actorId: verifier.id } })).toBe(1);

    // Five photos at most.
    for (let i = 0; i < 4; i++) await send(png);
    expect((await api().post(`/v1/scout/reports/${report.id}/photos`).set(bearer(scout.token)).send(describe(png)).expect(409)).body.code).toBe('TOO_MANY_PHOTOS');
  });

  it('remembers confirmed contacts as hashes, and finds a number the scout and the landlord both once confirmed', async () => {
    const { scout, at, code } = await scoutWithInvitation();
    const landlord = await invitedLandlord(code);
    // Registering confirmed the landlord's phone number: remembered as a hash, never as the number.
    const remembered = await prisma.confirmedContact.findMany({ where: { userId: landlord.id } });
    expect(remembered).toHaveLength(1);
    expect(remembered[0]).toMatchObject({ channel: 'SMS' });
    expect(remembered[0]!.valueHash).not.toContain(landlord.phone.slice(-6));
    // The scout once confirmed that same number on his own account, before changing to another.
    await prisma.confirmedContact.create({ data: { userId: scout.id, channel: 'SMS', valueHash: remembered[0]!.valueHash } });
    const b = await building(landlord, at);
    await api().post('/v1/me/scout-invitation/link').set(bearer(landlord.token)).send({ buildingId: b.id }).expect(200);
    const line = await prisma.scoutRewardLine.findUniqueOrThrow({ where: { unitId: b.unitIds[0]! } });
    expect(line).toMatchObject({ status: 'VOID', voidReason: 'CONFLICT_OF_INTEREST', voidNote: 'SHARED_PHONE' });
  });
});
