import { Logger } from '@nestjs/common';
import type { PushMessage, PushSender, PushTarget } from './push-sender.js';

/** Development push provider: writes each notification to the server log instead of sending it. Refused in production. */
export class LogPushAdapter implements PushSender {
  readonly provider = 'log';
  private readonly logger = new Logger('Push');
  /** The last notifications "sent", newest last, for tests. */
  readonly sent: { targets: PushTarget[]; message: PushMessage }[] = [];

  async send(targets: PushTarget[], message: PushMessage): Promise<{ invalidTokens: string[] }> {
    this.sent.push({ targets, message });
    if (this.sent.length > 500) this.sent.shift();
    this.logger.log(`Push to ${targets.length} device(s): ${message.title}`);
    return { invalidTokens: targets.filter((t) => t.pushToken.startsWith('invalid-')).map((t) => t.pushToken) };
  }
}
