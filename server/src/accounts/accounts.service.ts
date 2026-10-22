import { Injectable } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { ControlsService } from '../controls/controls.service.js';
import type { EvaluationContext } from '../controls/feature-evaluator.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, RegisterDto, RequestOtpDto, ResetPasswordDto, UpdateMeDto } from './dto.js';
import { OtpService } from './otp.service.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './secrets.js';
import { SessionsService, type IssuedTokens } from './sessions.service.js';
import { nextStep, verificationLevel, type UserTypeName } from './verification-level.js';

/** Protection against password guessing on one account. */
export const PASSWORD_RULES = {
  /** Password attempts without a success before password sign-in pauses. Sign-in by SMS code still works. */
  maxFailures: 5,
  /** Minutes password sign-in stays paused. */
  lockMinutes: 15,
} as const;

const meSelect = {
  id: true,
  phone: true,
  email: true,
  firstName: true,
  lastName: true,
  countryCode: true,
  types: true,
  language: true,
  identityVerifiedAt: true,
  bankAccounts: { where: { status: 'PASSED' }, select: { id: true }, take: 1 },
} satisfies Prisma.UserSelect;

type MeRow = Prisma.UserGetPayload<{ select: typeof meSelect }>;

export interface Session {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  user: ReturnType<typeof toMe>;
}

/** The user as the apps see them: profile, verification level, and what to do next. */
export function toMe(u: MeRow) {
  const types = u.types as UserTypeName[];
  const level = verificationLevel({
    identityVerifiedAt: u.identityVerifiedAt,
    hasVerifiedBankAccount: u.bankAccounts.length > 0,
  });
  return {
    id: u.id,
    phone: u.phone,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    countryCode: u.countryCode,
    types,
    language: u.language,
    verificationLevel: level,
    next: nextStep(level, types),
  };
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionsService,
    private readonly controls: ControlsService,
  ) {}

  /** Sends a one-time code. The outcome looks the same whether or not the number is registered. */
  async requestOtp(dto: RequestOtpDto, ctx: EvaluationContext): Promise<void> {
    if (dto.purpose === 'REGISTER') await this.assertRegistrationsOpen(ctx);

    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone }, select: { status: true } });
    const deliver = dto.purpose === 'REGISTER' ? !user : user?.status === 'ACTIVE';
    await this.otp.issue(dto.phone, dto.purpose, deliver);
  }

  async register(dto: RegisterDto, ctx: EvaluationContext): Promise<Session> {
    await this.assertRegistrationsOpen({ ...ctx, countryCode: dto.countryCode });

    const country = await this.controls.findCountry(dto.countryCode);
    if (!country?.enabled) {
      throw apiError(400, 'COUNTRY_NOT_AVAILABLE', 'FindHouseQuick is not open in this country yet.');
    }
    const language = dto.language ?? country.defaultLanguage;
    await this.assertLanguageOffered(language, country.languages, { ...ctx, countryCode: dto.countryCode });

    if (!(await this.otp.consume(dto.phone, 'REGISTER', dto.otp))) {
      throw apiError(400, 'INVALID_CODE', 'The code is wrong or has expired. Please request a new one.');
    }

    const now = new Date();
    let user: MeRow;
    try {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          phoneVerifiedAt: now,
          email: dto.email ?? null,
          passwordHash: await hashPassword(dto.password),
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
    } catch (err) {
      throw this.duplicateError(err) ?? err;
    }
    return this.session(user, await this.sessions.start(user.id, null));
  }

  async login(dto: LoginDto): Promise<Session> {
    if (!!dto.password === !!dto.otp) {
      throw apiError(400, 'BAD_REQUEST', 'Give either a password or an SMS code.');
    }
    const wrong = () => apiError(401, 'WRONG_CREDENTIALS', 'The phone number, password or code is not correct.');
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { ...meSelect, status: true, passwordHash: true },
    });

    if (dto.otp) {
      if (!(await this.otp.consume(dto.phone, 'LOGIN', dto.otp)) || !user) throw wrong();
    } else {
      if (!user) {
        // Same work as a real check, so an unknown number takes as long to refuse as a wrong password.
        await verifyPassword(dto.password!, DUMMY_PASSWORD_HASH);
        throw wrong();
      }
      const attempt = await this.claimPasswordAttempt(user.id);
      if (attempt === null) {
        throw apiError(
          429,
          'PASSWORD_LOCKED',
          'Too many wrong passwords. Please wait a few minutes, or sign in with an SMS code.',
        );
      }
      if (!(await verifyPassword(dto.password!, user.passwordHash))) {
        if (attempt >= PASSWORD_RULES.maxFailures) {
          await this.prisma.auditLog.create({
            data: { actorId: null, action: 'auth.password_locked', entityType: 'User', entityId: user.id },
          });
        }
        throw wrong();
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedPasswordCount: 0, passwordLockedUntil: null },
      });
    }

    if (user.status === 'DELETED') throw wrong();
    if (user.status !== 'ACTIVE') {
      throw apiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended. Please contact support.');
    }
    return this.session(user, await this.sessions.start(user.id, dto.device ?? null));
  }

  /**
   * Sets a new password using an SMS code, then signs the user out of every device, so anyone who had the
   * old password or a stolen session is shut out. Also lifts any pause on password sign-in.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    if (!(await this.otp.consume(dto.phone, 'RESET_PASSWORD', dto.otp))) {
      throw apiError(400, 'INVALID_CODE', 'The code is wrong or has expired. Please request a new one.');
    }
    // A reset code is only ever sent to an active account, so a missing account here is treated the same way.
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone }, select: { id: true, status: true } });
    if (!user || user.status === 'DELETED') {
      throw apiError(400, 'INVALID_CODE', 'The code is wrong or has expired. Please request a new one.');
    }
    if (user.status !== 'ACTIVE') {
      throw apiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended. Please contact support.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(dto.newPassword), failedPasswordCount: 0, passwordLockedUntil: null },
    });
    await this.sessions.endAllForUser(user.id);
    await this.prisma.auditLog.create({
      data: { actorId: user.id, action: 'auth.password_reset', entityType: 'User', entityId: user.id },
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
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, countryCode: true },
    });
    const data: Prisma.UserUpdateInput = {};
    if (dto.language !== undefined) {
      const country = await this.controls.findCountry(current.countryCode);
      await this.assertLanguageOffered(dto.language, country?.languages ?? [], { ...ctx, countryCode: current.countryCode });
      data.language = dto.language;
    }
    if (dto.types !== undefined) data.types = dto.types;
    if (dto.email !== undefined && dto.email !== current.email) {
      data.email = dto.email;
      data.emailVerifiedAt = null; // A new address has not been confirmed yet.
    }
    try {
      return toMe(await this.prisma.user.update({ where: { id: userId }, data, select: meSelect }));
    } catch (err) {
      throw this.duplicateError(err) ?? err;
    }
  }

  private session(user: MeRow, tokens: IssuedTokens): Session {
    return { ...tokens, user: toMe(user) };
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

  /** Turns a database "already exists" error into a clear 409. */
  private duplicateError(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = JSON.stringify(err.meta ?? {});
      if (target.includes('email')) {
        return apiError(409, 'EMAIL_TAKEN', 'This email address is already used by another account.');
      }
      return apiError(409, 'PHONE_TAKEN', 'This phone number is already registered. Please sign in instead.');
    }
    return null;
  }
}
