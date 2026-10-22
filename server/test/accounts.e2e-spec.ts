import type { INestApplication } from '@nestjs/common';
import { SignJWT } from 'jose';
import request from 'supertest';
import { hashCode } from '../src/accounts/secrets.js';
import { ControlsService } from '../src/controls/controls.service.js';
import { LogSmsAdapter } from '../src/integrations/sms/log-sms.adapter.js';
import { SMS_SENDER } from '../src/integrations/sms/sms-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createStaff, createTestApp } from './helpers.js';
import { TEST_ENV } from './test-env.js';

describe('Accounts: codes, registration, sign-in and sessions (API)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: LogSmsAdapter;
  let seq = 0;

  /** A valid Nigerian mobile number, in standard form, that no other test uses. */
  const newPhone = () => `+234803${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;
  /** The same number written another way: with the trunk "0" and spaces. */
  const writtenDifferently = (phone: string) => `+234 0${phone.slice(4, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`;
  const api = () => request(app.getHttpServer());
  const lastCode = (phone: string) => {
    const msgs = sms.messagesTo(phone);
    return msgs.length ? /\b(\d{6})\b/.exec(msgs[msgs.length - 1].text)![1] : null;
  };
  const consent = { termsVersion: '2026-10', privacyVersion: '2026-10' };

  /** Registers a new user through the API and returns the phone, password and session. */
  async function register(overrides: Record<string, unknown> = {}) {
    const phone = newPhone();
    const password = 'a good long password';
    await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
    const res = await api()
      .post('/v1/auth/register')
      .send({
        phone,
        otp: lastCode(phone),
        password,
        firstName: 'Ada',
        lastName: 'Obi',
        countryCode: 'NG',
        types: ['TENANT'],
        consent,
        ...overrides,
      })
      .expect(201);
    return { phone, password, session: res.body };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sms = app.get(SMS_SENDER);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('one-time codes', () => {
    it('sends a code for a new number and keeps only its hash, made with its own secret', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const code = lastCode(phone)!;
      expect(code).toMatch(/^\d{6}$/);
      const row = await prisma.otpCode.findFirstOrThrow({ where: { phone } });
      expect(row.codeHash).not.toContain(code);
      // Review finding (d): scrambled with OTP_HASH_SECRET, not the token secret.
      expect(row.codeHash).toBe(hashCode(TEST_ENV.OTP_HASH_SECRET, phone, 'REGISTER', code));
      expect(row.codeHash).not.toBe(hashCode(TEST_ENV.JWT_SECRET, phone, 'REGISTER', code));
    });

    it('answers the same for a registered number but sends nothing', async () => {
      const phone = newPhone();
      await prisma.user.create({
        data: { phone, passwordHash: 'x', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'] },
      });
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      expect(sms.messagesTo(phone)).toHaveLength(0);
    });

    it('does not send sign-in codes to unregistered numbers', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'LOGIN' }).expect(202);
      expect(sms.messagesTo(phone)).toHaveLength(0);
    });

    it('makes the user wait before asking again', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const res = await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(429);
      expect(res.body).toMatchObject({ statusCode: 429, code: 'TOO_MANY_REQUESTS' });
    });

    it('refuses badly written numbers and numbers that cannot exist', async () => {
      for (const phone of ['08031234567', '+2348031234567x', '+234803123456', '+2349000000001']) {
        await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(400);
      }
    });

    it('treats one number written two ways as the same number, including for limits', async () => {
      // Review finding (c).
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone: writtenDifferently(phone), purpose: 'REGISTER' }).expect(202);
      expect(lastCode(phone)).toMatch(/^\d{6}$/);
      expect(await prisma.otpCode.count({ where: { phone } })).toBe(1);
      const again = await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(429);
      expect(again.body.code).toBe('TOO_MANY_REQUESTS');
    });

    it('stops accepting a code after five wrong guesses', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const code = lastCode(phone)!;
      const wrong = code === '000000' ? '111111' : '000000';
      const body = { phone, password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'], consent };
      for (let i = 0; i < 5; i++) {
        const r = await api().post('/v1/auth/register').send({ ...body, otp: wrong }).expect(400);
        expect(r.body.code).toBe('INVALID_CODE');
      }
      await api().post('/v1/auth/register').send({ ...body, otp: code }).expect(400);
    });

    it('counts every guess even when many arrive at the same moment', async () => {
      // Review finding (a): before the fix, each simultaneous guess read the count before any was added,
      // so all of them were checked. Now only five can ever be checked.
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const code = lastCode(phone)!;
      const body = { phone, password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'], consent };
      const wrongCodes = Array.from({ length: 30 }, (_, i) => String((Number(code) + 1 + i) % 1_000_000).padStart(6, '0'));
      const results = await Promise.all(wrongCodes.map((otp) => api().post('/v1/auth/register').send({ ...body, otp })));
      expect(results.every((r) => r.status === 400 && r.body.code === 'INVALID_CODE')).toBe(true);

      const row = await prisma.otpCode.findFirstOrThrow({ where: { phone } });
      expect(row.attempts).toBe(5);
      // The right code no longer works: the attempts are used up.
      await api().post('/v1/auth/register').send({ ...body, otp: code }).expect(400);
    });

    it('lets only one of several simultaneous correct guesses use the code', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const otp = lastCode(phone)!;
      const body = { phone, otp, password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'], consent };
      const results = await Promise.all(Array.from({ length: 5 }, () => api().post('/v1/auth/register').send(body)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await prisma.user.count({ where: { phone } })).toBe(1);
    });
  });

  describe('registration', () => {
    it('registers a user at level 1, records consent, and signs them in', async () => {
      const { phone, session } = await register({ email: ' Ada@Example.com ', types: ['TENANT', 'LANDLORD'] });
      expect(session.accessToken).toBeTruthy();
      expect(session.refreshToken).toBeTruthy();
      expect(new Date(session.accessTokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(session.user).toMatchObject({
        phone,
        email: 'ada@example.com',
        countryCode: 'NG',
        language: 'en',
        types: ['TENANT', 'LANDLORD'],
        verificationLevel: 1,
        next: {
          level: 2,
          action: 'VERIFY_IDENTITY',
          unlocks: ['CONTACT_LISTERS', 'CHAT', 'BOOK_INSPECTIONS', 'ADD_PROPERTY_DRAFTS', 'APPROVE_AGENTS'],
        },
      });
      const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
      expect(user).toMatchObject({ termsVersion: '2026-10', privacyVersion: '2026-10' });
      expect(user.consentedAt).toBeInstanceOf(Date);
      expect(user.phoneVerifiedAt).toBeInstanceOf(Date);
      expect(user.passwordHash).toMatch(/^scrypt\$/);
    });

    it('requires consent', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      await api()
        .post('/v1/auth/register')
        .send({ phone, otp: lastCode(phone), password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'] })
        .expect(400);
      await api()
        .post('/v1/auth/register')
        .send({ phone, otp: lastCode(phone), password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'], consent: { termsVersion: '' } })
        .expect(400);
    });

    it('refuses a wrong code', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const wrong = lastCode(phone) === '000000' ? '111111' : '000000';
      const res = await api()
        .post('/v1/auth/register')
        .send({ phone, otp: wrong, password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'], consent })
        .expect(400);
      expect(res.body.code).toBe('INVALID_CODE');
    });

    it('refuses a country that is not open', async () => {
      const res = await api()
        .post('/v1/auth/register')
        .send({ phone: newPhone(), otp: '123456', password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'GH', types: ['TENANT'], consent })
        .expect(400);
      expect(res.body.code).toBe('COUNTRY_NOT_AVAILABLE');
    });

    it('refuses a language that is not switched on', async () => {
      const res = await api()
        .post('/v1/auth/register')
        .send({ phone: newPhone(), otp: '123456', password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'], language: 'yo', consent })
        .expect(400);
      expect(res.body.code).toBe('LANGUAGE_NOT_AVAILABLE');
    });

    it('refuses an email already used by someone else', async () => {
      await register({ email: 'taken@example.com' });
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const res = await api()
        .post('/v1/auth/register')
        .send({ phone, otp: lastCode(phone), password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'], email: 'TAKEN@example.com', consent })
        .expect(409);
      expect(res.body.code).toBe('EMAIL_TAKEN');
    });

    it('stops registrations where they are switched off', async () => {
      const controls = app.get(ControlsService);
      const admin = await createStaff(prisma, ['SUPER_ADMIN']);
      const city = await prisma.city.findFirstOrThrow({ where: { name: 'Benin City' } });
      const rule = await controls.createRule(
        { flagKey: 'platform.new_registrations', scope: 'CITY', scopeValue: city.id, enabled: false, reason: 'Test pause' },
        admin,
      );
      try {
        const otp = await api().post('/v1/auth/otp').set('X-City', city.id).send({ phone: newPhone(), purpose: 'REGISTER' }).expect(403);
        expect(otp.body).toMatchObject({ code: 'FEATURE_UNAVAILABLE', feature: 'platform.new_registrations' });
        await api()
          .post('/v1/auth/register')
          .set('X-City', city.id)
          .send({ phone: newPhone(), otp: '123456', password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'], consent })
          .expect(403);
        // Elsewhere, registration is still open.
        await api().post('/v1/auth/otp').send({ phone: newPhone(), purpose: 'REGISTER' }).expect(202);
      } finally {
        await prisma.featureRule.update({ where: { id: rule.id }, data: { status: 'ARCHIVED' } });
        controls.invalidate();
      }
    });
  });

  describe('sign-in', () => {
    it('signs in with phone and password', async () => {
      const { phone, password } = await register();
      const res = await api().post('/v1/auth/login').send({ phone, password, device: 'Test phone' }).expect(200);
      expect(res.body.user.phone).toBe(phone);
      const token = await prisma.refreshToken.findFirstOrThrow({ where: { userId: res.body.user.id, device: 'Test phone' } });
      expect(token.tokenHash).not.toBe(res.body.refreshToken);
    });

    it('signs in with the number written another way', async () => {
      // Review finding (c): registered as +234803..., signs in as +234 0803 ...
      const { phone, password, session } = await register();
      expect(session.user.phone).toBe(phone);
      const res = await api().post('/v1/auth/login').send({ phone: writtenDifferently(phone), password }).expect(200);
      expect(res.body.user.id).toBe(session.user.id);
    });

    it('stores the standard form when a user registers with the number written another way', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone: writtenDifferently(phone), purpose: 'REGISTER' }).expect(202);
      const res = await api()
        .post('/v1/auth/register')
        .send({ phone: writtenDifferently(phone), otp: lastCode(phone), password: 'a good long password', firstName: 'A', lastName: 'B', countryCode: 'NG', types: ['TENANT'], consent })
        .expect(201);
      expect(res.body.user.phone).toBe(phone);
      expect(await prisma.user.count({ where: { phone } })).toBe(1);
    });

    it('signs in with phone and SMS code', async () => {
      const { phone } = await register();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'LOGIN' }).expect(202);
      await api().post('/v1/auth/login').send({ phone, otp: lastCode(phone) }).expect(200);
    });

    it('gives the same answer for a wrong password and an unknown number', async () => {
      const { phone } = await register();
      const a = await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      const b = await api().post('/v1/auth/login').send({ phone: newPhone(), password: 'wrong password!' }).expect(401);
      expect(a.body).toEqual(b.body);
    });

    it('needs exactly one of password or code', async () => {
      const { phone, password } = await register();
      await api().post('/v1/auth/login').send({ phone }).expect(400);
      await api().post('/v1/auth/login').send({ phone, password, otp: '123456' }).expect(400);
    });

    it('pauses password sign-in after five wrong passwords, but SMS codes still work', async () => {
      const { phone, password } = await register();
      for (let i = 0; i < 5; i++) await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      const locked = await api().post('/v1/auth/login').send({ phone, password }).expect(429);
      expect(locked.body.code).toBe('PASSWORD_LOCKED');
      await api().post('/v1/auth/otp').send({ phone, purpose: 'LOGIN' }).expect(202);
      await api().post('/v1/auth/login').send({ phone, otp: lastCode(phone) }).expect(200);
      expect(await prisma.auditLog.count({ where: { action: 'auth.password_locked' } })).toBeGreaterThan(0);
    });

    it('counts every password attempt even when many arrive at the same moment', async () => {
      // Review finding (b): before the fix, all simultaneous guesses passed the lock check before any was
      // counted. Now only five are checked; the rest are refused straight away.
      const { phone, password } = await register();
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) => api().post('/v1/auth/login').send({ phone, password: `wrong password ${i}` })),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 401)).toHaveLength(5);
      expect(statuses.filter((s) => s === 429)).toHaveLength(15);
      const locked = await api().post('/v1/auth/login').send({ phone, password }).expect(429);
      expect(locked.body.code).toBe('PASSWORD_LOCKED');
    });

    it('starts counting again after a correct password', async () => {
      const { phone, password } = await register();
      for (let i = 0; i < 4; i++) await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      await api().post('/v1/auth/login').send({ phone, password }).expect(200);
      for (let i = 0; i < 4; i++) await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      await api().post('/v1/auth/login').send({ phone, password }).expect(200);
    });

    it('allows password sign-in again once the pause has run out', async () => {
      const { phone, password } = await register();
      for (let i = 0; i < 5; i++) await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      await api().post('/v1/auth/login').send({ phone, password }).expect(429);
      // Move the end of the pause into the past, as if 15 minutes had gone by.
      await prisma.$executeRaw`UPDATE "User" SET "passwordLockedUntil" = (now() AT TIME ZONE 'UTC') - interval '1 second' WHERE "phone" = ${phone}`;
      await api().post('/v1/auth/login').send({ phone, password }).expect(200);
      const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
      expect(user).toMatchObject({ failedPasswordCount: 0, passwordLockedUntil: null });
    });

    it('refuses suspended accounts, including sessions already signed in', async () => {
      const { phone, password, session } = await register();
      await prisma.user.update({ where: { phone }, data: { status: 'SUSPENDED' } });
      const login = await api().post('/v1/auth/login').send({ phone, password }).expect(403);
      expect(login.body.code).toBe('ACCOUNT_SUSPENDED');
      const me = await api().get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`).expect(403);
      expect(me.body.code).toBe('ACCOUNT_SUSPENDED');
      await api().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    });
  });

  describe('password reset', () => {
    it('sets a new password with an SMS code and signs out every device', async () => {
      const { phone, password, session } = await register();
      const laptop = await api().post('/v1/auth/login').send({ phone, password, device: 'Laptop' }).expect(200);

      await api().post('/v1/auth/otp').send({ phone, purpose: 'RESET_PASSWORD' }).expect(202);
      await api()
        .post('/v1/auth/password-reset')
        .send({ phone, otp: lastCode(phone), newPassword: 'a brand new password' })
        .expect(204);

      // Both devices are signed out.
      for (const s of [session, laptop.body]) {
        const me = await api().get('/v1/me').set('Authorization', `Bearer ${s.accessToken}`).expect(401);
        expect(me.body.code).toBe('SESSION_INVALID');
        await api().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
      }
      // Old password no longer works; the new one does.
      await api().post('/v1/auth/login').send({ phone, password }).expect(401);
      await api().post('/v1/auth/login').send({ phone, password: 'a brand new password' }).expect(200);
      expect(await prisma.auditLog.count({ where: { action: 'auth.password_reset', actorId: session.user.id } })).toBe(1);
    });

    it('lifts a pause on password sign-in', async () => {
      const { phone, password } = await register();
      for (let i = 0; i < 5; i++) await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      await api().post('/v1/auth/login').send({ phone, password }).expect(429);

      await api().post('/v1/auth/otp').send({ phone, purpose: 'RESET_PASSWORD' }).expect(202);
      await api().post('/v1/auth/password-reset').send({ phone, otp: lastCode(phone), newPassword: 'another new password' }).expect(204);
      await api().post('/v1/auth/login').send({ phone, password: 'another new password' }).expect(200);
    });

    it('refuses a wrong code and leaves the password unchanged', async () => {
      const { phone, password } = await register();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'RESET_PASSWORD' }).expect(202);
      const wrong = lastCode(phone) === '000000' ? '111111' : '000000';
      const res = await api().post('/v1/auth/password-reset').send({ phone, otp: wrong, newPassword: 'a brand new password' }).expect(400);
      expect(res.body.code).toBe('INVALID_CODE');
      await api().post('/v1/auth/login').send({ phone, password }).expect(200);
    });

    it('does not send reset codes to unregistered numbers, and refuses a short new password', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'RESET_PASSWORD' }).expect(202);
      expect(sms.messagesTo(phone)).toHaveLength(0);
      await api().post('/v1/auth/password-reset').send({ phone, otp: '123456', newPassword: 'short' }).expect(400);
    });
  });

  describe('sessions', () => {
    it('needs sign-in for /me and explains why', async () => {
      const none = await api().get('/v1/me').expect(401);
      expect(none.body).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' });
      await api().get('/v1/me').set('Authorization', 'Bearer not-a-token').expect(401);
      // Public routes still work with a bad token.
      await api().get('/v1/health').set('Authorization', 'Bearer not-a-token').expect(200);
    });

    it('tells the app when the access token has expired', async () => {
      const { session } = await register();
      const sid = (await prisma.refreshToken.findFirstOrThrow({ where: { userId: session.user.id } })).familyId;
      const expired = await new SignJWT({ typ: 'access', sid })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(session.user.id)
        .setIssuer('findhousequick')
        .setAudience('findhousequick-apps')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(new TextEncoder().encode(TEST_ENV.JWT_SECRET));
      const res = await api().get('/v1/me').set('Authorization', `Bearer ${expired}`).expect(401);
      expect(res.body.code).toBe('TOKEN_EXPIRED');
    });

    it('refreshes tokens once only, and signs the device out if an old token comes back', async () => {
      const { session } = await register();
      const first = await api().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(200);
      expect(first.body.refreshToken).not.toBe(session.refreshToken);
      await api().get('/v1/me').set('Authorization', `Bearer ${first.body.accessToken}`).expect(200);

      // The old token is presented again: treated as stolen, so the whole device is signed out.
      await api().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
      await api().post('/v1/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
      const me = await api().get('/v1/me').set('Authorization', `Bearer ${first.body.accessToken}`).expect(401);
      expect(me.body.code).toBe('SESSION_INVALID');
      expect(await prisma.auditLog.count({ where: { action: 'auth.refresh_token_reused', actorId: session.user.id } })).toBe(1);
    });

    it('signs out one device without affecting another', async () => {
      const { phone, password, session } = await register();
      const other = await api().post('/v1/auth/login').send({ phone, password, device: 'Laptop' }).expect(200);
      await api().post('/v1/auth/logout').set('Authorization', `Bearer ${session.accessToken}`).expect(204);

      await api().get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`).expect(401);
      await api().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
      await api().get('/v1/me').set('Authorization', `Bearer ${other.body.accessToken}`).expect(200);
    });
  });

  describe('/me', () => {
    it('shows the verification level and next step, rising as checks pass', async () => {
      const { session } = await register({ types: ['AGENT'] });
      const auth = { Authorization: `Bearer ${session.accessToken}` };
      let me = await api().get('/v1/me').set(auth).expect(200);
      expect(me.body).toMatchObject({ verificationLevel: 1, next: { action: 'VERIFY_IDENTITY', unlocks: ['REQUEST_PROPERTY_AUTHORITY'] } });

      await prisma.user.update({ where: { id: session.user.id }, data: { identityVerifiedAt: new Date() } });
      me = await api().get('/v1/me').set(auth).expect(200);
      expect(me.body).toMatchObject({ verificationLevel: 2, next: { action: 'ADD_BANK_ACCOUNT', unlocks: ['RECEIVE_AGENCY_FEES'] } });

      await prisma.bankAccount.create({
        data: {
          userId: session.user.id,
          countryCode: 'NG',
          bankCode: '000',
          bankName: 'Test Bank',
          accountNumberEncrypted: 'x',
          accountNumberLast4: '1234',
          accountName: 'Ada Obi',
          status: 'PASSED',
        },
      });
      me = await api().get('/v1/me').set(auth).expect(200);
      expect(me.body).toMatchObject({ verificationLevel: 3, next: null });
    });

    it('updates email, language and user types', async () => {
      const { session } = await register();
      const res = await api()
        .patch('/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ email: 'new@example.com', language: 'pcm', types: ['TENANT', 'AGENT'] })
        .expect(200);
      expect(res.body).toMatchObject({ email: 'new@example.com', language: 'pcm', types: ['TENANT', 'AGENT'] });
    });

    it('refuses fields that cannot be changed here, and unknown languages', async () => {
      const { session } = await register();
      const auth = { Authorization: `Bearer ${session.accessToken}` };
      await api().patch('/v1/me').set(auth).send({ phone: '+2348000000000' }).expect(400);
      await api().patch('/v1/me').set(auth).send({ verificationLevel: 3 }).expect(400);
      await api().patch('/v1/me').set(auth).send({ language: 'yo' }).expect(400);
      await api().patch('/v1/me').set(auth).send({ types: [] }).expect(400);
    });

    it('refuses an email already in use', async () => {
      await register({ email: 'someone@example.com' });
      const { session } = await register();
      const res = await api()
        .patch('/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ email: 'someone@example.com' })
        .expect(409);
      expect(res.body.code).toBe('EMAIL_TAKEN');
    });
  });
});
