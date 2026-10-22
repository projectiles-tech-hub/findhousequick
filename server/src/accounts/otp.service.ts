import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { apiError } from '../common/api-error.js';
import { SMS_SENDER, type SmsSender } from '../integrations/sms/sms-sender.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateNumericCode, hashCode } from './secrets.js';

export const OTP_PURPOSES = ['REGISTER', 'LOGIN', 'RESET_PASSWORD'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** Rules for one-time SMS codes. They protect users and limit SMS costs; they do not differ by country. */
export const OTP_RULES = {
  length: 6,
  /** Minutes a code stays valid. */
  validMinutes: 10,
  /** Guesses allowed on one code (right or wrong) before it stops working. */
  maxAttempts: 5,
  /** Seconds before another code can be requested for the same number and purpose. */
  resendAfterSeconds: 60,
  /** Codes allowed per number and purpose in one hour. */
  maxPerHour: 5,
} as const;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('OTP_HASH_SECRET', { infer: true });
  }

  /**
   * Records a code request and sends the code by SMS when `deliver` is true.
   *
   * A record is kept even when the code is not sent (for example, a registration code for a number that is
   * already registered). That way the limits and the response are the same either way, and the response
   * never reveals whether a number is registered.
   */
  async issue(phone: string, purpose: OtpPurpose, deliver: boolean): Promise<void> {
    const now = Date.now();
    const recent = await this.prisma.otpCode.findMany({
      where: { phone, purpose, createdAt: { gte: new Date(now - 60 * 60_000) } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const tooSoon = recent[0] && now - recent[0].createdAt.getTime() < OTP_RULES.resendAfterSeconds * 1000;
    if (tooSoon || recent.length >= OTP_RULES.maxPerHour) {
      throw apiError(429, 'TOO_MANY_REQUESTS', 'Too many codes requested for this number. Please wait and try again.');
    }

    const code = generateNumericCode(OTP_RULES.length);
    await this.prisma.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash: hashCode(this.secret, phone, purpose, code),
        expiresAt: new Date(now + OTP_RULES.validMinutes * 60_000),
      },
    });
    if (!deliver) return;

    try {
      await this.sms.send(
        phone,
        `Your FindHouseQuick code is ${code}. It expires in ${OTP_RULES.validMinutes} minutes. Do not share it with anyone.`,
      );
    } catch (err) {
      // The caller still gets the usual response; the user can ask for another code after the wait.
      this.logger.error(`SMS to ${maskPhone(phone)} failed through ${this.sms.provider}: ${String(err)}`);
    }
  }

  /**
   * Checks a code and uses it up if correct. Only the newest code for the number and purpose counts.
   *
   * Every guess, right or wrong, uses one of the code's attempts, and the check, the count and the
   * "used" mark happen in ONE database statement. The database handles one such statement on a code at a
   * time, so many guesses sent at the same moment cannot all get past the limit before any is counted:
   * once the attempts are used up, further guesses match no row and fail.
   *
   * Times are compared in UTC because that is how the database stores them.
   */
  async consume(phone: string, purpose: OtpPurpose, code: string): Promise<boolean> {
    const guessHash = hashCode(this.secret, phone, purpose, code);
    const rows = await this.prisma.$queryRaw<{ ok: boolean }[]>`
      UPDATE "OtpCode"
         SET "attempts" = "attempts" + 1,
             "usedAt" = CASE WHEN "codeHash" = ${guessHash} THEN (now() AT TIME ZONE 'UTC') ELSE NULL END
       WHERE "id" = (
               SELECT "id" FROM "OtpCode"
                WHERE "phone" = ${phone} AND "purpose" = ${purpose}
                ORDER BY "createdAt" DESC, "id" DESC
                LIMIT 1
             )
         AND "usedAt" IS NULL
         AND "expiresAt" > (now() AT TIME ZONE 'UTC')
         AND "attempts" < ${OTP_RULES.maxAttempts}
      RETURNING ("usedAt" IS NOT NULL) AS "ok"`;
    return rows.length === 1 && rows[0].ok === true;
  }
}

/** "+2348031234567" becomes "+234*******567", for logs. */
export function maskPhone(phone: string): string {
  return phone.length <= 7 ? '***' : phone.slice(0, 4) + '*'.repeat(phone.length - 7) + phone.slice(-3);
}
