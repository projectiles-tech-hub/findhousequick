import type { INestApplication } from '@nestjs/common';
import { SignJWT } from 'jose';
import request from 'supertest';
import { hashCode } from '../src/accounts/secrets.js';
import { ControlsService } from '../src/controls/controls.service.js';
import { EMAIL_SENDER } from '../src/integrations/email/email-sender.js';
import { LogEmailAdapter } from '../src/integrations/email/log-email.adapter.js';
import { LogSmsAdapter } from '../src/integrations/sms/log-sms.adapter.js';
import { SMS_SENDER } from '../src/integrations/sms/sms-sender.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createStaff, createTestApp } from './helpers.js';
import { TEST_ENV } from './test-env.js';

const PASSWORD = 'a good long password';

describe('Accounts: codes, registration, contacts, sign-in and sessions (API)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: LogSmsAdapter;
  let mail: LogEmailAdapter;
  let seq = 0;

  /** A valid Nigerian mobile number, in standard form, that no other test uses. */
  const newPhone = () => `+234803${String(process.pid % 100).padStart(2, '0')}${String(++seq).padStart(5, '0')}`;
  /** An email address no other test uses. */
  const newEmail = () => `user${process.pid}.${++seq}@example.com`;
  /** The same number written another way: with the trunk "0" and spaces. */
  const writtenDifferently = (phone: string) => `+234 0${phone.slice(4, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`;
  const api = () => request(app.getHttpServer());
  /** The last code sent to a phone number (by SMS) or email address (by email), or null if none was sent. */
  const lastCode = (to: string) => {
    const msgs = to.includes('@') ? mail.messagesTo(to) : sms.messagesTo(to);
    return msgs.length ? /\b(\d{6})\b/.exec(msgs[msgs.length - 1].text)![1] : null;
  };
  const sentTo = (to: string) => (to.includes('@') ? mail.messagesTo(to) : sms.messagesTo(to));
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const consent = { termsVersion: '2026-10', privacyVersion: '2026-10' };
  const details = { password: PASSWORD, firstName: 'Ada', lastName: 'Obi', countryCode: 'NG', types: ['TENANT'], consent };

  /**
   * Registers a new user through the API, confirming one contact with the registration code (signUpWith), and
   * by default the other afterwards too, so the user reaches level 1.
   */
  async function register(opts: { signUpWith?: 'SMS' | 'EMAIL'; confirmBoth?: boolean; overrides?: Record<string, unknown> } = {}) {
    const { signUpWith = 'SMS', confirmBoth = true, overrides = {} } = opts;
    const phone = newPhone();
    const email = newEmail();
    const first = signUpWith === 'SMS' ? phone : email;
    await api().post('/v1/auth/otp').send({ [signUpWith === 'SMS' ? 'phone' : 'email']: first, purpose: 'REGISTER' }).expect(202);
    const res = await api()
      .post('/v1/auth/register')
      .send({ ...details, phone, email, signUpWith, otp: lastCode(first), ...overrides })
      .expect(201);
    if (confirmBoth) await confirmContact(res.body.accessToken, signUpWith === 'SMS' ? 'EMAIL' : 'SMS', signUpWith === 'SMS' ? email : phone);
    return { phone, email, password: PASSWORD, session: res.body };
  }

  async function confirmContact(token: string, channel: 'SMS' | 'EMAIL', value: string, extra: Record<string, unknown> = {}) {
    await api().post('/v1/me/contacts/code').set(bearer(token)).send({ channel, value }).expect(202);
    return api().post('/v1/me/contacts/confirm').set(bearer(token)).send({ channel, value, code: lastCode(value.toLowerCase()), ...extra });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sms = app.get(SMS_SENDER);
    mail = app.get(EMAIL_SENDER);
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
      const row = await prisma.otpCode.findFirstOrThrow({ where: { destination: phone } });
      expect(row).toMatchObject({ channel: 'SMS', purpose: 'REGISTER' });
      expect(row.codeHash).not.toContain(code);
      expect(row.codeHash).toBe(hashCode(TEST_ENV.OTP_HASH_SECRET, phone, 'REGISTER', code));
      expect(row.codeHash).not.toBe(hashCode(TEST_ENV.JWT_SECRET, phone, 'REGISTER', code));
    });

    it('sends codes by email, with the address in one standard form', async () => {
      const email = newEmail();
      await api().post('/v1/auth/otp').send({ email: `  ${email.toUpperCase()} `, purpose: 'REGISTER' }).expect(202);
      expect(lastCode(email)).toMatch(/^\d{6}$/);
      expect(mail.messagesTo(email)[0].subject).toBe('Your FindHouseQuick code');
      expect(await prisma.otpCode.findFirstOrThrow({ where: { destination: email } })).toMatchObject({ channel: 'EMAIL' });
    });

    it('needs exactly one of phone or email, each well formed', async () => {
      await api().post('/v1/auth/otp').send({ purpose: 'REGISTER' }).expect(400);
      await api().post('/v1/auth/otp').send({ phone: newPhone(), email: newEmail(), purpose: 'REGISTER' }).expect(400);
      for (const email of ['ada', 'ada@example', 'a da@example.com']) {
        await api().post('/v1/auth/otp').send({ email, purpose: 'REGISTER' }).expect(400);
      }
    });

    it('answers the same for a registered phone number or email address but sends nothing', async () => {
      // Each user is asked about the contact that did not receive their registration code (one code a minute).
      const { email } = await register({ signUpWith: 'SMS' });
      const { phone } = await register({ signUpWith: 'EMAIL' });
      const before = [sentTo(phone).length, sentTo(email).length];
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      await api().post('/v1/auth/otp').send({ email, purpose: 'REGISTER' }).expect(202);
      expect([sentTo(phone).length, sentTo(email).length]).toEqual(before);
    });

    it('does not send sign-in or reset codes to unregistered or unconfirmed contacts', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'LOGIN' }).expect(202);
      expect(sentTo(phone)).toHaveLength(0);
      // Registered with the phone; the email is on the account but not confirmed yet.
      const { email } = await register({ confirmBoth: false });
      await api().post('/v1/auth/otp').send({ email, purpose: 'LOGIN' }).expect(202);
      await api().post('/v1/auth/otp').send({ email, purpose: 'RESET_PASSWORD' }).expect(202);
      expect(sentTo(email)).toHaveLength(0);
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
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone: writtenDifferently(phone), purpose: 'REGISTER' }).expect(202);
      expect(lastCode(phone)).toMatch(/^\d{6}$/);
      expect(await prisma.otpCode.count({ where: { destination: phone } })).toBe(1);
      const again = await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(429);
      expect(again.body.code).toBe('TOO_MANY_REQUESTS');
    });

    it('stops accepting a code after five wrong guesses', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const code = lastCode(phone)!;
      const wrong = code === '000000' ? '111111' : '000000';
      const body = { ...details, phone, email: newEmail(), signUpWith: 'SMS' };
      for (let i = 0; i < 5; i++) {
        const r = await api().post('/v1/auth/register').send({ ...body, otp: wrong }).expect(400);
        expect(r.body.code).toBe('INVALID_CODE');
      }
      await api().post('/v1/auth/register').send({ ...body, otp: code }).expect(400);
    });

    it('counts every guess even when many arrive at the same moment', async () => {
      const email = newEmail();
      await api().post('/v1/auth/otp').send({ email, purpose: 'REGISTER' }).expect(202);
      const code = lastCode(email)!;
      const body = { ...details, phone: newPhone(), email, signUpWith: 'EMAIL' };
      const wrongCodes = Array.from({ length: 30 }, (_, i) => String((Number(code) + 1 + i) % 1_000_000).padStart(6, '0'));
      const results = await Promise.all(wrongCodes.map((otp) => api().post('/v1/auth/register').send({ ...body, otp })));
      expect(results.every((r) => r.status === 400 && r.body.code === 'INVALID_CODE')).toBe(true);
      expect((await prisma.otpCode.findFirstOrThrow({ where: { destination: email } })).attempts).toBe(5);
      await api().post('/v1/auth/register').send({ ...body, otp: code }).expect(400);
    });

    it('lets only one of several simultaneous correct guesses use the code', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const body = { ...details, phone, email: newEmail(), signUpWith: 'SMS', otp: lastCode(phone) };
      const results = await Promise.all(Array.from({ length: 5 }, () => api().post('/v1/auth/register').send(body)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await prisma.user.count({ where: { phone } })).toBe(1);
    });
  });

  describe('registration (decisions 35 and 37)', () => {
    it('registers with the phone, confirming it now; the user browses at level 0 until the email is confirmed', async () => {
      const { phone, email, session } = await register({ confirmBoth: false, overrides: { types: ['TENANT', 'LANDLORD'] } });
      expect(session.accessToken).toBeTruthy();
      expect(session.refreshToken).toBeTruthy();
      expect(session.user).toMatchObject({
        phone,
        phoneConfirmed: true,
        email,
        emailConfirmed: false,
        countryCode: 'NG',
        language: 'en',
        types: ['TENANT', 'LANDLORD'],
        verificationLevel: 0,
        next: { level: 1, action: 'CONFIRM_EMAIL', unlocks: ['SAVE_FAVOURITES', 'SAVED_AREA_ALERTS', 'START_IDENTITY_CHECK'] },
      });
      const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
      expect(user).toMatchObject({ termsVersion: '2026-10', privacyVersion: '2026-10', emailVerifiedAt: null });
      expect(user.consentedAt).toBeInstanceOf(Date);
      expect(user.phoneVerifiedAt).toBeInstanceOf(Date);
      expect(user.passwordHash).toMatch(/^scrypt\$/);
      expect((await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } })).signInMethod).toBe('SMS_CODE');

      // Confirming the email reaches level 1.
      const confirmed = await confirmContact(session.accessToken, 'EMAIL', email);
      expect(confirmed.status).toBe(200);
      expect(confirmed.body).toMatchObject({ emailConfirmed: true, verificationLevel: 1, next: { action: 'VERIFY_IDENTITY' } });
    });

    it('registers with the email, confirming it now; the phone is asked for next', async () => {
      const { phone, email, session } = await register({ signUpWith: 'EMAIL', confirmBoth: false });
      expect(session.user).toMatchObject({
        phoneConfirmed: false,
        emailConfirmed: true,
        verificationLevel: 0,
        next: { level: 1, action: 'CONFIRM_PHONE' },
      });
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.phone).toBe(phone);
      expect(user.phoneVerifiedAt).toBeNull();
      expect((await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } })).signInMethod).toBe('EMAIL_CODE');

      // The number may be written another way; it is matched in its standard form.
      const t = session.accessToken;
      await api().post('/v1/me/contacts/code').set(bearer(t)).send({ channel: 'SMS', value: writtenDifferently(phone) }).expect(202);
      const confirmed = await api()
        .post('/v1/me/contacts/confirm')
        .set(bearer(t))
        .send({ channel: 'SMS', value: writtenDifferently(phone), code: lastCode(phone) })
        .expect(200);
      expect(confirmed.body).toMatchObject({ phone, phoneConfirmed: true, verificationLevel: 1 });
    });

    it('requires both phone and email, and says which one the code went to', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const otp = lastCode(phone);
      await api().post('/v1/auth/register').send({ ...details, phone, signUpWith: 'SMS', otp }).expect(400);
      await api().post('/v1/auth/register').send({ ...details, phone, email: newEmail(), otp }).expect(400);
      await api().post('/v1/auth/register').send({ ...details, phone, email: 'not-an-email', signUpWith: 'SMS', otp }).expect(400);
    });

    it('requires consent', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const body = { ...details, phone, email: newEmail(), signUpWith: 'SMS', otp: lastCode(phone) };
      const { consent: _c, ...noConsent } = body;
      await api().post('/v1/auth/register').send(noConsent).expect(400);
      await api().post('/v1/auth/register').send({ ...body, consent: { termsVersion: '' } }).expect(400);
    });

    it('refuses a wrong code, or a code sent to the other contact', async () => {
      const phone = newPhone();
      const email = newEmail();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const wrong = lastCode(phone) === '000000' ? '111111' : '000000';
      const res = await api().post('/v1/auth/register').send({ ...details, phone, email, signUpWith: 'SMS', otp: wrong }).expect(400);
      expect(res.body.code).toBe('INVALID_CODE');
      // The SMS code does not confirm the email.
      await api().post('/v1/auth/register').send({ ...details, phone, email, signUpWith: 'EMAIL', otp: lastCode(phone) }).expect(400);
    });

    it('refuses a country that is not open, and a language not switched on', async () => {
      const base = { ...details, phone: newPhone(), email: newEmail(), signUpWith: 'SMS', otp: '123456' };
      const country = await api().post('/v1/auth/register').send({ ...base, countryCode: 'GH' }).expect(400);
      expect(country.body.code).toBe('COUNTRY_NOT_AVAILABLE');
      const language = await api().post('/v1/auth/register').send({ ...base, language: 'yo' }).expect(400);
      expect(language.body.code).toBe('LANGUAGE_NOT_AVAILABLE');
    });

    it('refuses a phone number or email address another account has confirmed', async () => {
      const taken = await register();
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const res = await api()
        .post('/v1/auth/register')
        .send({ ...details, phone, email: taken.email.toUpperCase(), signUpWith: 'SMS', otp: lastCode(phone) })
        .expect(409);
      expect(res.body.code).toBe('EMAIL_TAKEN');
    });

    it('refuses an unconfirmed contact that another account already holds', async () => {
      const holder = await register({ confirmBoth: false }); // holds its email unconfirmed
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'REGISTER' }).expect(202);
      const res = await api()
        .post('/v1/auth/register')
        .send({ ...details, phone, email: holder.email, signUpWith: 'SMS', otp: lastCode(phone) })
        .expect(409);
      expect(res.body.code).toBe('EMAIL_TAKEN');
    });

    it('releases a contact from an account that never confirmed it, when someone else confirms it', async () => {
      // A types an email address without confirming it; its real owner then registers with it, confirmed.
      const a = await register({ confirmBoth: false });
      await api().post('/v1/auth/otp').send({ email: a.email, purpose: 'REGISTER' }).expect(202);
      const owner = await api()
        .post('/v1/auth/register')
        .send({ ...details, phone: newPhone(), email: a.email, signUpWith: 'EMAIL', otp: lastCode(a.email) })
        .expect(201);
      expect(owner.body.user).toMatchObject({ email: a.email, emailConfirmed: true });

      const me = await api().get('/v1/me').set(bearer(a.session.accessToken)).expect(200);
      expect(me.body).toMatchObject({ email: null, emailConfirmed: false, verificationLevel: 0, next: { action: 'CONFIRM_EMAIL' } });
      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'contact.released', entityId: a.session.user.id } });
      expect(log.metadata).toMatchObject({ channel: 'EMAIL' });
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
        const otp = await api().post('/v1/auth/otp').set('X-City', city.id).send({ email: newEmail(), purpose: 'REGISTER' }).expect(403);
        expect(otp.body).toMatchObject({ code: 'FEATURE_UNAVAILABLE', feature: 'platform.new_registrations' });
        await api()
          .post('/v1/auth/register')
          .set('X-City', city.id)
          .send({ ...details, phone: newPhone(), email: newEmail(), signUpWith: 'SMS', otp: '123456' })
          .expect(403);
        await api().post('/v1/auth/otp').send({ phone: newPhone(), purpose: 'REGISTER' }).expect(202);
      } finally {
        await prisma.featureRule.update({ where: { id: rule.id }, data: { status: 'ARCHIVED' } });
        controls.invalidate();
      }
    });
  });

  describe('confirming and changing contacts (ADR 0006)', () => {
    it('says when a contact is already confirmed', async () => {
      const { phone, session } = await register();
      const res = await api().post('/v1/me/contacts/code').set(bearer(session.accessToken)).send({ channel: 'SMS', value: phone }).expect(409);
      expect(res.body.code).toBe('ALREADY_CONFIRMED');
    });

    it('changes a confirmed email only with the password and a code to the new address, and tells the old address', async () => {
      const { email: oldEmail, session } = await register();
      const newAddress = newEmail();
      const t = session.accessToken;

      await api().post('/v1/me/contacts/code').set(bearer(t)).send({ channel: 'EMAIL', value: newAddress }).expect(202);
      const code = lastCode(newAddress)!;
      const noPassword = await api().post('/v1/me/contacts/confirm').set(bearer(t)).send({ channel: 'EMAIL', value: newAddress, code }).expect(400);
      expect(noPassword.body.code).toBe('PASSWORD_REQUIRED');
      const wrongPassword = await api()
        .post('/v1/me/contacts/confirm')
        .set(bearer(t))
        .send({ channel: 'EMAIL', value: newAddress, code, currentPassword: 'not my password' })
        .expect(401);
      expect(wrongPassword.body.code).toBe('WRONG_PASSWORD');

      const done = await api()
        .post('/v1/me/contacts/confirm')
        .set(bearer(t))
        .send({ channel: 'EMAIL', value: newAddress, code, currentPassword: PASSWORD })
        .expect(200);
      expect(done.body).toMatchObject({ email: newAddress, emailConfirmed: true, verificationLevel: 1 });
      const notice = mail.messagesTo(oldEmail).at(-1)!;
      expect(notice.subject).toBe('Your FindHouseQuick email address was changed');
      expect(await prisma.auditLog.count({ where: { action: 'contact.changed', actorId: session.user.id } })).toBe(1);

      // The old address no longer signs in; the new one does.
      await api().post('/v1/auth/login').send({ email: oldEmail, password: PASSWORD }).expect(401);
      await api().post('/v1/auth/login').send({ email: newAddress, password: PASSWORD }).expect(200);
    });

    it('does not send a code for a contact another account has confirmed, and refuses to take it', async () => {
      const other = await register();
      const { session } = await register();
      const before = sentTo(other.phone).length;
      await api().post('/v1/me/contacts/code').set(bearer(session.accessToken)).send({ channel: 'SMS', value: other.phone }).expect(202);
      expect(sentTo(other.phone)).toHaveLength(before);
      await api()
        .post('/v1/me/contacts/confirm')
        .set(bearer(session.accessToken))
        .send({ channel: 'SMS', value: other.phone, code: '123456', currentPassword: PASSWORD })
        .expect(400);
    });

    it('no longer changes the email through PATCH /me', async () => {
      const { session } = await register();
      await api().patch('/v1/me').set(bearer(session.accessToken)).send({ email: newEmail() }).expect(400);
    });
  });

  describe('sign-in (decision 35)', () => {
    it('signs in with phone and password, or email and password', async () => {
      const { phone, email } = await register();
      const res = await api().post('/v1/auth/login').send({ phone, password: PASSWORD, device: 'Test phone' }).expect(200);
      expect(res.body.user.phone).toBe(phone);
      const token = await prisma.refreshToken.findFirstOrThrow({ where: { userId: res.body.user.id, device: 'Test phone' } });
      expect(token.tokenHash).not.toBe(res.body.refreshToken);
      expect(token.signInMethod).toBe('PASSWORD');
      await api().post('/v1/auth/login').send({ email: email.toUpperCase(), password: PASSWORD }).expect(200);
    });

    it('signs in with a code by SMS or by email', async () => {
      const { phone, email, session } = await register();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'LOGIN' }).expect(202);
      const bySms = await api().post('/v1/auth/login').send({ phone, otp: lastCode(phone) }).expect(200);
      await api().post('/v1/auth/otp').send({ email, purpose: 'LOGIN' }).expect(202);
      const byEmail = await api().post('/v1/auth/login').send({ email, otp: lastCode(email), device: 'Email device' }).expect(200);
      expect([bySms.body.user.id, byEmail.body.user.id]).toEqual([session.user.id, session.user.id]);
      const t = await prisma.refreshToken.findFirstOrThrow({ where: { userId: session.user.id, device: 'Email device' } });
      expect(t.signInMethod).toBe('EMAIL_CODE');
    });

    it('never signs in with a code through a contact the account has not confirmed', async () => {
      const { email } = await register({ confirmBoth: false });
      // Even a code record for that address cannot be used (none is sent; a guessed one is refused).
      await api().post('/v1/auth/otp').send({ email, purpose: 'LOGIN' }).expect(202);
      await api().post('/v1/auth/login').send({ email, otp: '123456' }).expect(401);
    });

    it('signs in with the number written another way', async () => {
      const { phone, session } = await register();
      const res = await api().post('/v1/auth/login').send({ phone: writtenDifferently(phone), password: PASSWORD }).expect(200);
      expect(res.body.user.id).toBe(session.user.id);
    });

    it('gives the same answer for a wrong password and an unknown contact', async () => {
      const { phone } = await register();
      const a = await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      const b = await api().post('/v1/auth/login').send({ phone: newPhone(), password: 'wrong password!' }).expect(401);
      const c = await api().post('/v1/auth/login').send({ email: newEmail(), password: 'wrong password!' }).expect(401);
      expect(a.body).toEqual(b.body);
      expect(b.body).toEqual(c.body);
    });

    it('needs exactly one contact and exactly one of password or code', async () => {
      const { phone, email } = await register();
      await api().post('/v1/auth/login').send({ phone }).expect(400);
      await api().post('/v1/auth/login').send({ phone, password: PASSWORD, otp: '123456' }).expect(400);
      await api().post('/v1/auth/login').send({ phone, email, password: PASSWORD }).expect(400);
      await api().post('/v1/auth/login').send({ password: PASSWORD }).expect(400);
    });

    it('pauses password sign-in after five wrong passwords, but codes still work', async () => {
      const { phone, email } = await register();
      for (let i = 0; i < 5; i++) await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      const locked = await api().post('/v1/auth/login').send({ email, password: PASSWORD }).expect(429);
      expect(locked.body.code).toBe('PASSWORD_LOCKED');
      await api().post('/v1/auth/otp').send({ email, purpose: 'LOGIN' }).expect(202);
      await api().post('/v1/auth/login').send({ email, otp: lastCode(email) }).expect(200);
      expect(await prisma.auditLog.count({ where: { action: 'auth.password_locked' } })).toBeGreaterThan(0);
    });

    it('counts every password attempt even when many arrive at the same moment', async () => {
      const { phone } = await register();
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) => api().post('/v1/auth/login').send({ phone, password: `wrong password ${i}` })),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 401)).toHaveLength(5);
      expect(statuses.filter((s) => s === 429)).toHaveLength(15);
      const locked = await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(429);
      expect(locked.body.code).toBe('PASSWORD_LOCKED');
    });

    it('starts counting again after a correct password', async () => {
      const { phone } = await register();
      for (let i = 0; i < 4; i++) await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
      for (let i = 0; i < 4; i++) await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
    });

    it('allows password sign-in again once the pause has run out', async () => {
      const { phone } = await register();
      for (let i = 0; i < 5; i++) await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(429);
      await prisma.$executeRaw`UPDATE "User" SET "passwordLockedUntil" = (now() AT TIME ZONE 'UTC') - interval '1 second' WHERE "phone" = ${phone}`;
      await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
      const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
      expect(user).toMatchObject({ failedPasswordCount: 0, passwordLockedUntil: null });
    });

    it('refuses suspended accounts, including sessions already signed in', async () => {
      const { phone, session } = await register();
      await prisma.user.update({ where: { phone }, data: { status: 'SUSPENDED' } });
      const login = await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(403);
      expect(login.body.code).toBe('ACCOUNT_SUSPENDED');
      const me = await api().get('/v1/me').set(bearer(session.accessToken)).expect(403);
      expect(me.body.code).toBe('ACCOUNT_SUSPENDED');
      await api().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    });
  });

  describe('password reset (decision 36: by SMS or email, as the user chooses)', () => {
    it('sets a new password with an SMS code and signs out every device', async () => {
      const { phone, session } = await register();
      const laptop = await api().post('/v1/auth/login').send({ phone, password: PASSWORD, device: 'Laptop' }).expect(200);

      await api().post('/v1/auth/otp').send({ phone, purpose: 'RESET_PASSWORD' }).expect(202);
      await api().post('/v1/auth/password-reset').send({ phone, otp: lastCode(phone), newPassword: 'a brand new password' }).expect(204);

      for (const s of [session, laptop.body]) {
        const me = await api().get('/v1/me').set(bearer(s.accessToken)).expect(401);
        expect(me.body.code).toBe('SESSION_INVALID');
        await api().post('/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
      }
      await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(401);
      await api().post('/v1/auth/login').send({ phone, password: 'a brand new password' }).expect(200);
      expect(await prisma.auditLog.count({ where: { action: 'auth.password_reset', actorId: session.user.id } })).toBe(1);
    });

    it('sets a new password with an email code', async () => {
      const { email } = await register();
      await api().post('/v1/auth/otp').send({ email, purpose: 'RESET_PASSWORD' }).expect(202);
      await api().post('/v1/auth/password-reset').send({ email, otp: lastCode(email), newPassword: 'reset by email now' }).expect(204);
      await api().post('/v1/auth/login').send({ email, password: 'reset by email now' }).expect(200);
    });

    it('lifts a pause on password sign-in', async () => {
      const { phone } = await register();
      for (let i = 0; i < 5; i++) await api().post('/v1/auth/login').send({ phone, password: 'wrong password!' }).expect(401);
      await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(429);
      await api().post('/v1/auth/otp').send({ phone, purpose: 'RESET_PASSWORD' }).expect(202);
      await api().post('/v1/auth/password-reset').send({ phone, otp: lastCode(phone), newPassword: 'another new password' }).expect(204);
      await api().post('/v1/auth/login').send({ phone, password: 'another new password' }).expect(200);
    });

    it('refuses a wrong code and leaves the password unchanged', async () => {
      const { phone } = await register();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'RESET_PASSWORD' }).expect(202);
      const wrong = lastCode(phone) === '000000' ? '111111' : '000000';
      const res = await api().post('/v1/auth/password-reset').send({ phone, otp: wrong, newPassword: 'a brand new password' }).expect(400);
      expect(res.body.code).toBe('INVALID_CODE');
      await api().post('/v1/auth/login').send({ phone, password: PASSWORD }).expect(200);
    });

    it('does not send reset codes to unregistered contacts, and refuses a short new password', async () => {
      const phone = newPhone();
      await api().post('/v1/auth/otp').send({ phone, purpose: 'RESET_PASSWORD' }).expect(202);
      expect(sentTo(phone)).toHaveLength(0);
      await api().post('/v1/auth/password-reset').send({ phone, otp: '123456', newPassword: 'short' }).expect(400);
    });
  });

  describe('sessions', () => {
    it('needs sign-in for /me and explains why', async () => {
      const none = await api().get('/v1/me').expect(401);
      expect(none.body).toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' });
      await api().get('/v1/me').set('Authorization', 'Bearer not-a-token').expect(401);
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
      const res = await api().get('/v1/me').set(bearer(expired)).expect(401);
      expect(res.body.code).toBe('TOKEN_EXPIRED');
    });

    it('refreshes tokens once only, and signs the device out if an old token comes back', async () => {
      const { session } = await register();
      const first = await api().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(200);
      expect(first.body.refreshToken).not.toBe(session.refreshToken);
      await api().get('/v1/me').set(bearer(first.body.accessToken)).expect(200);
      await api().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
      await api().post('/v1/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
      const me = await api().get('/v1/me').set(bearer(first.body.accessToken)).expect(401);
      expect(me.body.code).toBe('SESSION_INVALID');
      expect(await prisma.auditLog.count({ where: { action: 'auth.refresh_token_reused', actorId: session.user.id } })).toBe(1);
    });

    it('signs out one device without affecting another', async () => {
      const { phone, session } = await register();
      const other = await api().post('/v1/auth/login').send({ phone, password: PASSWORD, device: 'Laptop' }).expect(200);
      await api().post('/v1/auth/logout').set(bearer(session.accessToken)).expect(204);
      await api().get('/v1/me').set(bearer(session.accessToken)).expect(401);
      await api().post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
      await api().get('/v1/me').set(bearer(other.body.accessToken)).expect(200);
    });
  });

  describe('/me', () => {
    it('shows the verification level and next step, rising as checks pass', async () => {
      const { session } = await register({ overrides: { types: ['AGENT'] } });
      const auth = bearer(session.accessToken);
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

    it('updates language and user types', async () => {
      const { session } = await register();
      const res = await api().patch('/v1/me').set(bearer(session.accessToken)).send({ language: 'pcm', types: ['TENANT', 'AGENT'] }).expect(200);
      expect(res.body).toMatchObject({ language: 'pcm', types: ['TENANT', 'AGENT'] });
    });

    it('refuses fields that cannot be changed here, and languages not switched on (decision 40)', async () => {
      const { session } = await register();
      const auth = bearer(session.accessToken);
      await api().patch('/v1/me').set(auth).send({ phone: '+2348000000000' }).expect(400);
      await api().patch('/v1/me').set(auth).send({ verificationLevel: 3 }).expect(400);
      await api().patch('/v1/me').set(auth).send({ language: 'yo' }).expect(400);
      await api().patch('/v1/me').set(auth).send({ types: [] }).expect(400);
    });
  });
});
