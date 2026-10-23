import { Inject, Injectable, Logger } from '@nestjs/common';
import { PRIVATE_STORAGE, type PrivateStorage } from '../integrations/storage/private-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Documents removed per run, so one run never holds the database for long. */
const BATCH = 200;

/**
 * Deletes private documents whose retention period has ended (decision 55): the file is removed from storage and the
 * document is marked deleted. The record itself stays, without the file, so the history of a check is not lost.
 * Run every hour by the background jobs (jobs.module.ts).
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async purgeExpiredDocuments(now = new Date()): Promise<number> {
    let removed = 0;
    for (;;) {
      const due = await this.prisma.document.findMany({
        where: { deleteAfter: { lte: now }, deletedAt: null },
        select: { id: true, storageKey: true },
        orderBy: { deleteAfter: 'asc' },
        take: BATCH,
      });
      for (const doc of due) {
        await this.storage.delete(doc.storageKey);
        await this.prisma.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
        await this.prisma.auditLog.create({
          data: { actorId: null, action: 'document.deleted_retention', entityType: 'Document', entityId: doc.id },
        });
        removed++;
      }
      if (due.length < BATCH) break;
    }
    if (removed) this.logger.log(`Deleted ${removed} document(s) whose retention period ended`);
    return removed;
  }
}
