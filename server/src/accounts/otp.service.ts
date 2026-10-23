import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { apiError } from '../common/api-error.js';
import { EMAIL_SENDER, type EmailSender } from '../integrations/email/email-sender.js';
import { SMS_SENDER, type SmsSender } from '../integrations/sms/sms-sender.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { maskContact, type Contact } from './contact.js';
import { generateNumericCode, hashCode } from './secrets.js';

/** Purposes anyone can ask a code for through POST /auth/otp. */
export const OTP_PURPOSES = ['REGISTER', 'LOGIN', 'RESET_PASSWORD'] as const;
/**
 * Purposes for signed-in users only: CONFIRM_CONTACT to confirm or change a phone number or email address
 * (ADR 0006); TWO_STEP for the staff second step (ADR 0005).
 */
export type OtpPurpose = (typeof OTP_PURPOSES)[number] | 'CONFIRM_CONTACT' | 'TWO_STEP';

/** Rules for one-time codes, by SMS or email. They protect users and limit costs; they do not differ by country. */
export const OTP_RULES = {
  length: 6,
  /** Minutes a code stays valid. */
  validMinutes: 10,
  /** Guesses allowed on one code (right or wrong) before it stops working. */
  maxAttempts: 5,
  /** Seconds before another code can be requested for the same phone number or email address and purpose. */
  resendAfterSeconds: 60,
  /** Codes allowed per phone number or email address and purpose in one hour. */
  maxPerHour: 5,
} as const;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('OTP_HASH_SECRET', { infer: true });
  }

  /**
   * Records a code request and sends the code (by SMS or email, from the contact) when `deliver` is true.
   *
   * A record is kept even when the code is not sent (for example, a registration code for a contact that is
   * already registered). That way the limits and the response are the same either way, and the response
   * never reveals whether a phone number or email address is registered.
   */
  async issue(contact: Contact, purpose: OtpPurpose, deliver: boolean): Promise<void> {
    const { channel, destination } = contact;
    const now = Date.now();
    const recent = await this.prisma.otpCode.findMany({
      where: { destination, purpose, createdAt: { gte: new Date(now - 60 * 60_000) } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const tooSoon = recent[0] && now - recent[0].createdAt.getTime() < OTP_RULES.resendAfterSeconds * 1000;
    if (tooSoon || recent.length >= OTP_RULES.maxPerHour) {
      throw apiError(429, 'TOO_MANY_REQUESTS', 'Too many codes requested. Please wait and try again.');
    }

    const code = generateNumericCode(OTP_RULES.length);
    await this.prisma.otpCode.create({
      data: {
        channel,
        destination,
        purpose,
        codeHash: hashCode(this.secret, destination, purpose, code),
        expiresAt: new Date(now + OTP_RULES.validMinutes * 60_000),
      },
    });
    if (!deliver) return;

    const text = `Your FindHouseQuick code is ${code}. It expires in ${OTP_RULES.validMinutes} minutes. Do not share it with anyone.`;
    await this.notify(contact, 'Your FindHouseQuick code', text);
  }

  /**
   * Sends a short message to a contact by its own channel (security notices as well as codes). A failure is
   * logged and does not stop the request: the user can ask again.
   */
  async notify(contact: Contact, subject: string, text: string): Promise<void> {
    try {
      if (contact.channel === 'SMS') await this.sms.send(contact.destination, text);
      else await this.email.send({ to: contact.destination, subject, text });
    } catch (err) {
      const provider = contact.channel === 'SMS' ? this.sms.provider : this.email.provider;
      this.logger.error(`Message to ${maskContact(contact)} failed through ${provider}: ${String(err)}`);
    }
  }

  /**
   * Checks a code and uses it up if correct. Only the newest code for the contact and purpose counts.
   *
   * Every guess, right or wrong, uses one of the code's attempts, and the check, the count and the
   * "used" mark happen in ONE database statement. The database handles one such statement on a code at a
   * time, so many guesses sent at the same moment cannot all get past the limit before any is counted:
   * once the attempts are used up, further guesses match no row and fail.
   *
   * Times are compared in UTC because that is how the database stores them.
   */
  async consume(contact: Contact, purpose: OtpPurpose, code: string): Promise<boolean> {
    const { destination } = contact;
    const guessHash = hashCode(this.secret, destination, purpose, code);
    const rows = await this.prisma.$queryRaw<{ ok: boolean }[]>`
      UPDATE "OtpCode"
         SET "attempts" = "attempts" + 1,
             "usedAt" = CASE WHEN "codeHash" = ${guessHash} THEN (now() AT TIME ZONE 'UTC') ELSE NULL END
       WHERE "id" = (
               SELECT "id" FROM "OtpCode"
                WHERE "destination" = ${destination} AND "purpose" = ${purpose}
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
  return maskContact({ channel: 'SMS', destination: phone });
}
