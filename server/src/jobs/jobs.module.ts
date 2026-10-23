import { Injectable, Logger, Module, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Env } from '../config/env.js';
import { RetentionService } from './retention.service.js';

const QUEUE = 'maintenance';
const PURGE_DOCUMENTS = 'purge-expired-documents';

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

/**
 * Background jobs, run through BullMQ on Redis (decision 59: BullMQ starts with the first background job).
 *
 * The hourly schedule is stored in Redis once, so with several servers running the job still runs once an hour, on
 * whichever server picks it up. Servers with RUN_BACKGROUND_JOBS=false (and the API tests) start nothing.
 */
@Injectable()
export class JobsRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Jobs');
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly retention: RetentionService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('RUN_BACKGROUND_JOBS', { infer: true })) return;
    const connection = redisConnection(this.config.get('REDIS_URL', { infer: true }));
    this.queue = new Queue(QUEUE, { connection });
    await this.queue.upsertJobScheduler(PURGE_DOCUMENTS, { pattern: '0 * * * *' }, { name: PURGE_DOCUMENTS });
    this.worker = new Worker(
      QUEUE,
      async (job) => {
        if (job.name === PURGE_DOCUMENTS) return this.retention.purgeExpiredDocuments();
        this.logger.warn(`Unknown job ${job.name}`);
      },
      { connection },
    );
    this.worker.on('failed', (job, err) => this.logger.error(`Job ${job?.name} failed: ${err.message}`));
    this.logger.log('Background jobs started');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}

@Module({
  providers: [RetentionService, JobsRunner],
  exports: [RetentionService],
})
export class JobsModule {}
