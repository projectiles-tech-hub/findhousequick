import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hashPassword } from '../src/accounts/secrets.js';
import { FieldEncryption } from '../src/common/field-encryption.js';
import type { StaffRole } from '../src/generated/prisma/client.js';
import { LogSmsAdapter } from '../src/integrations/sms/log-sms.adapter.js';
import { SMS_SENDER } from '../src/integrations/sms/sms-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { makeFirstSuperAdmin } from '../src/staff/first-super-admin.js';
import { codeAt, timeStep } from '../src/staff/totp.js';
import { createTestApp } from './helpers.js';

const PASSWORD = 'a good long password';

describe('Staff: accounts, two-step login and feature rules (API)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: LogSmsAdapter;
  let seq = 0;

  const api = () => request(app.getHttpServer());
  /** A valid Nigerian number no other test uses (a different prefix from the accounts tests). */
  const newPhone = () => `+234806${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;
  const lastCode = (phone: string) => {
    const msgs = sms.messagesTo(phone);
    return /\b(\d{6})\b/.exec(msgs[msgs.length - 1].text)![1];
  };
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  interface Person {
    id: string;
    phone: string;
    token: string;
    refreshToken: string;
  }

  /** A registered user, signed in on one device. */
  async function person(): Promise<Person> {
    const phone = newPhone();
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        passwordHash: await hashPassword(PASSWORD),
        firstName: 'Staff',
        lastName: `Person ${seq}`,
        countryCode: 'NG',
        types: ['TENANT'],
      },
    });
    const res = await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
    return { id: user.id, phone, token: res.body.accessToken, refreshToken: res.body.refreshToken };
  }

  /** Signs the person in on another device. */
  async function newDevice(p: Person): Promise<Person> {
    const res = await api().post('/v1/auth/login').send({ phone: p.phone, password: PASSWORD }).expect(200);
    return { ...p, token: res.body.accessToken, refreshToken: res.body.refreshToken };
  }

  /** Completes two-step login on the person's current device by SMS. */
  async function passTwoStepBySms(p: Person): Promise<void> {
    await api().post('/v1/auth/two-step/sms').set(bearer(p.token)).expect(202);
    await api().post('/v1/auth/two-step/verify').set(bearer(p.token)).send({ method: 'SMS', code: lastCode(p.phone) }).expect(204);
  }

  /** A staff member, signed in, with two-step login done on that device. */
  async function staff(roles: StaffRole[], countryScopes: string[] = ['*']): Promise<Person> {
    const p = await person();
    await prisma.staffMember.create({ data: { userId: p.id, roles, countryScopes } });
    await passTwoStepBySms(p);
    return p;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sms = app.get(SMS_SENDER);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('first super admin command', () => {
    // Other test files have already made super admins in the shared test database. They are set aside
    // here, so the command sees a platform with none, and put back afterwards.
    let setAside: { userId: string; roles: StaffRole[] }[] = [];

    beforeAll(async () => {
      setAside = await prisma.staffMember.findMany({ where: { roles: { has: 'SUPER_ADMIN' } }, select: { userId: true, roles: true } });
      for (const s of setAside) {
        await prisma.staffMember.update({ where: { userId: s.userId }, data: { roles: s.roles.filter((r) => r !== 'SUPER_ADMIN') } });
      }
    });

    afterAll(async () => {
      await prisma.staffMember.updateMany({ where: { roles: { has: 'SUPER_ADMIN' } }, data: { roles: ['VERIFIER'] } });
      for (const s of setAside) await prisma.staffMember.update({ where: { userId: s.userId }, data: { roles: s.roles } });
    });

    it('refuses unknown or badly written numbers', async () => {
      await expect(makeFirstSuperAdmin(prisma, '+2348069999999')).rejects.toThrow(/register in the app first/);
      await expect(makeFirstSuperAdmin(prisma, '08031234567')).rejects.toThrow(/not a valid phone number/);
    });

    it('makes the first super admin, once only, even if run twice at the same moment', async () => {
      const a = await person();
      const b = await person();
      // The number may be written in any form.
      const written = `+234 0${a.phone.slice(4, 7)} ${a.phone.slice(7)}`;
      const results = await Promise.allSettled([makeFirstSuperAdmin(prisma, written), makeFirstSuperAdmin(prisma, b.phone)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await prisma.staffMember.count({ where: { roles: { has: 'SUPER_ADMIN' } } })).toBe(1);

      await expect(makeFirstSuperAdmin(prisma, b.phone)).rejects.toThrow(/already exists/);
      expect(await prisma.auditLog.count({ where: { action: 'staff.first_super_admin' } })).toBe(1);
    });
  });

  describe('two-step login', () => {
    it('keeps admin routes from signed-out users, non-staff and staff without the second step', async () => {
      await api().get('/v1/admin/staff').expect(401);
      const user = await person();
      const notStaff = await api().get('/v1/admin/staff').set(bearer(user.token)).expect(403);
      expect(notStaff.body.code).toBe('FORBIDDEN');
      await api().post('/v1/auth/two-step/sms').set(bearer(user.token)).expect(403);

      await prisma.staffMember.create({ data: { userId: user.id, roles: ['SUPER_ADMIN'], countryScopes: ['*'] } });
      const noSecondStep = await api().get('/v1/admin/staff').set(bearer(user.token)).expect(403);
      expect(noSecondStep.body.code).toBe('TWO_STEP_REQUIRED');

      await passTwoStepBySms(user);
      await api().get('/v1/admin/staff').set(bearer(user.token)).expect(200);
    });

    it('counts the second step per device, and keeps it when the device renews its tokens', async () => {
      const admin = await staff(['SUPER_ADMIN']);
      const refreshed = await api().post('/v1/auth/refresh').send({ refreshToken: admin.refreshToken }).expect(200);
      await api().get('/v1/admin/staff').set(bearer(refreshed.body.accessToken)).expect(200);

      const laptop = await newDevice(admin);
      const res = await api().get('/v1/admin/staff').set(bearer(laptop.token)).expect(403);
      expect(res.body.code).toBe('TWO_STEP_REQUIRED');
    });

    it('refuses a wrong SMS code', async () => {
      const p = await person();
      await prisma.staffMember.create({ data: { userId: p.id, roles: ['SUPPORT'], countryScopes: ['NG'] } });
      await api().post('/v1/auth/two-step/sms').set(bearer(p.token)).expect(202);
      const wrong = lastCode(p.phone) === '000000' ? '111111' : '000000';
      const res = await api().post('/v1/auth/two-step/verify').set(bearer(p.token)).send({ method: 'SMS', code: wrong }).expect(400);
      expect(res.body.code).toBe('INVALID_CODE');
    });

    it('counts every second-step attempt even when many arrive at the same moment', async () => {
      const p = await person();
      await prisma.staffMember.create({ data: { userId: p.id, roles: ['SUPPORT'], countryScopes: ['NG'] } });
      await api().post('/v1/auth/two-step/sms').set(bearer(p.token)).expect(202);
      const right = lastCode(p.phone);
      const guesses = Array.from({ length: 20 }, (_, i) => String((Number(right) + 1 + i) % 1_000_000).padStart(6, '0'));
      const results = await Promise.all(
        guesses.map((code) => api().post('/v1/auth/two-step/verify').set(bearer(p.token)).send({ method: 'SMS', code })),
      );
      const codes = results.map((r) => r.body.code);
      expect(codes.filter((c) => c === 'INVALID_CODE')).toHaveLength(5);
      expect(codes.filter((c) => c === 'TWO_STEP_LOCKED')).toHaveLength(15);

      const locked = await api().post('/v1/auth/two-step/verify').set(bearer(p.token)).send({ method: 'SMS', code: right }).expect(429);
      expect(locked.body.code).toBe('TWO_STEP_LOCKED');
      expect(await prisma.auditLog.count({ where: { action: 'staff.two_step_locked', actorId: p.id } })).toBe(1);
    });

    it('sets up an authenticator app, stores its secret encrypted, and accepts each code once only', async () => {
      const p = await person();
      await prisma.staffMember.create({ data: { userId: p.id, roles: ['VERIFIER'], countryScopes: ['NG'] } });

      // Setting up needs a device that has already passed the second step.
      const early = await api().post('/v1/me/two-step/authenticator').set(bearer(p.token)).expect(403);
      expect(early.body.code).toBe('TWO_STEP_REQUIRED');
      await passTwoStepBySms(p);

      const setup = await api().post('/v1/me/two-step/authenticator').set(bearer(p.token)).expect(200);
      const secret: string = setup.body.secret;
      expect(setup.body.otpauthUrl).toContain(`secret=${secret}`);

      const pending = await prisma.staffMember.findUniqueOrThrow({ where: { userId: p.id } });
      expect(pending.totpPendingSecretEncrypted).not.toContain(secret);
      expect(app.get(FieldEncryption).decrypt(pending.totpPendingSecretEncrypted!)).toBe(secret);

      const wrong = codeAt(secret, timeStep() + 5);
      await api().post('/v1/me/two-step/authenticator/confirm').set(bearer(p.token)).send({ code: wrong }).expect(400);
      await api().post('/v1/me/two-step/authenticator/confirm').set(bearer(p.token)).send({ code: codeAt(secret, timeStep()) }).expect(204);
      const enabled = await prisma.staffMember.findUniqueOrThrow({ where: { userId: p.id } });
      expect(enabled.totpEnabledAt).toBeInstanceOf(Date);
      expect(enabled.totpPendingSecretEncrypted).toBeNull();

      // A new device passes the second step with the app; the same code then fails on a third device.
      const tablet = await newDevice(p);
      const next = codeAt(secret, timeStep() + 1);
      await api().post('/v1/auth/two-step/verify').set(bearer(tablet.token)).send({ method: 'AUTHENTICATOR', code: next }).expect(204);
      // Second step passed on the tablet: the refusal now is about the role (a verifier is not a super admin).
      const roleOnly = await api().get('/v1/admin/staff').set(bearer(tablet.token)).expect(403);
      expect(roleOnly.body.code).toBe('FORBIDDEN');
      const phone3 = await newDevice(p);
      const replay = await api().post('/v1/auth/two-step/verify').set(bearer(phone3.token)).send({ method: 'AUTHENTICATOR', code: next }).expect(400);
      expect(replay.body.code).toBe('INVALID_CODE');

      // Removing the app leaves SMS codes.
      await api().delete('/v1/me/two-step/authenticator').set(bearer(p.token)).expect(204);
      const none = await api()
        .post('/v1/auth/two-step/verify')
        .set(bearer(phone3.token))
        .send({ method: 'AUTHENTICATOR', code: codeAt(secret, timeStep()) })
        .expect(400);
      expect(none.body.code).toBe('NO_AUTHENTICATOR');
      const actions = (await prisma.auditLog.findMany({ where: { actorId: p.id, entityType: 'StaffMember' } })).map((a) => a.action);
      expect(actions).toEqual(expect.arrayContaining(['staff.authenticator_added', 'staff.authenticator_removed']));
    });
  });

  describe('managing staff', () => {
    it('lets a super admin add a registered user as staff, with every change recorded', async () => {
      const admin = await staff(['SUPER_ADMIN']);
      const newcomer = await person();
      const written = `+234 0${newcomer.phone.slice(4, 7)} ${newcomer.phone.slice(7)}`;

      const added = await api()
        .post('/v1/admin/staff')
        .set(bearer(admin.token))
        .send({ phone: written, roles: ['VERIFIER'], countryScopes: ['ng'] })
        .expect(201);
      expect(added.body).toMatchObject({ userId: newcomer.id, roles: ['VERIFIER'], countryScopes: ['NG'], active: true, authenticator: false });
      expect(added.body).not.toHaveProperty('totpSecretEncrypted');

      const list = await api().get('/v1/admin/staff').set(bearer(admin.token)).expect(200);
      expect(list.body.map((s: { userId: string }) => s.userId)).toContain(newcomer.id);

      const again = await api().post('/v1/admin/staff').set(bearer(admin.token)).send({ phone: newcomer.phone, roles: ['SUPPORT'], countryScopes: ['NG'] }).expect(409);
      expect(again.body.code).toBe('ALREADY_STAFF');
      const unknown = await api().post('/v1/admin/staff').set(bearer(admin.token)).send({ phone: newPhone(), roles: ['SUPPORT'], countryScopes: ['NG'] }).expect(404);
      expect(unknown.body.code).toBe('USER_NOT_FOUND');

      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'staff.added', entityId: newcomer.id } });
      expect(log.actorId).toBe(admin.id);
      expect(log.metadata).toMatchObject({ after: { roles: ['VERIFIER'], countryScopes: ['NG'], active: true } });
    });

    it('checks roles and countries', async () => {
      const admin = await staff(['SUPER_ADMIN']);
      const p = await person();
      const bad = [
        { roles: ['KING'], countryScopes: ['NG'] },
        { roles: [], countryScopes: ['NG'] },
        { roles: ['SUPPORT'], countryScopes: ['NGA'] },
      ];
      for (const body of bad) await api().post('/v1/admin/staff').set(bearer(admin.token)).send({ phone: p.phone, ...body }).expect(400);
      const unknownCountry = await api().post('/v1/admin/staff').set(bearer(admin.token)).send({ phone: p.phone, roles: ['SUPPORT'], countryScopes: ['ZZ'] }).expect(400);
      expect(unknownCountry.body.code).toBe('UNKNOWN_COUNTRY');
      await api().post('/v1/admin/staff').set(bearer(admin.token)).send({ phone: p.phone, roles: ['SUPPORT'], countryScopes: ['*', 'NG'] }).expect(400);
    });

    it('keeps staff management to super admins', async () => {
      const manager = await staff(['COUNTRY_MANAGER'], ['NG']);
      const res = await api().get('/v1/admin/staff').set(bearer(manager.token)).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('applies changes on the next request, and stops a super admin locking themselves out', async () => {
      const admin = await staff(['SUPER_ADMIN']);
      const other = await staff(['SUPER_ADMIN']);

      // Demote the other super admin: their very next admin request is refused.
      await api().patch(`/v1/admin/staff/${other.id}`).set(bearer(admin.token)).send({ roles: ['SUPPORT'] }).expect(200);
      await api().get('/v1/admin/staff').set(bearer(other.token)).expect(403);

      // Deactivate them: they are no longer treated as staff at all.
      await api().patch(`/v1/admin/staff/${other.id}`).set(bearer(admin.token)).send({ active: false }).expect(200);
      await api().post('/v1/auth/two-step/sms').set(bearer(other.token)).expect(403);

      const self1 = await api().patch(`/v1/admin/staff/${admin.id}`).set(bearer(admin.token)).send({ active: false }).expect(400);
      expect(self1.body.code).toBe('CANNOT_CHANGE_SELF');
      const self2 = await api().patch(`/v1/admin/staff/${admin.id}`).set(bearer(admin.token)).send({ roles: ['SUPPORT'] }).expect(400);
      expect(self2.body.code).toBe('CANNOT_CHANGE_SELF');
      await api().patch(`/v1/admin/staff/${admin.id}`).set(bearer(admin.token)).send({ countryScopes: ['NG'] }).expect(200);

      const changes = await prisma.auditLog.findMany({ where: { action: 'staff.changed', entityId: other.id }, orderBy: { createdAt: 'asc' } });
      expect(changes).toHaveLength(2);
      expect(changes[1].metadata).toMatchObject({ before: { active: true }, after: { active: false } });
    });
  });

  describe('feature rules (decision 28)', () => {
    let superAdmin: Person;
    let secondSuperAdmin: Person;
    let ngManager: Person;
    let otherNgManager: Person;

    beforeAll(async () => {
      superAdmin = await staff(['SUPER_ADMIN']);
      secondSuperAdmin = await staff(['SUPER_ADMIN']);
      ngManager = await staff(['COUNTRY_MANAGER'], ['NG']);
      otherNgManager = await staff(['COUNTRY_MANAGER'], ['NG']);
    });

    const createRule = (who: Person, body: Record<string, unknown>) =>
      api().post('/v1/admin/feature-rules').set(bearer(who.token)).send({ scope: 'COUNTRY', scopeValue: 'NG', reason: 'Test', ...body });
    const features = async () => (await api().get('/v1/controls').set('X-Country', 'NG').expect(200)).body.features;

    it('lets a country manager switch a feature off in their country at once', async () => {
      const res = await createRule(ngManager, { flagKey: 'search.compare', enabled: false }).expect(201);
      expect(res.body.status).toBe('ACTIVE');
      expect((await features())['search.compare']).toBe(false);
      await api().post(`/v1/admin/feature-rules/${res.body.id}/archive`).set(bearer(superAdmin.token)).send({ reason: 'Test over' }).expect(200);
    });

    it("waits for a super admin before a country manager's other changes take effect", async () => {
      const on = await createRule(ngManager, { flagKey: 'search.landmark', enabled: true, rolloutPercent: 10 }).expect(201);
      expect(on.body.status).toBe('PENDING_APPROVAL');
      const scheduledOff = await createRule(ngManager, { flagKey: 'search.compare', enabled: false, startsAt: new Date(Date.now() + 86_400_000).toISOString() }).expect(201);
      expect(scheduledOff.body.status).toBe('PENDING_APPROVAL');

      const byManager = await api().post(`/v1/admin/feature-rules/${on.body.id}/approve`).set(bearer(otherNgManager.token)).expect(403);
      expect(byManager.body.code).toBe('SUPER_ADMIN_APPROVAL_REQUIRED');
      const bySelf = await api().post(`/v1/admin/feature-rules/${on.body.id}/approve`).set(bearer(ngManager.token)).expect(403);
      expect(bySelf.body.code).toBe('SAME_PERSON');
      const approved = await api().post(`/v1/admin/feature-rules/${on.body.id}/approve`).set(bearer(superAdmin.token)).expect(200);
      expect(approved.body).toMatchObject({ status: 'ACTIVE', approvedById: superAdmin.id });

      // A country manager can withdraw their own waiting proposal at once.
      const withdrawn = await api().post(`/v1/admin/feature-rules/${scheduledOff.body.id}/archive`).set(bearer(ngManager.token)).send({ reason: 'Changed my mind' }).expect(200);
      expect(withdrawn.body.status).toBe('ARCHIVED');
    });

    it("keeps a live rule in force until a super admin approves a country manager's withdrawal", async () => {
      const off = await createRule(ngManager, { flagKey: 'search.compare', enabled: false }).expect(201);
      const asked = await api().post(`/v1/admin/feature-rules/${off.body.id}/archive`).set(bearer(ngManager.token)).send({ reason: 'Turn it back on' }).expect(200);
      expect(asked.body).toMatchObject({ status: 'ACTIVE', archiveRequestedById: ngManager.id, archiveReason: 'Turn it back on' });
      expect((await features())['search.compare']).toBe(false);

      await api().post(`/v1/admin/feature-rules/${off.body.id}/archive`).set(bearer(otherNgManager.token)).send({ reason: 'Me too' }).expect(409);
      await api().post(`/v1/admin/feature-rules/${off.body.id}/approve`).set(bearer(otherNgManager.token)).expect(403);
      const done = await api().post(`/v1/admin/feature-rules/${off.body.id}/approve`).set(bearer(superAdmin.token)).expect(200);
      expect(done.body.status).toBe('ARCHIVED');
      expect((await features())['search.compare']).toBe(true);

      const actions = (await prisma.controlChange.findMany({ where: { entityId: off.body.id }, orderBy: { createdAt: 'asc' } })).map((c) => c.action);
      expect(actions).toEqual(['RULE_CREATED', 'RULE_ARCHIVE_REQUESTED', 'RULE_ARCHIVED']);
    });

    it("needs a second person for a super admin's critical switch-on, and applies their other changes at once", async () => {
      const critical = await createRule(superAdmin, { flagKey: 'money.card_payments', enabled: true }).expect(201);
      expect(critical.body.status).toBe('PENDING_APPROVAL');
      const self = await api().post(`/v1/admin/feature-rules/${critical.body.id}/approve`).set(bearer(superAdmin.token)).expect(403);
      expect(self.body.code).toBe('SAME_PERSON');
      // A country manager in that country may be the second person, since the first is a super admin.
      await api().post(`/v1/admin/feature-rules/${critical.body.id}/approve`).set(bearer(ngManager.token)).expect(200);
      expect((await features())['money.card_payments']).toBe(true);

      const normal = await createRule(superAdmin, { flagKey: 'search.landmark', enabled: true }).expect(201);
      expect(normal.body.status).toBe('ACTIVE');

      // Withdrawing an OFF rule on a critical feature would switch it back on, so it is refused.
      const pause = await createRule(secondSuperAdmin, { flagKey: 'money.card_payments', enabled: false }).expect(201);
      const refused = await api().post(`/v1/admin/feature-rules/${pause.body.id}/archive`).set(bearer(superAdmin.token)).send({ reason: 'Resume' }).expect(403);
      expect(refused.body.code).toBe('CRITICAL_OFF_RULE');
    });

    it("keeps country managers to their own countries, and shows them only their countries' rules", async () => {
      const ghRule = await createRule(superAdmin, { flagKey: 'search.compare', enabled: false, scopeValue: 'GH' }).expect(201);
      const outside = await createRule(ngManager, { flagKey: 'search.compare', enabled: false, scopeValue: 'GH' }).expect(403);
      expect(outside.body.code).toBe('FORBIDDEN');
      await createRule(ngManager, { flagKey: 'search.compare', enabled: false, scope: 'GLOBAL', scopeValue: null }).expect(403);

      const managerView = await api().get('/v1/admin/feature-rules').set(bearer(ngManager.token)).expect(200);
      expect(managerView.body.map((r: { id: string }) => r.id)).not.toContain(ghRule.body.id);
      const adminView = await api().get('/v1/admin/feature-rules?status=ACTIVE').set(bearer(superAdmin.token)).expect(200);
      expect(adminView.body.map((r: { id: string }) => r.id)).toContain(ghRule.body.id);
      expect(adminView.body.every((r: { status: string }) => r.status === 'ACTIVE')).toBe(true);
    });

    it('refuses badly formed rules with clear codes', async () => {
      const unknown = await createRule(superAdmin, { flagKey: 'no.such', enabled: true }).expect(400);
      expect(unknown.body.code).toBe('UNKNOWN_FEATURE');
      await createRule(superAdmin, { flagKey: 'search.compare', enabled: true, rolloutPercent: 150 }).expect(400);
      await createRule(superAdmin, { flagKey: 'search.compare', enabled: true, reason: '' }).expect(400);
      await api().post('/v1/admin/feature-rules/not-a-uuid/approve').set(bearer(superAdmin.token)).expect(400);
      const missing = await api().post(`/v1/admin/feature-rules/${'0'.repeat(8)}-0000-7000-8000-${'0'.repeat(12)}/approve`).set(bearer(superAdmin.token)).expect(404);
      expect(missing.body.code).toBe('RULE_NOT_FOUND');
    });
  });
});
