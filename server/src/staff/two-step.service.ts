import { Injectable } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { FieldEncryption } from '../common/field-encryption.js';
import { OtpService } from '../accounts/otp.service.js';
import { SessionsService } from '../accounts/sessions.service.js';
import type { RequestUser } from '../controls/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { matchTotp, newTotpSecret, otpauthUrl } from './totp.js';
import type { Contact } from '../accounts/contact.js';

const METHOD_LABEL: Record<'AUTHENTICATOR' | 'EMAIL' | 'SMS', string> = {
  AUTHENTICATOR: 'a code from your authenticator app',
  EMAIL: 'a code sent by email',
  SMS: 'a code sent by SMS',
};

/** Proposed in ADR 0005: the same limits as passwords. */
export const TWO_STEP_RULES = {
  /** Second-step attempts without a correct one before the second step pauses. */
  maxFailures: 5,
  /** Minutes the second step stays paused. */
  lockMinutes: 15,
} as const;

export type TwoStepMethod = 'AUTHENTICATOR' | 'EMAIL' | 'SMS';

/**
 * Which second steps a device may use, in the order they are offered (decision 36, refining decision 34).
 * The second step never uses the same channel as the sign-in:
 * - signed in with a password: authenticator app (if set up), then an email code, then an SMS code;
 * - signed in with an SMS code: authenticator app or an email code;
 * - signed in with an email code (or registered with one): authenticator app or an SMS code.
 * The authenticator comes first because SMS delivery is not always reliable.
 */
export function allowedMethods(signInMethod: RequestUser['signInMethod']): TwoStepMethod[] {
  switch (signInMethod) {
    case 'PASSWORD':
      return ['AUTHENTICATOR', 'EMAIL', 'SMS'];
    case 'SMS_CODE':
      return ['AUTHENTICATOR', 'EMAIL'];
    case 'EMAIL_CODE':
      return ['AUTHENTICATOR', 'SMS'];
  }
}

export interface TwoStepOption {
  method: TwoStepMethod;
  /** False when the authenticator is not set up, or the phone or email is not confirmed on the account. */
  available: boolean;
}

/**
 * Two-step login for staff (ADR 0005, decision 36). After signing in, a staff member proves the second step on
 * that device with an authenticator app code, an email code or an SMS code, never by the channel they signed in
 * with.
 */
