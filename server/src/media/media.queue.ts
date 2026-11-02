import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import type { Env } from '../config/env.js';
import { redisConnection } from '../jobs/redis-connection.js';
import { MediaProcessor } from './media.processor.js';

const QUEUE = 'media';
const PROCESS = 'process-media';
const REQUEUE_STUCK = 'requeue-stuck-media';

/**
 * The media queue (ADR 0009). Every server can add work to it; servers with RUN_BACKGROUND_JOBS=true also process it.
 * Each media item is queued under its own id, so confirming twice never processes it twice. An hourly job puts back
 * any media left processing for too long, in case a job was lost.
 */
@Injectable()
export class MediaQueue implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('MediaQueue');
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly processor: MediaProcessor,
  ) {}

  private get producer(): Queue {
    // Adding work must never hold up a request: if Redis cannot be reached, fail at once rather than wait.
    this.queue ??= new Queue(QUEUE, {
      connection: { ...redisConnection(this.config.get('REDIS_URL', { infer: true })), maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 3_000 },
    });
    return this.queue;
  }

  /**
   * Queues one photo or video for processing. If Redis cannot be reached the media stays PROCESSING, and the hourly
   * sweep puts it on the queue once Redis is back; the upload itself has already succeeded.
   */
  async add(mediaId: string): Promise<boolean> {
    try {
      await withTimeout(
        this.producer.add(PROCESS, { mediaId }, { jobId: mediaId, attempts: 3, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: 1000, removeOnFail: 1000 }),
        5_000,
      );
      return true;
    } catch (err) {
      this.logger.warn(`Could not queue media ${mediaId} for processing; the hourly sweep will retry: ${(err as Error).message}`);
      return false;
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('RUN_BACKGROUND_JOBS', { infer: true })) return;
    const connection = redisConnection(this.config.get('REDIS_URL', { infer: true }));
    await this.producer.upsertJobScheduler(REQUEUE_STUCK, { pattern: '30 * * * *' }, { name: REQUEUE_STUCK });
    this.worker = new Worker(
      QUEUE,
      async (job) => {
        if (job.name === PROCESS) return this.processor.process(job.data.mediaId as string);
        if (job.name === REQUEUE_STUCK) {
          const ids = await this.processor.stuck();
          // A fresh job id, because the lost job may still be recorded under the media id.
          for (const id of ids) await this.producer.add(PROCESS, { mediaId: id }, { jobId: `${id}:${Date.now()}`, attempts: 3 });
          return ids.length;
        }
        this.logger.warn(`Unknown job ${job.name}`);
      },
      { connection, concurrency: 2 },
    );
    this.worker.on('failed', (job, err) => this.logger.error(`Media job ${job?.id} failed: ${err.message}`));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await withTimeout(this.queue?.close() ?? Promise.resolve(), 5_000).catch(() => undefined);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
