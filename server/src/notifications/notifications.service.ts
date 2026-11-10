import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import type { RequestUser } from '../controls/request-context.js';
import { Prisma } from '../generated/prisma/client.js';
import { EMAIL_SENDER, type EmailSender } from '../integrations/email/email-sender.js';
import { PUSH_SENDER, type PushSender } from '../integrations/push/push-sender.js';
import { SMS_SENDER, type SmsSender } from '../integrations/sms/sms-sender.js';
import { LiveService } from '../live/live.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ALLOWED_CHANNELS, effectiveSettings, settingsChangeSchema, type NotificationKind } from './kinds.js';

export interface Notice {
  title: string;
  body: string;
  /** Values the app uses to open the right screen. */
  data?: Record<string, string>;
}

const MAX_DEVICES_PER_USER = 20;

/**
 * Notifications (decision 46): push to every registered device, and email or SMS, as the user chose for each kind.
 * Security messages (codes and sign-in alerts) are sent by the accounts code directly and cannot be switched off.
 *
 * Sending never fails the action that caused it: a notification that cannot be delivered is logged.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveService,
    @Inject(PUSH_SENDER) private readonly push: PushSender,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  /** Sends one notification of a kind to a user, by the channels they chose. */
  async notify(userId: string, kind: NotificationKind, notice: Notice, opts: { urgent?: boolean } = {}): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { status: true, phone: true, phoneVerifiedAt: true, email: true, emailVerifiedAt: true, notificationSettings: true, pushDevices: true },
      });
      if (!user || user.status !== 'ACTIVE') return;
      const channels = effectiveSettings(user.notificationSettings)[kind];
      const data = { kind, ...notice.data };
      await this.live.publish([userId], 'notification', { kind, title: notice.title, body: notice.body, data });
      if (channels.includes('PUSH') && user.pushDevices.length) {
        const { invalidTokens } = await this.push.send(user.pushDevices, { title: notice.title, body: notice.body, data, urgent: opts.urgent });
        if (invalidTokens.length) await this.prisma.pushDevice.deleteMany({ where: { pushToken: { in: invalidTokens } } });
      }
      // Only to confirmed contacts.
      if (channels.includes('EMAIL') && user.email && user.emailVerifiedAt) {
        await this.email.send({ to: user.email, subject: notice.title, text: `${notice.body}\n\nFindHouseQuick` });
      }
      if (channels.includes('SMS') && user.phone && user.phoneVerifiedAt) {
        await this.sms.send(user.phone, `FindHouseQuick: ${notice.body}`.slice(0, 300));
      }
    } catch (err) {
      this.logger.warn(`Notification ${kind} to ${userId} not delivered: ${(err as Error).message}`);
    }
  }

  // Settings ---------------------------------------------------------------------------------------

  async getSettings(user: RequestUser) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { notificationSettings: true } });
    return effectiveSettings(row.notificationSettings);
  }

  async changeSettings(user: RequestUser, body: unknown) {
    const parsed = settingsChangeSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw apiError(400, 'INVALID_SETTINGS', 'Security messages cannot be switched off, and each kind takes PUSH, EMAIL or SMS.', {
        problems: parsed.error.issues.map((i) => `${i.path.join('.') || 'settings'}: ${i.message}`),
      });
    }
    for (const [kind, channels] of Object.entries(parsed.data)) {
      const allowed = ALLOWED_CHANNELS[kind as NotificationKind];
      if (allowed && channels?.some((c) => !allowed.includes(c))) {
        throw apiError(400, 'INVALID_SETTINGS', `${kind} can only use ${allowed.join(', ')}.`);
      }
    }
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { notificationSettings: true } });
    const stored = { ...((row.notificationSettings ?? {}) as object), ...parsed.data };
    await this.prisma.user.update({ where: { id: user.id }, data: { notificationSettings: stored as Prisma.InputJsonValue } });
    return effectiveSettings(stored);
  }

  // Devices ----------------------------------------------------------------------------------------

  /** Registers this device for push. The same push token moves to whoever signs in on it last. */
  async registerDevice(user: RequestUser, platform: 'ANDROID' | 'IOS' | 'WEB' | 'DESKTOP', pushToken: string, voipPushToken?: string) {
    const device = await this.prisma.pushDevice.upsert({
      where: { pushToken },
      create: { userId: user.id, sessionId: user.sessionId, platform, pushToken, voipPushToken: voipPushToken ?? null },
      update: { userId: user.id, sessionId: user.sessionId, platform, voipPushToken: voipPushToken ?? null, lastSeenAt: new Date() },
    });
    // Old devices beyond the limit are dropped, oldest first.
    const extra = await this.prisma.pushDevice.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: 'desc' }, skip: MAX_DEVICES_PER_USER, select: { id: true } });
    if (extra.length) await this.prisma.pushDevice.deleteMany({ where: { id: { in: extra.map((d) => d.id) } } });
    return { id: device.id };
  }

  async removeDevice(user: RequestUser, deviceId: string): Promise<void> {
    const { count } = await this.prisma.pushDevice.deleteMany({ where: { id: deviceId, userId: user.id } });
    if (!count) throw new NotFoundException('Device not found.');
  }
}
