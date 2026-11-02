import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { apiError } from '../common/api-error.js';
import type { Env } from '../config/env.js';
import { ControlsService } from '../controls/controls.service.js';

const HOUR_SECONDS = 3600;

export interface Viewer {
  userId?: string | null;
  /** Network address of the request. */
  ip?: string | null;
  /** The app's own device id (X-Device-Id), when sent. */
  deviceId?: string | null;
}

/**
 * Limits on opening property pages, against copying listings (decision 52; for signed-out visitors, decision 75).
 * Counted in Redis so every server shares the same counts. A signed-in account has its own limit; without sign-in the
 * limit is per device and network address, with a wider limit per address whatever device it claims to be.
 *
 * If Redis cannot be reached the page is still shown: a brief gap in copy protection is better than the site failing.
 */
@Injectable()
export class ViewLimitsService implements OnApplicationShutdown {
  private readonly logger = new Logger('ViewLimits');
  private redis?: Redis;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly controls: ControlsService,
  ) {}

  private get client(): Redis {
    this.redis ??= new Redis(this.config.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
      lazyConnect: false,
    });
    this.redis.on('error', () => undefined);
    return this.redis;
  }

  /** Counts one property page view; refuses with 429 VIEW_LIMIT when the hour's limit is used up. */
  async countView(viewer: Viewer): Promise<void> {
    const settings = await this.controls.getPlatformSettings();
    const hour = Math.floor(Date.now() / 1000 / HOUR_SECONDS);
    const checks: [string, number][] = viewer.userId
      ? [[`views:u:${viewer.userId}:${hour}`, settings.listingViewsPerHour]]
      : [
          [`views:d:${viewer.ip ?? '-'}:${viewer.deviceId ?? '-'}:${hour}`, settings.signedOutListingViewsPerHour],
          [`views:a:${viewer.ip ?? '-'}:${hour}`, settings.signedOutViewsPerAddressPerHour],
        ];
    let counts: number[];
    try {
      const multi = this.client.multi();
      for (const [key] of checks) multi.incr(key).expire(key, HOUR_SECONDS * 2);
      const res = await multi.exec();
      counts = checks.map((_, i) => Number(res?.[i * 2]?.[1] ?? 0));
    } catch (err) {
      this.logger.warn(`View limits unavailable, page shown anyway: ${(err as Error).message}`);
      return;
    }
    if (checks.some(([, limit], i) => counts[i]! > limit)) {
      const retryAfterSeconds = HOUR_SECONDS - (Math.floor(Date.now() / 1000) % HOUR_SECONDS);
      throw apiError(429, 'VIEW_LIMIT', viewer.userId
        ? 'You have opened a great many property pages this hour. Please try again later.'
        : 'Please sign in to keep viewing properties, or try again later.', { retryAfterSeconds });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.redis?.disconnect();
  }
}
