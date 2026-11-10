/**
 * Sends push notifications to phones and computers (decision 46). Each push service (Firebase Cloud Messaging, and
 * Apple's service for iPhone call alerts) gets its own adapter implementing this interface, so the rest of the server
 * never depends on which one is used.
 */
export interface PushMessage {
  title: string;
  body: string;
  /** Small values the app uses to open the right screen, e.g. { conversationId }. */
  data: Record<string, string>;
  /** An incoming-call alert, sent so the phone rings even when the app is closed (decision 44). */
  urgent?: boolean;
}

export interface PushTarget {
  platform: 'ANDROID' | 'IOS' | 'WEB' | 'DESKTOP';
  pushToken: string;
  voipPushToken?: string | null;
}

export interface PushSender {
  readonly provider: string;
  /** Sends to each target. Returns the push tokens the service says are no longer valid, so they can be removed. */
  send(targets: PushTarget[], message: PushMessage): Promise<{ invalidTokens: string[] }>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');
