import { Injectable, Logger, Module, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import type { Env } from '../config/env.js';
import { redisConnection } from './redis-connection.js';
import { ListingsModule } from '../listings/listings.module.js';
import { ListingsService } from '../listings/listings.service.js';
import { RetentionService } from './retention.service.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { CallsService } from '../messaging/calls.service.js';

export { redisConnection };

const QUEUE = 'maintenance';
const PURGE_DOCUMENTS = 'purge-expired-documents';
const EXPIRE_LISTINGS = 'expire-listings';
const MISSED_CALLS = 'missed-calls';

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
    private readonly listings: ListingsService,
    private readonly calls: CallsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('RUN_BACKGROUND_JOBS', { infer: true })) return;
    const connection = redisConnection(this.config.get('REDIS_URL', { infer: true }));
    this.queue = new Queue(QUEUE, { connection });
    await this.queue.upsertJobScheduler(PURGE_DOCUMENTS, { pattern: '0 * * * *' }, { name: PURGE_DOCUMENTS });
    // Listings whose lister did not confirm availability in time (Specification 6.6).
    await this.queue.upsertJobScheduler(EXPIRE_LISTINGS, { pattern: '15 * * * *' }, { name: EXPIRE_LISTINGS });
    // Calls nobody answered within a minute are marked missed (decision 44).
    await this.queue.upsertJobScheduler(MISSED_CALLS, { pattern: '* * * * *' }, { name: MISSED_CALLS });
    this.worker = new Worker(
      QUEUE,
      async (job) => {
        if (job.name === PURGE_DOCUMENTS) return this.retention.purgeExpiredDocuments();
        if (job.name === EXPIRE_LISTINGS) return this.listings.expireOverdue();
        if (job.name === MISSED_CALLS) return this.calls.sweepUnanswered();
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
  imports: [ListingsModule, MessagingModule],
  providers: [RetentionService, JobsRunner],
  exports: [RetentionService],
})
export class JobsModule {}
