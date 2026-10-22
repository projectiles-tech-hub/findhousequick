import { Injectable } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { ControlsService } from '../controls/controls.service.js';
import type { EvaluationContext } from '../controls/feature-evaluator.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, RegisterDto, RequestOtpDto, UpdateMeDto } from './dto.js';
import { OtpService } from './otp.service.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './secrets.js';
import { SessionsService, type IssuedTokens } from './sessions.service.js';
import { nextStep, verificationLevel, type UserTypeName } from './verification-level.js';

/** Protection against password guessing on one account. */
export const PASSWORD_RULES = {
  /** Wrong passwords in a row before password sign-in pauses. Sign-in by SMS code still works. */
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
    if (dto.purpose === 'RESET_PASSWORD') {
      // The design lists this purpose, but there is no reset endpoint in docs/api/openapi.yaml yet,
      // so a code sent now could not be used. Refused until that endpoint is designed and built.
      throw apiError(400, 'NOT_AVAILABLE_YET', 'Password reset is not available yet. Please sign in with an SMS code.');
    }
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
      select: { ...meSelect, status: true, passwordHash: true, failedPasswordCount: true, passwordLockedUntil: true },
    });

    if (dto.otp) {
      if (!(await this.otp.consume(dto.phone, 'LOGIN', dto.otp)) || !user) throw wrong();
    } else {
      if (user?.passwordLockedUntil && user.passwordLockedUntil.getTime() > Date.now()) {
        throw apiError(
          429,
          'PASSWORD_LOCKED',
          'Too many wrong passwords. Please wait a few minutes, or sign in with an SMS code.',
        );
      }
      // Check against a dummy hash when there is no such user, so the answer takes the same time.
      const ok = await verifyPassword(dto.password!, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
      if (!user || !ok) {
        if (user) await this.recordWrongPassword(user.id, user.failedPasswordCount);
        throw wrong();
      }
      if (user.failedPasswordCount > 0 || user.passwordLockedUntil) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedPasswordCount: 0, passwordLockedUntil: null },
        });
      }
    }

    if (user.status === 'DELETED') throw wrong();
    if (user.status !== 'ACTIVE') {
      throw apiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended. Please contact support.');
    }
    return this.session(user, await this.sessions.start(user.id, dto.device ?? null));
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

  private async recordWrongPassword(userId: string, failuresSoFar: number): Promise<void> {
    const failures = failuresSoFar + 1;
    const lock = failures >= PASSWORD_RULES.maxFailures;
    await this.prisma.user.update({
      where: { id: userId },
      data: lock
        ? { failedPasswordCount: 0, passwordLockedUntil: new Date(Date.now() + PASSWORD_RULES.lockMinutes * 60_000) }
        : { failedPasswordCount: failures },
    });
    if (lock) {
      await this.prisma.auditLog.create({
        data: { actorId: null, action: 'auth.password_locked', entityType: 'User', entityId: userId },
      });
    }
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
