import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MapsUnavailableError } from './maps-provider.js';

/**
 * Keeps answers from the maps provider for a time (ADR 0015), in the database so every server shares them: the
 * same place search or the amenities near the same spot are paid for once. A provider that fails gives the fallback,
 * and nothing is kept, so it is asked again next time.
 */
@Injectable()
export class MapsAnswers {
  private readonly logger = new Logger('Maps');

  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, keepDays: number, ask: () => Promise<T>, fallback: T): Promise<T> {
    const kept = await this.prisma.mapsAnswer.findUnique({ where: { key } });
    if (kept && kept.expiresAt > new Date()) return kept.value as T;
    try {
      const value = await ask();
      const expiresAt = new Date(Date.now() + keepDays * 86_400_000);
      await this.prisma.mapsAnswer.upsert({ where: { key }, create: { key, value: value as object, expiresAt }, update: { value: value as object, expiresAt } });
      return value;
    } catch (e) {
      if (!(e instanceof MapsUnavailableError)) throw e;
      this.logger.warn(e.message);
      return kept ? (kept.value as T) : fallback;
    }
  }

  /** Removes answers past their time; run by the hourly job. */
  async purge(): Promise<number> {
    return (await this.prisma.mapsAnswer.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count;
  }
}
