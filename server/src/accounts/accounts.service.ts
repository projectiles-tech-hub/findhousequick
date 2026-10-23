import { Injectable } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { ControlsService } from '../controls/controls.service.js';
import type { EvaluationContext } from '../controls/feature-evaluator.js';
import { Prisma, type SignInMethod } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { contactOf, oneContact, type Channel, type Contact } from './contact.js';
import type { ContactCodeDto, ContactConfirmDto, LoginDto, RegisterDto, RequestOtpDto, ResetPasswordDto, UpdateMeDto } from './dto.js';
import { OtpService } from './otp.service.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './secrets.js';
import { SessionsService, type IssuedTokens } from './sessions.service.js';
import type { UserTypeName } from './verification-level.js';
import { ladderOf, ladderSelect } from './verification.guard.js';

/** Protection against password guessing on one account. */
export const PASSWORD_RULES = {
  /** Password attempts without a success before password sign-in pauses. Sign-in by code still works. */
  maxFailures: 5,
  /** Minutes password sign-in stays paused. */
  lockMinutes: 15,
} as const;

const meSelect = {
  ...ladderSelect,
  id: true,
  firstName: true,
  lastName: true,
  countryCode: true,
  language: true,
} satisfies Prisma.UserSelect;

type MeRow = Prisma.UserGetPayload<{ select: typeof meSelect }>;

export interface Session {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  user: ReturnType<typeof toMe>;
}

/** The user as the apps see them: profile, which contacts are confirmed, verification level, and what to do next. */
export function toMe(u: MeRow) {
  const { level, contacts, next } = ladderOf(u);
  return {
    id: u.id,
    phone: u.phone,
    phoneConfirmed: contacts.phoneConfirmed,
    email: u.email,
    emailConfirmed: contacts.emailConfirmed,
    firstName: u.firstName,
    lastName: u.lastName,
    countryCode: u.countryCode,
    types: u.types as UserTypeName[],
    language: u.language,
    verificationLevel: level,
    next,
  };
}

const LABEL: Record<Channel, string> = { SMS: 'phone number', EMAIL: 'email address' };
const signInMethodFor = (c: Contact): SignInMethod => (c.channel === 'SMS' ? 'SMS_CODE' : 'EMAIL_CODE');

