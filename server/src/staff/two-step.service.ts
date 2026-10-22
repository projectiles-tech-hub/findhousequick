import { Injectable } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { FieldEncryption } from '../common/field-encryption.js';
import { OtpService } from '../accounts/otp.service.js';
import { SessionsService } from '../accounts/sessions.service.js';
import type { RequestUser } from '../controls/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { matchTotp, newTotpSecret, otpauthUrl } from './totp.js';

/** Proposed in ADR 0005: the same limits as passwords. */
export const TWO_STEP_RULES = {
  /** Second-step attempts without a correct one before the second step pauses. */
  maxFailures: 5,
  /** Minutes the second step stays paused. */
  lockMinutes: 15,
} as const;

export type TwoStepMethod = 'SMS' | 'AUTHENTICATOR';

/**
 * Two-step login for staff (ADR 0005). After signing in with a password or SMS code, a staff member proves
 * the second step on that device with either an SMS code or an authenticator app code.
 */
@Injectable()
export class TwoStepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionsService,
    private readonly encryption: FieldEncryption,
  ) {}

  /** Sends a second-step code by SMS to the staff member's own confirmed phone number. */
  async sendSms(user: RequestUser): Promise<void> {
    const { phone } = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true } });
    await this.otp.issue(phone, 'TWO_STEP', true);
  }

  /** Checks a second-step code and, if right, marks this signed-in device as having passed the second step. */
  async verify(user: RequestUser, method: TwoStepMethod, code: string): Promise<void> {
    let totpSecret: string | null = null;
    if (method === 'AUTHENTICATOR') {
      // Checked before an attempt is counted: choosing a method that is not set up is not a wrong guess.
      const staff = await this.prisma.staffMember.findUniqueOrThrow({
        where: { userId: user.id },
        select: { totpSecretEncrypted: true },
      });
      if (!staff.totpSecretEncrypted) {
        throw apiError(400, 'NO_AUTHENTICATOR', 'No authenticator app is set up. Use an SMS code instead.');
      }
      totpSecret = this.encryption.decrypt(staff.totpSecretEncrypted);
    }

    const attempt = await this.claimAttempt(user.id);
    if (attempt === null) {
      throw apiError(429, 'TWO_STEP_LOCKED', 'Too many wrong codes. Please wait a few minutes and try again.');
    }

    const ok = totpSecret ? await this.checkAuthenticator(user.id, totpSecret, code) : await this.checkSms(user.id, code);
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

  /**
   * Starts adding an authenticator app. Returns the secret and the set-up link (shown as a QR code). Nothing
   * changes until a first code from the app confirms it, so an existing authenticator keeps working meanwhile.
   */
  async startAuthenticator(user: RequestUser): Promise<{ secret: string; otpauthUrl: string }> {
    const { phone } = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true } });
    const secret = newTotpSecret();
    await this.prisma.staffMember.update({
      where: { userId: user.id },
      data: { totpPendingSecretEncrypted: this.encryption.encrypt(secret) },
    });
    return { secret, otpauthUrl: otpauthUrl(secret, phone) };
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

  /** Removes the authenticator app. SMS codes remain available for the second step. */
  async removeAuthenticator(user: RequestUser): Promise<void> {
    await this.prisma.staffMember.update({
      where: { userId: user.id },
      data: { totpSecretEncrypted: null, totpPendingSecretEncrypted: null, totpEnabledAt: null, totpLastStep: null },
    });
    await this.audit(user.id, 'staff.authenticator_removed');
  }

  private async checkSms(userId: string, code: string): Promise<boolean> {
    if (!/^[0-9]{6}$/.test(code)) return false;
    const { phone } = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    return this.otp.consume(phone, 'TWO_STEP', code);
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
