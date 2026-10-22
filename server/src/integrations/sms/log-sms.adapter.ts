import { Logger } from '@nestjs/common';
import type { SmsSender } from './sms-sender.js';

export interface LoggedSms {
  to: string;
  text: string;
  sentAt: Date;
}

/**
 * Development SMS provider: writes each message to the server log instead of sending it, so codes can be
 * read without an SMS account. Refused in production by the configuration check.
 *
 * The last messages are also kept in memory so the API tests can read the codes.
 */
export class LogSmsAdapter implements SmsSender {
  readonly provider = 'log';
  private readonly logger = new Logger('SMS');
  private readonly sent: LoggedSms[] = [];

  async send(to: string, text: string): Promise<void> {
    this.logger.log(`To ${to}: ${text}`);
    this.sent.push({ to, text, sentAt: new Date() });
    if (this.sent.length > 200) this.sent.shift();
  }

  /** Messages sent to one number, newest last. */
  messagesTo(to: string): LoggedSms[] {
    return this.sent.filter((m) => m.to === to);
  }
}
