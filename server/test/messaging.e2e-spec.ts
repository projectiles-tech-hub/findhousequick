import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { WebSocket } from 'ws';
import { hashPassword } from '../src/accounts/secrets.js';
import { uuidv7 } from '../src/common/ids.js';
import type { UserType } from '../src/generated/prisma/client.js';
import { EMAIL_SENDER } from '../src/integrations/email/email-sender.js';
import type { LogEmailAdapter } from '../src/integrations/email/log-email.adapter.js';
import type { LogPushAdapter } from '../src/integrations/push/log-push.adapter.js';
import { PUSH_SENDER } from '../src/integrations/push/push-sender.js';
import { CallsService } from '../src/messaging/calls.service.js';
import { AlertsService } from '../src/notifications/alerts.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const PASSWORD = 'a good long password';
/** A spot in Benin City used only by these tests. */
const BASE = { lat: 6.3301, lng: 5.6402 };

describe('Messaging, calls and notifications (API, step 5 part 3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let push: LogPushAdapter;
  let mail: LogEmailAdapter;
  let seq = 0;
  let cityId: string;
  let flatType: string;
  const run = randomUUID().slice(0, 8);

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  interface Person {
    id: string;
    token: string;
    phone: string;
    email: string;
  }

  async function person(t: UserType[] = ['TENANT'], o: { identity?: boolean } = {}): Promise<Person> {
    const phone = `+234807${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;
    const email = `msg${process.pid}.${seq}.${run}@example.com`;
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        email,
        emailVerifiedAt: new Date(),
        identityVerifiedAt: o.identity === false ? null : new Date(),
        passwordHash: await hashPassword(PASSWORD),
        firstName: 'Osas',
        lastName: `Chat ${seq}`,
        countryCode: 'NG',
        types: t,
      },
    });
    const res = await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
    return { id: user.id, token: res.body.accessToken, phone, email };
  }

  async function listing(owner: Person, status: 'LIVE' | 'DRAFT' | 'IN_REVIEW' = 'LIVE', where = BASE) {
    const buildingId = uuidv7();
    await prisma.$executeRaw`
      INSERT INTO "Building" ("id", "countryCode", "cityId", "area", "street", "addressKey", "location", "ownerId", "createdById", "updatedAt")
      VALUES (${buildingId}::uuid, 'NG', ${cityId}::uuid, ${`Chatarea${run}`}, ${`Street ${++seq}`}, ${`m${run}${seq}`},
        ST_SetSRID(ST_MakePoint(${where.lng}, ${where.lat}), 4326)::geography, ${owner.id}::uuid, ${owner.id}::uuid, now())`;
    const unit = await prisma.unit.create({ data: { buildingId, label: 'Flat 1', propertyTypeId: flatType, bedrooms: 3, bathrooms: 2, toilets: 2 } });
    return prisma.listing.create({
      data: {
        unitId: unit.id,
        kind: 'LONG_TERM',
        status,
        title: `Chat home ${seq}`,
        description: 'A home used by the messaging tests, with enough words to pass.',
        currency: 'NGN',
        rentMinor: 90_000_000n,
        rentPeriod: 'YEAR',
        publishedAt: new Date(),
        createdById: owner.id,
      },
    });
  }

  async function chat() {
    const lister = await person(['LANDLORD']);
    const tenant = await person();
    const l = await listing(lister);
    const c = (await api().post('/v1/conversations').set(bearer(tenant.token)).send({ listingId: l.id, firstMessage: 'Is it still available?' }).expect(201)).body;
    return { lister, tenant, listing: l, conversation: c };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    push = app.get(PUSH_SENDER);
    mail = app.get(EMAIL_SENDER);
    cityId = (await prisma.city.findFirstOrThrow({ where: { name: 'Benin City' } })).id;
    flatType = (await prisma.propertyType.findFirstOrThrow({ where: { countryCode: 'NG', code: 'flat' } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('conversations', () => {
    it('starts a conversation with a first message, counts unread and marks read', async () => {
      const { lister, tenant, listing: l, conversation } = await chat();
      expect(conversation).toMatchObject({ listingId: l.id, role: 'TENANT', otherParty: { id: lister.id, phone: null }, unreadCount: 0 });
      expect(conversation.lastMessage.body).toBe('Is it still available?');

      // Starting again reopens the same conversation.
      const again = (await api().post('/v1/conversations').set(bearer(tenant.token)).send({ listingId: l.id }).expect(201)).body;
      expect(again.id).toBe(conversation.id);

      const theirs = (await api().get('/v1/conversations').set(bearer(lister.token)).expect(200)).body;
      expect(theirs.items.find((c: { id: string }) => c.id === conversation.id)).toMatchObject({ role: 'LISTER', unreadCount: 1 });
      const messages = (await api().get(`/v1/conversations/${conversation.id}/messages`).set(bearer(lister.token)).expect(200)).body;
      expect(messages.items).toHaveLength(1);
      expect(messages.items[0]).toMatchObject({ senderId: tenant.id, kind: 'TEXT' });
      const after = (await api().get('/v1/conversations').set(bearer(lister.token)).expect(200)).body;
      expect(after.items.find((c: { id: string }) => c.id === conversation.id).unreadCount).toBe(0);
    });

    it('refuses own listings, listings not live, outsiders and accounts without an identity check', async () => {
      const { lister, conversation } = await chat();
      const own = await listing(lister);
      await api().post('/v1/conversations').set(bearer(lister.token)).send({ listingId: own.id }).expect(400);
      const tenant = await person();
      const draft = await listing(lister, 'DRAFT');
      await api().post('/v1/conversations').set(bearer(tenant.token)).send({ listingId: draft.id }).expect(404);
      await api().get(`/v1/conversations/${conversation.id}/messages`).set(bearer(tenant.token)).expect(403);
      await api().post(`/v1/conversations/${conversation.id}/messages`).set(bearer(tenant.token)).send({ body: 'hello' }).expect(403);
      const unchecked = await person(['TENANT'], { identity: false });
      await api().post('/v1/conversations').set(bearer(unchecked.token)).send({ listingId: own.id }).expect(403);
    });

    it('sends messages, warns about contact details, logs the finding and notifies the other side', async () => {
      const { lister, tenant, conversation } = await chat();
      await api().post('/v1/me/devices').set(bearer(lister.token)).send({ platform: 'ANDROID', pushToken: `tok-${run}-${seq}` }).expect(201);
      const plain = (await api().post(`/v1/conversations/${conversation.id}/messages`).set(bearer(tenant.token)).send({ body: 'Can I come on Saturday?' }).expect(201)).body;
      expect(plain.warning).toBeNull();
      expect(push.sent.at(-1)!.message).toMatchObject({ body: 'Can I come on Saturday?', data: { kind: 'NEW_MESSAGE', conversationId: conversation.id } });

      const risky = (await api().post(`/v1/conversations/${conversation.id}/messages`).set(bearer(tenant.token)).send({ body: 'Call me on 0803 123 4567' }).expect(201)).body;
      expect(risky.warning).toMatch(/keep contact and payment on FindHouseQuick/);
      const stored = await prisma.message.findUniqueOrThrow({ where: { id: risky.id } });
      expect(stored.flags).toEqual({ found: ['PHONE_NUMBER', 'OFF_PLATFORM'] });
      expect(await prisma.auditLog.count({ where: { action: 'chat.flagged', entityId: risky.id } })).toBe(1);

      await api().post(`/v1/conversations/${conversation.id}/messages`).set(bearer(tenant.token)).send({ body: '   ' }).expect(400);
    });

    it('shares phone numbers only after an inspection is booked and both sides agree', async () => {
      const { lister, tenant, listing: l, conversation } = await chat();
      const refused = await api().post(`/v1/conversations/${conversation.id}/share-phones`).set(bearer(tenant.token)).expect(409);
      expect(refused.body.code).toBe('INSPECTION_NOT_BOOKED');
      await prisma.inspection.create({ data: { listingId: l.id, tenantId: tenant.id, hostId: lister.id, scheduledAt: new Date(Date.now() + 86_400_000) } });
      const one = (await api().post(`/v1/conversations/${conversation.id}/share-phones`).set(bearer(tenant.token)).expect(200)).body;
      expect(one).toMatchObject({ otherParty: { phone: null }, phoneSharing: { youAgreed: true, theyAgreed: false, shared: false } });
      const both = (await api().post(`/v1/conversations/${conversation.id}/share-phones`).set(bearer(lister.token)).expect(200)).body;
      expect(both).toMatchObject({ otherParty: { phone: tenant.phone }, phoneSharing: { shared: true } });
      const tenantView = (await api().get('/v1/conversations').set(bearer(tenant.token)).expect(200)).body;
      expect(tenantView.items.find((c: { id: string }) => c.id === conversation.id).otherParty.phone).toBe(lister.phone);
    });
  });

  describe('calls', () => {
    it('rings, answers and ends a call, leaving a line in the chat', async () => {
      const { lister, tenant, conversation } = await chat();
      await api().post('/v1/me/devices').set(bearer(lister.token)).send({ platform: 'IOS', pushToken: `ios-${run}-${seq}`, voipPushToken: `voip-${run}` }).expect(201);
      const call = (await api().post(`/v1/conversations/${conversation.id}/calls`).set(bearer(tenant.token)).expect(201)).body;
      expect(call).toMatchObject({ status: 'RINGING', callerId: tenant.id, connection: { provider: 'test', userId: tenant.id } });
      expect(push.sent.at(-1)!.message).toMatchObject({ urgent: true, data: { kind: 'INCOMING_CALL', callId: call.id } });
      expect((await api().post(`/v1/conversations/${conversation.id}/calls`).set(bearer(lister.token)).expect(409)).body.code).toBe('CALL_IN_PROGRESS');

      expect((await api().post(`/v1/calls/${call.id}/status`).set(bearer(tenant.token)).send({ action: 'ANSWER' }).expect(409)).body.code).toBe('NOT_THE_CALLEE');
      const answered = (await api().post(`/v1/calls/${call.id}/status`).set(bearer(lister.token)).send({ action: 'ANSWER' }).expect(200)).body;
      expect(answered).toMatchObject({ status: 'ANSWERED', connection: { userId: lister.id } });
      await api().post(`/v1/calls/${call.id}/status`).set(bearer(lister.token)).send({ action: 'ANSWER' }).expect(409);

      const ended = (await api().post(`/v1/calls/${call.id}/status`).set(bearer(tenant.token)).send({ action: 'END' }).expect(200)).body;
      expect(ended.status).toBe('ENDED');
      await api().post(`/v1/calls/${call.id}/status`).set(bearer(tenant.token)).send({ action: 'END' }).expect(409);
      const messages = (await api().get(`/v1/conversations/${conversation.id}/messages`).set(bearer(tenant.token)).expect(200)).body;
      expect(messages.items[0]).toMatchObject({ kind: 'CALL', body: expect.stringMatching(/^Call, /) });

      const stranger = await person();
      await api().post(`/v1/calls/${call.id}/status`).set(bearer(stranger.token)).send({ action: 'END' }).expect(403);
    });

    it('marks declined calls, and calls nobody answered as missed', async () => {
      const { lister, tenant, conversation } = await chat();
      const declined = (await api().post(`/v1/conversations/${conversation.id}/calls`).set(bearer(tenant.token)).expect(201)).body;
      expect((await api().post(`/v1/calls/${declined.id}/status`).set(bearer(lister.token)).send({ action: 'DECLINE' }).expect(200)).body.status).toBe('DECLINED');

      const unanswered = (await api().post(`/v1/conversations/${conversation.id}/calls`).set(bearer(tenant.token)).expect(201)).body;
      await prisma.call.update({ where: { id: unanswered.id }, data: { startedAt: new Date(Date.now() - 120_000) } });
      expect(await app.get(CallsService).sweepUnanswered()).toBeGreaterThanOrEqual(1);
      expect((await prisma.call.findUniqueOrThrow({ where: { id: unanswered.id } })).status).toBe('MISSED');
      const messages = (await api().get(`/v1/conversations/${conversation.id}/messages`).set(bearer(lister.token)).expect(200)).body;
      expect(messages.items.slice(0, 2).map((m: { body: string }) => m.body)).toEqual(['Missed call', 'Call declined']);
    });

    it('is behind its feature switch', async () => {
      const { tenant, conversation } = await chat();
      await prisma.featureFlag.update({ where: { key: 'contact.in_app_call' }, data: { defaultEnabled: false } });
      app.get((await import('../src/controls/controls.service.js')).ControlsService).invalidate();
      try {
        await api().post(`/v1/conversations/${conversation.id}/calls`).set(bearer(tenant.token)).expect(403);
      } finally {
        await prisma.featureFlag.update({ where: { key: 'contact.in_app_call' }, data: { defaultEnabled: true } });
        app.get((await import('../src/controls/controls.service.js')).ControlsService).invalidate();
      }
    });
  });

  describe('notifications', () => {
    it('keeps settings, refuses security messages and email for calls, and drops devices on sign-out', async () => {
      const user = await person();
      const defaults = (await api().get('/v1/me/notification-settings').set(bearer(user.token)).expect(200)).body;
      expect(defaults).toMatchObject({ NEW_MESSAGE: ['PUSH'], SAVED_SEARCH_ALERT: ['PUSH', 'EMAIL'] });
      const changed = (await api().patch('/v1/me/notification-settings').set(bearer(user.token)).send({ NEW_MESSAGE: ['PUSH', 'EMAIL'] }).expect(200)).body;
      expect(changed.NEW_MESSAGE).toEqual(['PUSH', 'EMAIL']);
      expect(changed.REMINDER).toEqual(['PUSH', 'EMAIL']);
      await api().patch('/v1/me/notification-settings').set(bearer(user.token)).send({ SECURITY: [] }).expect(400);
      await api().patch('/v1/me/notification-settings').set(bearer(user.token)).send({ INCOMING_CALL: ['EMAIL'] }).expect(400);

      const device = (await api().post('/v1/me/devices').set(bearer(user.token)).send({ platform: 'WEB', pushToken: `web-${run}-${seq}` }).expect(201)).body;
      expect(await prisma.pushDevice.count({ where: { userId: user.id } })).toBe(1);
      await api().post('/v1/auth/logout').set(bearer(user.token)).expect((r) => expect([200, 204]).toContain(r.status));
      expect(await prisma.pushDevice.count({ where: { id: device.id } })).toBe(0);
    });

    it('alerts tenants whose saved area and filters match a listing that goes live, once each', async () => {
      const tenant = await person();
      const other = await person();
      await api().post('/v1/me/saved-searches').set(bearer(tenant.token)).send({ name: 'Near church', area: { centre: BASE, radiusM: 500 }, filters: { minBedrooms: 2 } }).expect(201);
      await api().post('/v1/me/saved-searches').set(bearer(tenant.token)).send({ name: 'Wider', area: { centre: BASE, radiusM: 2000 } }).expect(201);
      await api().post('/v1/me/saved-searches').set(bearer(other.token)).send({ name: 'Big homes', area: { centre: BASE, radiusM: 500 }, filters: { minBedrooms: 5 } }).expect(201);
      const lister = await person(['LANDLORD']);
      const l = await listing(lister);
      await app.get(AlertsService).listingWentLive(l.id);
      const toTenant = mail.messagesTo(tenant.email).filter((m) => m.text.includes(l.title));
      expect(toTenant).toHaveLength(1);
      expect(mail.messagesTo(other.email).filter((m) => m.text.includes(l.title))).toHaveLength(0);
    });
  });

  describe('live connection', () => {
    it('delivers new messages to the other side as they are sent', async () => {
      const { lister, tenant, conversation } = await chat();
      const server = app.getHttpServer();
      if (!server.listening) await new Promise<void>((resolve) => server.listen(0, resolve));
      const { port } = server.address() as AddressInfo;
      const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/live`);
      const events: { event: string; data: any }[] = [];
      ws.on('message', (raw) => events.push(JSON.parse(String(raw))));
      await new Promise((resolve) => ws.once('open', resolve));
      ws.send(lister.token);
      await waitFor(() => events.some((e) => e.event === 'ready'));
      await api().post(`/v1/conversations/${conversation.id}/messages`).set(bearer(tenant.token)).send({ body: 'Live hello' }).expect(201);
      await waitFor(() => events.some((e) => e.event === 'message.created' && e.data.message.body === 'Live hello'));
      ws.close();

      const bad = new WebSocket(`ws://127.0.0.1:${port}/v1/live`);
      await new Promise((resolve) => bad.once('open', resolve));
      bad.send('not a token');
      const code = await new Promise<number>((resolve) => bad.once('close', (c) => resolve(c)));
      expect(code).toBe(4401);
    });
  });
});

async function waitFor(check: () => boolean, ms = 3000): Promise<void> {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error('Timed out waiting');
    await new Promise((r) => setTimeout(r, 20));
  }
}