/** The account holding a phone number or email address, if any, and whether it has confirmed it. */
interface Holder {
  id: string;
  status: string;
  confirmed: boolean;
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionsService,
    private readonly controls: ControlsService,
  ) {}

  /**
   * Sends a one-time code to a phone number or email address. The outcome looks the same whether or not it is
   * registered. Sign-in and reset codes go only to a contact an active account has confirmed, so a mistyped
   * address can never be used to get into someone else's account (ADR 0006).
   */
  async requestOtp(dto: RequestOtpDto, ctx: EvaluationContext): Promise<void> {
    const contact = oneContact(dto);
    if (dto.purpose === 'REGISTER') await this.assertRegistrationsOpen(ctx);
    const holder = await this.holderOf(contact);
    const deliver =
      dto.purpose === 'REGISTER' ? !holder?.confirmed : !!holder?.confirmed && holder.status === 'ACTIVE';
    await this.otp.issue(contact, dto.purpose, deliver);
  }

  /**
   * Registers a user (decision 35). Phone and email are both required; the one named in `signUpWith` is
   * confirmed by the code now, and the other is confirmed afterwards through /me/contacts.
   *
   * If another account holds the confirmed contact without having confirmed it, the contact is released from
   * that account, so nobody can block a phone number or email address by typing it first. A contact another
   * account has confirmed cannot be taken. The other, unconfirmed contact must not be held by anyone.
   */
  async register(dto: RegisterDto, ctx: EvaluationContext): Promise<Session> {
    await this.assertRegistrationsOpen({ ...ctx, countryCode: dto.countryCode });

    const country = await this.controls.findCountry(dto.countryCode);
    if (!country?.enabled) {
      throw apiError(400, 'COUNTRY_NOT_AVAILABLE', 'FindHouseQuick is not open in this country yet.');
    }
    const language = dto.language ?? country.defaultLanguage;
    await this.assertLanguageOffered(language, country.languages, { ...ctx, countryCode: dto.countryCode });

    const confirmed: Contact = dto.signUpWith === 'SMS' ? { channel: 'SMS', destination: dto.phone } : { channel: 'EMAIL', destination: dto.email };
    const other: Contact = dto.signUpWith === 'SMS' ? { channel: 'EMAIL', destination: dto.email } : { channel: 'SMS', destination: dto.phone };

    if (!(await this.otp.consume(confirmed, 'REGISTER', dto.otp))) {
      throw apiError(400, 'INVALID_CODE', 'The code is wrong or has expired. Please request a new one.');
    }

    const now = new Date();
    const passwordHash = await hashPassword(dto.password);
    let user: MeRow;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        await this.claimConfirmed(tx, confirmed, null);
        if (await this.holderOf(other, tx)) throw this.takenError(other);
        return tx.user.create({
          data: {
            phone: dto.phone,
            phoneVerifiedAt: confirmed.channel === 'SMS' ? now : null,
            email: dto.email,
            emailVerifiedAt: confirmed.channel === 'EMAIL' ? now : null,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            countryCode: dto.countryCode,
            types: dto.types,
            language,
            termsVersion: dto.consent.termsVersion,
            privacyVersion: dto.consent.privacyVersion,
            consentedAt: now,
          },
          select: meSelect,
        });
      });
    } catch (err) {
      throw this.duplicateError(err) ?? err;
    }
    // Registering uses a code, so the new device counts as signed in by that channel (decision 36).
    return this.session(user, await this.sessions.start(user.id, null, signInMethodFor(confirmed)));
  }

  /** Signs in with a phone number or email address, and a password or a code sent to it (decision 35). */
  async login(dto: LoginDto): Promise<Session> {
    const contact = oneContact(dto);
    if (!!dto.password === !!dto.otp) {
      throw apiError(400, 'BAD_REQUEST', 'Give either a password or a code.');
    }
    const wrong = () =>
      apiError(401, 'WRONG_CREDENTIALS', 'The phone number or email address, password or code is not correct.');
    const user = await this.prisma.user.findUnique({
      where: contact.channel === 'SMS' ? { phone: contact.destination } : { email: contact.destination },
      select: { ...meSelect, status: true, passwordHash: true },
    });

    if (dto.otp) {
      if (!(await this.otp.consume(contact, 'LOGIN', dto.otp)) || !user) throw wrong();
      // A code only signs in through a contact the account has confirmed (ADR 0006).
      const confirmedAt = contact.channel === 'SMS' ? user.phoneVerifiedAt : user.emailVerifiedAt;
      if (!confirmedAt) throw wrong();
    } else {
      if (!user) {
        // Same work as a real check, so an unknown contact takes as long to refuse as a wrong password.
        await verifyPassword(dto.password!, DUMMY_PASSWORD_HASH);
        throw wrong();
      }
      await this.checkPassword(user.id, user.passwordHash, dto.password!, wrong);
    }

    if (user.status === 'DELETED') throw wrong();
    if (user.status !== 'ACTIVE') {
      throw apiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended. Please contact support.');
    }
    const method: SignInMethod = dto.otp ? signInMethodFor(contact) : 'PASSWORD';
    return this.session(user, await this.sessions.start(user.id, dto.device ?? null, method));
  }

  /**
   * Sets a new password using a code sent by SMS or email, as the user chooses (decision 36), then signs the
   * user out of every device, so anyone who had the old password or a stolen session is shut out. Also lifts
   * any pause on password sign-in.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const contact = oneContact(dto);
    const invalid = () => apiError(400, 'INVALID_CODE', 'The code is wrong or has expired. Please request a new one.');
    if (!(await this.otp.consume(contact, 'RESET_PASSWORD', dto.otp))) throw invalid();
    // A reset code is only ever sent to a contact an active account has confirmed; anything else is refused alike.
    const holder = await this.holderOf(contact);
    if (!holder?.confirmed || holder.status === 'DELETED') throw invalid();
    if (holder.status !== 'ACTIVE') {
      throw apiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended. Please contact support.');
    }
    await this.prisma.user.update({
      where: { id: holder.id },
      data: { passwordHash: await hashPassword(dto.newPassword), failedPasswordCount: 0, passwordLockedUntil: null },
    });
    await this.sessions.endAllForUser(holder.id);
    await this.prisma.auditLog.create({
      data: { actorId: holder.id, action: 'auth.password_reset', entityType: 'User', entityId: holder.id, metadata: { channel: contact.channel } },
    });
  }

  async refresh(refreshToken: string): Promise<Session> {
    const { userId, ...tokens } = await this.sessions.refresh(refreshToken);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: meSelect });
    return this.session(user, tokens);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.endFamily(sessionId);
  }

  async me(userId: string) {
    return toMe(await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: meSelect }));
  }

  async updateMe(userId: string, dto: UpdateMeDto, ctx: EvaluationContext) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { countryCode: true } });
    const data: Prisma.UserUpdateInput = {};
    if (dto.language !== undefined) {
      const country = await this.controls.findCountry(current.countryCode);
      await this.assertLanguageOffered(dto.language, country?.languages ?? [], { ...ctx, countryCode: current.countryCode });
      data.language = dto.language;
    }
    if (dto.types !== undefined) data.types = dto.types;
    return toMe(await this.prisma.user.update({ where: { id: userId }, data, select: meSelect }));
  }

  /**
   * Sends a code to confirm a phone number or email address: the one already on the account, or a new one to
   * replace it (ADR 0006). The answer is the same whether or not another account has the contact; the code is
   * only sent if the contact is free to be confirmed here.
   */
  async sendContactCode(userId: string, dto: ContactCodeDto): Promise<void> {
    const contact = contactOf(dto.channel, dto.value);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: meSelect });
    const [current, confirmedAt] = dto.channel === 'SMS' ? [user.phone, user.phoneVerifiedAt] : [user.email, user.emailVerifiedAt];
    if (current === contact.destination && confirmedAt) {
      throw apiError(409, 'ALREADY_CONFIRMED', `This ${LABEL[contact.channel]} is already confirmed.`);
    }
    const holder = await this.holderOf(contact);
    const deliver = !holder || holder.id === userId || !holder.confirmed;
    await this.otp.issue(contact, 'CONFIRM_CONTACT', deliver);
  }

  /**
   * Confirms a phone number or email address with its code, putting it on the account if it is new. Replacing a
   * contact that is already confirmed needs the current password, and the old contact is told about the change,
   * so someone with only a stolen session cannot quietly take the account over.
   */
  async confirmContact(userId: string, dto: ContactConfirmDto) {
    const contact = contactOf(dto.channel, dto.value);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { ...meSelect, passwordHash: true },
    });
    const [current, confirmedAt] = dto.channel === 'SMS' ? [user.phone, user.phoneVerifiedAt] : [user.email, user.emailVerifiedAt];
    if (current === contact.destination && confirmedAt) {
      throw apiError(409, 'ALREADY_CONFIRMED', `This ${LABEL[contact.channel]} is already confirmed.`);
    }
    const replacingConfirmed = !!current && !!confirmedAt && current !== contact.destination;
    if (replacingConfirmed) {
      if (!dto.currentPassword) {
        throw apiError(400, 'PASSWORD_REQUIRED', `Enter your password to change your ${LABEL[contact.channel]}.`);
      }
      await this.checkPassword(user.id, user.passwordHash, dto.currentPassword, () =>
        apiError(401, 'WRONG_PASSWORD', 'The password is not correct.'),
      );
    }
    if (!(await this.otp.consume(contact, 'CONFIRM_CONTACT', dto.code))) {
      throw apiError(400, 'INVALID_CODE', 'The code is wrong or has expired. Please request a new one.');
    }

    let updated: MeRow;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await this.claimConfirmed(tx, contact, userId);
        const now = new Date();
        const data: Prisma.UserUpdateInput =
          contact.channel === 'SMS' ? { phone: contact.destination, phoneVerifiedAt: now } : { email: contact.destination, emailVerifiedAt: now };
        const u = await tx.user.update({ where: { id: userId }, data, select: meSelect });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: current && current !== contact.destination ? 'contact.changed' : 'contact.confirmed',
            entityType: 'User',
            entityId: userId,
            metadata: { channel: contact.channel },
          },
        });
        return u;
      });
    } catch (err) {
      throw this.duplicateError(err) ?? err;
    }

    if (replacingConfirmed) {
      const label = LABEL[contact.channel];
      await this.otp.notify(
        { channel: contact.channel, destination: current! },
        `Your FindHouseQuick ${label} was changed`,
        `The ${label} on your FindHouseQuick account was changed. If you did not do this, contact FindHouseQuick support at once.`,
      );
    }
    return toMe(updated);
  }

  private session(user: MeRow, tokens: IssuedTokens): Session {
    return { ...tokens, user: toMe(user) };
  }

  /** The account holding a contact, if any. */
  private async holderOf(contact: Contact, db: Prisma.TransactionClient = this.prisma): Promise<Holder | null> {
    if (contact.channel === 'SMS') {
      const u = await db.user.findUnique({ where: { phone: contact.destination }, select: { id: true, status: true, phoneVerifiedAt: true } });
      return u ? { id: u.id, status: u.status, confirmed: !!u.phoneVerifiedAt } : null;
    }
    const u = await db.user.findUnique({ where: { email: contact.destination }, select: { id: true, status: true, emailVerifiedAt: true } });
    return u ? { id: u.id, status: u.status, confirmed: !!u.emailVerifiedAt } : null;
  }

  /**
   * Makes a just-confirmed contact free for `forUserId` (null for a new registration): refuses if another account
   * has confirmed it, and releases it from another account that holds it unconfirmed. Runs inside a transaction,
   * with the row locked so two confirmations at the same moment cannot both succeed.
   */
  private async claimConfirmed(tx: Prisma.TransactionClient, contact: Contact, forUserId: string | null): Promise<void> {
    const rows =
      contact.channel === 'SMS'
        ? await tx.$queryRaw<{ id: string; confirmed: boolean }[]>`
            SELECT "id", ("phoneVerifiedAt" IS NOT NULL) AS "confirmed" FROM "User" WHERE "phone" = ${contact.destination} FOR UPDATE`
        : await tx.$queryRaw<{ id: string; confirmed: boolean }[]>`
            SELECT "id", ("emailVerifiedAt" IS NOT NULL) AS "confirmed" FROM "User" WHERE "email" = ${contact.destination} FOR UPDATE`;
    const holder = rows[0];
    if (!holder || holder.id === forUserId) return;
    if (holder.confirmed) throw this.takenError(contact);
    await tx.user.update({
      where: { id: holder.id },
      data: contact.channel === 'SMS' ? { phone: null, phoneVerifiedAt: null } : { email: null, emailVerifiedAt: null },
    });
    await tx.auditLog.create({
      data: {
        actorId: forUserId,
        action: 'contact.released',
        entityType: 'User',
        entityId: holder.id,
        metadata: { channel: contact.channel, reason: 'confirmed by another account' },
      },
    });
  }

  /** Counts a password attempt, then checks it (see claimPasswordAttempt). Throws `wrong()` if incorrect. */
  private async checkPassword(userId: string, hash: string, password: string, wrong: () => Error): Promise<void> {
    const attempt = await this.claimPasswordAttempt(userId);
    if (attempt === null) {
      throw apiError(429, 'PASSWORD_LOCKED', 'Too many wrong passwords. Please wait a few minutes, or sign in with a code.');
    }
    if (!(await verifyPassword(password, hash))) {
      if (attempt >= PASSWORD_RULES.maxFailures) {
        await this.prisma.auditLog.create({
          data: { actorId: null, action: 'auth.password_locked', entityType: 'User', entityId: userId },
        });
      }
      throw wrong();
    }
    await this.prisma.user.update({ where: { id: userId }, data: { failedPasswordCount: 0, passwordLockedUntil: null } });
  }

  /**
   * Takes one password attempt for a user, or returns null while password sign-in is paused.
   *
   * The check and the count are ONE database statement, so many guesses sent at the same moment cannot
   * all get past the limit: the database handles one such statement on a user at a time. The attempt that
   * reaches the limit also starts the pause in that same statement, so there is never a moment when the
   * limit is used up but the pause has not started. Once a pause has run out, counting starts again at 1.
   * A correct password sets the count back to 0.
   *
   * Returns the attempt number (1 for the first attempt since the last success).
   */
  private async claimPasswordAttempt(userId: string): Promise<number | null> {
    const { maxFailures, lockMinutes } = PASSWORD_RULES;
    const rows = await this.prisma.$queryRaw<{ attempt: number }[]>`
      UPDATE "User"
         SET "failedPasswordCount" =
               CASE WHEN "passwordLockedUntil" IS NOT NULL THEN 1 ELSE "failedPasswordCount" + 1 END,
             "passwordLockedUntil" =
               CASE WHEN (CASE WHEN "passwordLockedUntil" IS NOT NULL THEN 1 ELSE "failedPasswordCount" + 1 END) >= ${maxFailures}::int
                    THEN (now() AT TIME ZONE 'UTC') + make_interval(mins => ${lockMinutes}::int)
                    ELSE NULL END
       WHERE "id" = ${userId}::uuid
         AND ("passwordLockedUntil" IS NULL OR "passwordLockedUntil" <= (now() AT TIME ZONE 'UTC'))
      RETURNING "failedPasswordCount" AS "attempt"`;
    return rows.length === 1 ? Number(rows[0].attempt) : null;
  }

  private async assertRegistrationsOpen(ctx: EvaluationContext): Promise<void> {
    if (!(await this.controls.isEnabled('platform.new_registrations', ctx))) {
      throw apiError(403, 'FEATURE_UNAVAILABLE', 'New registrations are paused at the moment. Please try again later.', {
        feature: 'platform.new_registrations',
      });
    }
  }

  private async assertLanguageOffered(language: string, offered: readonly string[], ctx: EvaluationContext): Promise<void> {
    const key = `language.${language}`;
    const switchedOn = (await this.controls.evaluateAll(ctx))[key] === true;
    if (!offered.includes(language) || !switchedOn) {
      throw apiError(400, 'LANGUAGE_NOT_AVAILABLE', 'That language is not offered in this country yet.');
    }
  }

  private takenError(contact: Pick<Contact, 'channel'>) {
    return contact.channel === 'EMAIL'
      ? apiError(409, 'EMAIL_TAKEN', 'This email address is already used by another account.')
      : apiError(409, 'PHONE_TAKEN', 'This phone number is already used by another account.');
  }

  /** Turns a database "already exists" error into a clear 409. */
  private duplicateError(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = JSON.stringify(err.meta ?? {});
      return this.takenError({ channel: target.includes('email') ? 'EMAIL' : 'SMS' });
    }
    return null;
  }
}
