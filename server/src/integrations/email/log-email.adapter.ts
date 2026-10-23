import { Logger } from '@nestjs/common';
import type { EmailMessage, EmailSender } from './email-sender.js';

/**
 * Development email provider: writes each email to the server log instead of sending it, so codes can be read
 * without an email account. Refused in production by the configuration check.
 *
 * The last messages are also kept in memory so the API tests can read the codes.
 */
export class LogEmailAdapter implements EmailSender {
  readonly provider = 'log';
  private readonly logger = new Logger('Email');
  private readonly sent: (EmailMessage & { sentAt: Date })[] = [];

  constructor(private readonly from: string) {}

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`From ${this.from} to ${message.to}: ${message.subject} | ${message.text}`);
    this.sent.push({ ...message, sentAt: new Date() });
    if (this.sent.length > 200) this.sent.shift();
  }

  /** Emails sent to one address, newest last. */
  messagesTo(to: string): (EmailMessage & { sentAt: Date })[] {
    return this.sent.filter((m) => m.to === to);
  }
}
