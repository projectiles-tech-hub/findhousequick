import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { apiError } from '../common/api-error.js';
import { SMS_SENDER, type SmsSender } from '../integrations/sms/sms-sender.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateNumericCode, hashCode, sameHash } from './secrets.js';

export const OTP_PURPOSES = ['REGISTER', 'LOGIN', 'RESET_PASSWORD'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** Rules for one-time SMS codes. They protect users and limit SMS costs; they do not differ by country. */
export const OTP_RULES = {
  length: 6,
  /** Minutes a code stays valid. */
  validMinutes: 10,
  /** Wrong guesses allowed on one code before it stops working. */
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
    this.secret = config.get('JWT_SECRET', { infer: true });
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
   * Each wrong guess is counted; after too many, the code stops working and a new one must be requested.
   */
  async consume(phone: string, purpose: OtpPurpose, code: string): Promise<boolean> {
    const latest = await this.prisma.otpCode.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest || latest.usedAt || latest.expiresAt.getTime() <= Date.now() || latest.attempts >= OTP_RULES.maxAttempts) {
      return false;
    }
    if (!sameHash(latest.codeHash, hashCode(this.secret, phone, purpose, code))) {
      await this.prisma.otpCode.update({ where: { id: latest.id }, data: { attempts: { increment: 1 } } });
      return false;
    }
    // Only one request can use the code, even if two arrive at the same moment.
    const used = await this.prisma.otpCode.updateMany({
      where: { id: latest.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return used.count === 1;
  }
}

/** "+2348031234567" becomes "+234*******567", for logs. */
export function maskPhone(phone: string): string {
  return phone.length <= 7 ? '***' : phone.slice(0, 4) + '*'.repeat(phone.length - 7) + phone.slice(-3);
}