@Injectable()
export class TwoStepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionsService,
    private readonly encryption: FieldEncryption,
  ) {}

  /** The second steps this device may use, in the order to offer them, and whether each is ready to use. */
  async options(user: RequestUser): Promise<TwoStepOption[]> {
    const facts = await this.facts(user.id);
    return allowedMethods(user.signInMethod).map((method) => ({ method, available: this.ready(method, facts) }));
  }

  /** Sends a second-step code to the staff member's own confirmed phone (SMS) or email address (EMAIL). */
  async sendCode(user: RequestUser, method: 'SMS' | 'EMAIL'): Promise<void> {
    const facts = await this.facts(user.id);
    this.assertUsable(user, method, facts);
    await this.otp.issue(this.contactFor(method, facts), 'TWO_STEP', true);
  }

  /** Checks a second-step code and, if right, marks this signed-in device as having passed the second step. */
  async verify(user: RequestUser, method: TwoStepMethod, code: string): Promise<void> {
    // Checked before an attempt is counted: choosing a method this device may not use is not a wrong guess.
    const facts = await this.facts(user.id);
    this.assertUsable(user, method, facts);
    const totpSecret = method === 'AUTHENTICATOR' ? this.encryption.decrypt(facts.totpSecretEncrypted!) : null;

    const attempt = await this.claimAttempt(user.id);
    if (attempt === null) {
      throw apiError(429, 'TWO_STEP_LOCKED', 'Too many wrong codes. Please wait a few minutes and try again.');
    }

    const ok =
      method === 'AUTHENTICATOR'
        ? await this.checkAuthenticator(user.id, totpSecret!, code)
        : /^[0-9]{6}$/.test(code) && (await this.otp.consume(this.contactFor(method, facts), 'TWO_STEP', code));
    if (!ok) {
      if (attempt >= TWO_STEP_RULES.maxFailures) {
        await this.audit(user.id, 'staff.two_step_locked');
      }
      throw apiError(400, 'INVALID_CODE', 'The code is wrong or has expired.');
    }

    await this.prisma.staffMember.update({
      where: { userId: user.id },
      data: { twoStepFailedCount: 0, twoStepLockedUntil: null },
    });
    await this.sessions.markTwoStepPassed(user.sessionId);
  }

  private async facts(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        phone: true,
        phoneVerifiedAt: true,
        email: true,
        emailVerifiedAt: true,
        staff: { select: { totpSecretEncrypted: true } },
      },
    });
    return {
      phone: u.phoneVerifiedAt ? u.phone : null,
      email: u.emailVerifiedAt ? u.email : null,
      totpSecretEncrypted: u.staff?.totpSecretEncrypted ?? null,
    };
  }

  private ready(method: TwoStepMethod, f: Awaited<ReturnType<TwoStepService['facts']>>): boolean {
    return method === 'AUTHENTICATOR' ? !!f.totpSecretEncrypted : method === 'EMAIL' ? !!f.email : !!f.phone;
  }

  private contactFor(method: 'SMS' | 'EMAIL', f: Awaited<ReturnType<TwoStepService['facts']>>): Contact {
    return method === 'SMS' ? { channel: 'SMS', destination: f.phone! } : { channel: 'EMAIL', destination: f.email! };
  }

  /** Refuses a method this device may not use (same channel as the sign-in), or one that is not ready. */
  private assertUsable(user: RequestUser, method: TwoStepMethod, f: Awaited<ReturnType<TwoStepService['facts']>>): void {
    const allowed = allowedMethods(user.signInMethod);
    if (!allowed.includes(method)) {
      const signedInWith = user.signInMethod === 'SMS_CODE' ? 'an SMS code' : 'an email code';
      throw apiError(
        403,
        'DIFFERENT_FACTOR_REQUIRED',
        `You signed in on this device with ${signedInWith}, so the second step must be different: ` +
          `${allowed.map((m) => METHOD_LABEL[m]).join(' or ')}.`,
        { allowedMethods: allowed },
      );
    }
    if (!this.ready(method, f)) {
      throw method === 'AUTHENTICATOR'
        ? apiError(400, 'NO_AUTHENTICATOR', 'No authenticator app is set up. Choose another way.')
        : apiError(400, 'CONTACT_NOT_CONFIRMED', `Your ${method === 'SMS' ? 'phone number' : 'email address'} is not confirmed yet. Choose another way.`);
    }
  }

  /**
   * Starts adding an authenticator app. Returns the secret and the set-up link (shown as a QR code). Nothing
   * changes until a first code from the app confirms it, so an existing authenticator keeps working meanwhile.
   */
  async startAuthenticator(user: RequestUser): Promise<{ secret: string; otpauthUrl: string }> {
    const { phone, email } = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, email: true } });
    const secret = newTotpSecret();
    await this.prisma.staffMember.update({
      where: { userId: user.id },
      data: { totpPendingSecretEncrypted: this.encryption.encrypt(secret) },
    });
    return { secret, otpauthUrl: otpauthUrl(secret, email ?? phone ?? user.id) };
  }

  /** Confirms the authenticator with a first code from the app; from then on its codes are accepted. */
  async confirmAuthenticator(user: RequestUser, code: string): Promise<void> {
    const staff = await this.prisma.staffMember.findUniqueOrThrow({ where: { userId: user.id } });
    if (!staff.totpPendingSecretEncrypted) {
      throw apiError(400, 'NO_SETUP_IN_PROGRESS', 'Start adding the authenticator app first.');
    }
    const step = matchTotp(this.encryption.decrypt(staff.totpPendingSecretEncrypted), code);
    if (step === null) throw apiError(400, 'INVALID_CODE', 'The code is wrong. Check the time on your phone and try again.');

    await this.prisma.staffMember.update({
      where: { userId: user.id },
      data: {
        totpSecretEncrypted: staff.totpPendingSecretEncrypted,
        totpPendingSecretEncrypted: null,
        totpEnabledAt: new Date(),
        totpLastStep: step,
      },
    });
    await this.audit(user.id, 'staff.authenticator_added');
  }

  /** Removes the authenticator app. Email and SMS codes remain available for the second step. */
  async removeAuthenticator(user: RequestUser): Promise<void> {
    await this.prisma.staffMember.update({
      where: { userId: user.id },
      data: { totpSecretEncrypted: null, totpPendingSecretEncrypted: null, totpEnabledAt: null, totpLastStep: null },
    });
    await this.audit(user.id, 'staff.authenticator_removed');
  }

  /**
   * Checks an authenticator code. Each code works once: the period it matched is recorded in the same
   * database statement that checks no later-or-equal period was already used, so a code cannot be replayed,
   * even by two requests at the same moment.
   */
  private async checkAuthenticator(userId: string, secret: string, code: string): Promise<boolean> {
    const step = matchTotp(secret, code);
    if (step === null) return false;
    const used = await this.prisma.$executeRaw`
      UPDATE "StaffMember" SET "totpLastStep" = ${step}::int
       WHERE "userId" = ${userId}::uuid AND ("totpLastStep" IS NULL OR "totpLastStep" < ${step}::int)`;
    return used === 1;
  }

  /**
   * Takes one second-step attempt, or returns null while the second step is paused. Same method as the
   * password lockout (ADR 0004): one database statement checks, counts and, at the limit, starts the pause.
   */
  private async claimAttempt(userId: string): Promise<number | null> {
    const { maxFailures, lockMinutes } = TWO_STEP_RULES;
    const rows = await this.prisma.$queryRaw<{ attempt: number }[]>`
      UPDATE "StaffMember"
         SET "twoStepFailedCount" =
               CASE WHEN "twoStepLockedUntil" IS NOT NULL THEN 1 ELSE "twoStepFailedCount" + 1 END,
             "twoStepLockedUntil" =
               CASE WHEN (CASE WHEN "twoStepLockedUntil" IS NOT NULL THEN 1 ELSE "twoStepFailedCount" + 1 END) >= ${maxFailures}::int
                    THEN (now() AT TIME ZONE 'UTC') + make_interval(mins => ${lockMinutes}::int)
                    ELSE NULL END
       WHERE "userId" = ${userId}::uuid
         AND ("twoStepLockedUntil" IS NULL OR "twoStepLockedUntil" <= (now() AT TIME ZONE 'UTC'))
      RETURNING "twoStepFailedCount" AS "attempt"`;
    return rows.length === 1 ? Number(rows[0].attempt) : null;
  }

  private async audit(userId: string, action: string): Promise<void> {
    await this.prisma.auditLog.create({ data: { actorId: userId, action, entityType: 'StaffMember', entityId: userId } });
  }
}
