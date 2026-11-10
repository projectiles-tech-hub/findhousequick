import type { ConnectionOptions } from 'bullmq';

/** BullMQ connection settings from a redis:// or rediss:// address. */
export function redisConnection(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
    tls: u.protocol === 'rediss:' ? {} : undefined,
    // Required by BullMQ workers: wait for Redis instead of failing commands while it reconnects.
    maxRetriesPerRequest: null,
  };
}
