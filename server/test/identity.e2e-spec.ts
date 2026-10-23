import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hashPassword } from '../src/accounts/secrets.js';
import { FieldEncryption } from '../src/common/field-encryption.js';
import { ControlsService } from '../src/controls/controls.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';

const PASSWORD = 'a good long password';

describe('Verification ladder and identity checks (API)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let seq = 0;

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  /** A valid Nigerian number no other test file uses. */
  const newPhone = () => `+234807${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;
  /** An 11-digit NIN no other test in this run uses. */
  const newNin = () => `${String(Date.now()).slice(-6)}${String(++seq).padStart(5, '0')}`;

  interface Person {
    id: string;
    token: string;
  }

  /** A signed-in user. Level 1 by default (phone and email confirmed); level 0 or 2 on request. */
  async function person(opts: { level?: 0 | 1 | 2; types?: ('TENANT' | 'LANDLORD' | 'AGENT')[]; name?: [string, string] } = {}): Promise<Person> {
    const level = opts.level ?? 1;
    const phone = newPhone();
    const [firstName, lastName] = opts.name ?? ['Chidi', 'Okafor'];
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        email: `identity${process.pid}.${seq}@example.com`,
        emailVerifiedAt: level >= 1 ? new Date() : null,
        identityVerifiedAt: level >= 2 ? new Date() : null,
        passwordHash: await hashPassword(PASSWORD),
        firstName,
        lastName,
        countryCode: 'NG',
        types: opts.types ?? ['TENANT'],
      },
    });
    const res = await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
    return { id: user.id, token: res.body.accessToken };
  }

  const startCheck = (p: Person, idNumber: string, extra: Record<string, unknown> = {}) =>
    api().post('/v1/identity/checks').set(bearer(p.token)).send({ idType: 'NIN', idNumber, consent: true, ...extra });

  /** Sends a result from the test provider. Defaults to a clear pass for "Chidi Okafor". */
  const sendResult = (reference: string, extra: Record<string, unknown> = {}) =>
    api()
      .post('/v1/identity/provider-results/test')
      .send({ reference, idFound: true, nameOnId: 'OKAFOR CHIDI EMEKA', livenessPassed: true, faceMatched: true, faceMatchScore: 91, ...extra });

  const levelOf = async (p: Person) => (await api().get('/v1/me').set(bearer(p.token)).expect(200)).body.verificationLevel;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('the verification ladder check', () => {
    it('refuses a level 0 user with the level needed and what to do next (decision 64)', async () => {
      const p = await person({ level: 0 });
      const res = await startCheck(p, newNin()).expect(403);
      expect(res.body).toMatchObject({
        code: 'VERIFICATION_REQUIRED',
        requiredLevel: 1,
        currentLevel: 0,
        next: { level: 1, action: 'CONFIRM_EMAIL' },
      });
    });

    it('refuses a level 1 agent on a route needing level 2', async () => {
      const p = await person({ types: ['AGENT'] });
      const res = await api().put('/v1/me/agent-profile').set(bearer(p.token)).send({ businessName: 'Okafor Homes' }).expect(403);
      expect(res.body).toMatchObject({ code: 'VERIFICATION_REQUIRED', requiredLevel: 2, currentLevel: 1, next: { action: 'VERIFY_IDENTITY' } });
    });

    it('reads the level from the database on every request, not from the sign-in token', async () => {
      const p = await person({ level: 0 });
      await startCheck(p, newNin()).expect(403);
      await prisma.user.update({ where: { id: p.id }, data: { emailVerifiedAt: new Date() } });
      await startCheck(p, newNin()).expect(201);
    });
  });

  describe('starting a check', () => {
    it('returns the provider session and stores the ID number only encrypted and fingerprinted', async () => {
      const p = await person();
      const nin = newNin();
      const res = await startCheck(p, `${nin.slice(0, 4)} ${nin.slice(4)}`).expect(201);
      expect(res.body).toMatchObject({ idType: 'NIN', idNumberLast4: nin.slice(-4), status: 'PENDING', nextAction: null });
      expect(res.body.providerSession).toMatchObject({ provider: 'test', reference: `test-${res.body.id}` });
      expect(JSON.stringify(res.body)).not.toContain(nin);

      const row = await prisma.identityVerification.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.idNumberEncrypted).not.toContain(nin);
      expect(row.idNumberHash).not.toContain(nin);
      expect(app.get(FieldEncryption).decrypt(row.idNumberEncrypted)).toBe(nin);
      expect(row.providerReference).toBe(`test-${row.id}`);
    });

    it('needs consent, an accepted ID type and a number in the right format', async () => {
      const p = await person();
      await startCheck(p, newNin(), { consent: false }).expect(400);
      expect((await startCheck(p, newNin(), { idType: 'VOTERS_CARD' }).expect(400)).body.code).toBe('ID_TYPE_NOT_ACCEPTED');
      expect((await startCheck(p, '1234567890').expect(400)).body.code).toBe('INVALID_ID_NUMBER');
      expect((await startCheck(p, '1234567890A').expect(400)).body.code).toBe('INVALID_ID_NUMBER');
    });

    it('is refused when the identity check is switched off', async () => {
      const p = await person();
      const controls = app.get(ControlsService);
      const spy = vi.spyOn(controls, 'isEnabled').mockImplementation(async (key) => key !== 'verification.identity_check');
      try {
        const res = await startCheck(p, newNin()).expect(403);
        expect(res.body).toMatchObject({ code: 'FEATURE_UNAVAILABLE', feature: 'verification.identity_check' });
      } finally {
        spy.mockRestore();
      }
    });

    it('is refused when the country has no identity provider', async () => {
      const p = await person();
      const ng = await prisma.country.findUniqueOrThrow({ where: { code: 'NG' } });
      const settings = ng.settings as { verification: Record<string, unknown> };
      await prisma.country.update({
        where: { code: 'NG' },
        data: { settings: { ...settings, verification: { ...settings.verification, identityProvider: null } } },
      });
      try {
        expect((await startCheck(p, newNin()).expect(403)).body.code).toBe('IDENTITY_CHECK_UNAVAILABLE');
      } finally {
        await prisma.country.update({ where: { code: 'NG' }, data: { settings: ng.settings as object } });
      }
    });

    it('limits the checks one user can start in a day', async () => {
      const p = await person();
      for (let i = 0; i < 3; i++) await startCheck(p, newNin()).expect(201);
      expect((await startCheck(p, newNin()).expect(429)).body.code).toBe('TOO_MANY_CHECKS');
    });

    it('replaces an unfinished check, and ignores a late result for it', async () => {
      const p = await person();
      const first = (await startCheck(p, newNin()).expect(201)).body;
      const second = (await startCheck(p, newNin()).expect(201)).body;
      const old = await prisma.identityVerification.findUniqueOrThrow({ where: { id: first.id } });
      expect(old).toMatchObject({ status: 'FAILED', failureReason: 'REPLACED' });
      expect((await sendResult(first.providerSession.reference).expect(200)).body).toEqual({ recorded: false });
      expect(await levelOf(p)).toBe(1);
      expect((await api().get(`/v1/identity/checks/${second.id}`).set(bearer(p.token)).expect(200)).body.status).toBe('PENDING');
    });
  });

  describe('results from the provider', () => {
    it('moves the user to level 2 on a clear pass, and ignores the same result sent again', async () => {
      const p = await person();
      const check = (await startCheck(p, newNin()).expect(201)).body;
      expect((await sendResult(check.providerSession.reference).expect(200)).body).toEqual({ recorded: true });
      expect(await levelOf(p)).toBe(2);
      const me = (await api().get('/v1/me').set(bearer(p.token)).expect(200)).body;
      expect(me.next).toMatchObject({ level: 3, action: 'ADD_BANK_ACCOUNT' });

      expect((await sendResult(check.providerSession.reference, { faceMatched: false }).expect(200)).body).toEqual({ recorded: false });
      const view = (await api().get(`/v1/identity/checks/${check.id}`).set(bearer(p.token)).expect(200)).body;
      expect(view).toMatchObject({ status: 'PASSED', failureReason: null, nextAction: null });
      expect(view.completedAt).not.toBeNull();
      expect((await startCheck(p, newNin()).expect(409)).body.code).toBe('ALREADY_VERIFIED');
    });

    it('asks for another attempt when liveness fails, and offers a document photo when the face does not match', async () => {
      const p = await person();
      let check = (await startCheck(p, newNin()).expect(201)).body;
      await sendResult(check.providerSession.reference, { livenessPassed: false }).expect(200);
      expect((await api().get(`/v1/identity/checks/${check.id}`).set(bearer(p.token))).body).toMatchObject({
        status: 'FAILED',
        failureReason: 'LIVENESS_FAILED',
        nextAction: null,
      });

      check = (await startCheck(p, newNin()).expect(201)).body;
      await sendResult(check.providerSession.reference, { faceMatched: false }).expect(200);
      expect((await api().get(`/v1/identity/checks/${check.id}`).set(bearer(p.token))).body).toMatchObject({
        status: 'FAILED',
        failureReason: 'FACE_MISMATCH',
        nextAction: 'UPLOAD_ID_DOCUMENT',
      });
      expect(await levelOf(p)).toBe(1);
    });

    it('sends a name that does not match to the verification team, and pauses new checks meanwhile', async () => {
      const p = await person();
      const check = (await startCheck(p, newNin()).expect(201)).body;
      await sendResult(check.providerSession.reference, { nameOnId: 'EMEKA OBI' }).expect(200);
      const view = (await api().get(`/v1/identity/checks/${check.id}`).set(bearer(p.token))).body;
      expect(view).toMatchObject({ status: 'MANUAL_REVIEW', failureReason: 'NAME_MISMATCH', nextAction: 'UPLOAD_ID_DOCUMENT', completedAt: null });
      const task = await prisma.reviewTask.findFirstOrThrow({ where: { entityId: check.id } });
      expect(task).toMatchObject({ type: 'IDENTITY_REVIEW', countryCode: 'NG', status: 'OPEN' });
      expect((await startCheck(p, newNin()).expect(409)).body.code).toBe('CHECK_UNDER_REVIEW');
      expect(await levelOf(p)).toBe(1);
    });

    it('refuses results that cannot be read or verified, and unknown providers or checks', async () => {
      await api().post('/v1/identity/provider-results/test').send({ reference: 'x' }).expect(401);
      await api().post('/v1/identity/provider-results/nobody').send({}).expect(404);
      await sendResult('test-00000000-0000-7000-8000-000000000000').expect(404);
    });

    it('lists only the user’s own checks, newest first', async () => {
      const p = await person();
      const other = await person();
      const a = (await startCheck(p, newNin()).expect(201)).body;
      const b = (await startCheck(p, newNin()).expect(201)).body;
      const list = (await api().get('/v1/identity/checks').set(bearer(p.token)).expect(200)).body;
      expect(list.map((c: { id: string }) => c.id)).toEqual([b.id, a.id]);
      await api().get(`/v1/identity/checks/${a.id}`).set(bearer(other.token)).expect(404);
    });
  });

  describe('one ID on several accounts', () => {
    it('sends a second account using a verified ID to the verification team, without calling the provider', async () => {
      const nin = newNin();
      const first = await person();
      const check = (await startCheck(first, nin).expect(201)).body;
      await sendResult(check.providerSession.reference).expect(200);

      const second = await person();
      const res = await startCheck(second, nin).expect(409);
      expect(res.body.code).toBe('ID_ALREADY_LINKED');
      const row = await prisma.identityVerification.findUniqueOrThrow({ where: { id: res.body.check.id } });
      expect(row).toMatchObject({ status: 'MANUAL_REVIEW', failureReason: 'DUPLICATE_ID', providerReference: null });
      const task = await prisma.reviewTask.findFirstOrThrow({ where: { entityId: row.id } });
      expect(task.type).toBe('DUPLICATE_RESOLUTION');
      expect(await levelOf(second)).toBe(1);
    });

    it('also catches two accounts that start on the same ID at the same moment', async () => {
      const nin = newNin();
      const [a, b] = [await person(), await person()];
      const [ra, rb] = await Promise.all([startCheck(a, nin), startCheck(b, nin)]);
      const started = [ra, rb].filter((r) => r.status === 201);
      // Either one start already saw the other (409), or both started and the results decide.
      if (started.length === 2) {
        await sendResult(ra.body.providerSession.reference).expect(200);
        await sendResult(rb.body.providerSession.reference).expect(200);
        const rows = await prisma.identityVerification.findMany({ where: { id: { in: [ra.body.id, rb.body.id] } } });
        expect(rows.map((r) => r.status).sort()).toEqual(['MANUAL_REVIEW', 'PASSED']);
        expect(rows.find((r) => r.status === 'MANUAL_REVIEW')?.failureReason).toBe('DUPLICATE_ID');
      } else {
        expect([ra.status, rb.status].sort()).toEqual([201, 409]);
      }
      expect([await levelOf(a), await levelOf(b)].filter((l) => l === 2).length).toBeLessThanOrEqual(1);
    });
  });

  describe('agent company details (decision 50)', () => {
    it('are for agents only', async () => {
      const p = await person({ level: 2 });
      expect((await api().put('/v1/me/agent-profile').set(bearer(p.token)).send({ businessName: 'X Homes' }).expect(403)).body.code).toBe(
        'NOT_AN_AGENT',
      );
    });

    it('are saved as pending and sent to the verification team once', async () => {
      const p = await person({ level: 2, types: ['AGENT'] });
      await api().get('/v1/me/agent-profile').set(bearer(p.token)).expect(404);
      const res = await api()
        .put('/v1/me/agent-profile')
        .set(bearer(p.token))
        .send({ businessName: '  Okafor Homes Ltd ', registrationNumber: 'RC 123456' })
        .expect(200);
      expect(res.body).toEqual({ businessName: 'Okafor Homes Ltd', registrationNumber: 'RC 123456', status: 'PENDING' });
      await api().put('/v1/me/agent-profile').set(bearer(p.token)).send({ businessName: 'Okafor Homes Limited' }).expect(200);
      const tasks = await prisma.reviewTask.findMany({ where: { type: 'AGENT_PROFILE_REVIEW', entityId: p.id } });
      expect(tasks).toHaveLength(1);
      expect((await api().get('/v1/me/agent-profile').set(bearer(p.token)).expect(200)).body).toEqual({
        businessName: 'Okafor Homes Limited',
        registrationNumber: null,
        status: 'PENDING',
      });
    });
  });
});
