import { z } from 'zod';

/** The kinds of notification a user can choose channels for (decision 46). Security messages are never listed. */
export const NOTIFICATION_KINDS = [
  'NEW_MESSAGE',
  'INCOMING_CALL',
  'INSPECTION_UPDATE',
  'SAVED_SEARCH_ALERT',
  'LISTING_UPDATE',
  'VERIFICATION_UPDATE',
  'REMINDER',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export const CHANNELS = ['PUSH', 'EMAIL', 'SMS'] as const;
export type Channel = (typeof CHANNELS)[number];
export type NotificationSettings = Record<NotificationKind, Channel[]>;

/**
 * What a user gets until they change it. SMS costs money per message, so it is off by default; messages and calls
 * come by push only, as email would arrive too late to matter.
 */
export const DEFAULT_SETTINGS: NotificationSettings = {
  NEW_MESSAGE: ['PUSH'],
  INCOMING_CALL: ['PUSH'],
  INSPECTION_UPDATE: ['PUSH', 'EMAIL'],
  SAVED_SEARCH_ALERT: ['PUSH', 'EMAIL'],
  LISTING_UPDATE: ['PUSH', 'EMAIL'],
  VERIFICATION_UPDATE: ['PUSH', 'EMAIL'],
  REMINDER: ['PUSH', 'EMAIL'],
};

/** Calls ring through push only: an email or text about a call is no use once it has stopped ringing. */
export const ALLOWED_CHANNELS: Partial<Record<NotificationKind, readonly Channel[]>> = { INCOMING_CALL: ['PUSH'] };

const channelList = z.array(z.enum(CHANNELS)).max(3).refine((a) => new Set(a).size === a.length, { message: 'must not repeat a channel' });

/** A change: any subset of the kinds, each with its channels. Unknown kinds (such as SECURITY) are refused. */
export const settingsChangeSchema = z.object(Object.fromEntries(NOTIFICATION_KINDS.map((k) => [k, channelList.optional()]))).strict();

/** The user's settings: their stored choices over the defaults. */
export function effectiveSettings(stored: unknown): NotificationSettings {
  const parsed = settingsChangeSchema.safeParse(stored ?? {});
  return { ...DEFAULT_SETTINGS, ...(parsed.success ? (parsed.data as Partial<NotificationSettings>) : {}) };
}
