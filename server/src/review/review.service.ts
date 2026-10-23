import { Inject, Injectable } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { ControlsService } from '../controls/controls.service.js';
import type { RequestUser } from '../controls/request-context.js';
import type { Prisma, ReviewTask } from '../generated/prisma/client.js';
import { PRIVATE_STORAGE, type PrivateStorage } from '../integrations/storage/private-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListReviewTasksQuery, ReviewDecisionDto } from './dto.js';

const PAGE_SIZE = 50;
/** Minutes a staff document view link lasts. */
const VIEW_LINK_MINUTES = 5;

type Staff = NonNullable<RequestUser['staff']>;

const inScope = (staff: Staff, countryCode: string) => staff.countryScopes.includes('*') || staff.countryScopes.includes(countryCode);

/**
 * The verification team's work queue (ADR 0007). Staff see and decide tasks only in their own countries, never their
 * own cases, and every decision and document view is written to the audit log.
 *
 * Built so far: identity reviews, duplicate IDs and agent company details. Listing, authority and report tasks are
 * decided here too once those parts are built.
 */
@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async list(staff: Staff, q: ListReviewTasksQuery) {
    const where: Prisma.ReviewTaskWhereInput = {
      ...(staff.countryScopes.includes('*') ? {} : { countryCode: { in: staff.countryScopes } }),
      ...(q.type ? { type: q.type } : {}),
      status: q.status ?? { in: ['OPEN', 'ASSIGNED'] },
    };
    // Oldest first, so the queue is worked in order.
    const rows = await this.prisma.reviewTask.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: PAGE_SIZE + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, PAGE_SIZE);
    return {
      items: await Promise.all(page.map((t) => this.withDetails(t))),
      nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    };
  }

  /**
   * Records the outcome of a task. Identity reviews and duplicate IDs: APPROVE passes the check (the user reaches
   * level 2), REJECT fails it (the user may start a new check). Agent company details: APPROVE or REJECT them.
   */
  async decide(actor: RequestUser, taskId: string, dto: ReviewDecisionDto) {
    const staff = actor.staff!;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ReviewTask" WHERE "id" = ${taskId}::uuid FOR UPDATE`;
      const task = await tx.reviewTask.findUnique({ where: { id: taskId } });
      if (!task || !inScope(staff, task.countryCode)) throw apiError(404, 'NOT_FOUND', 'Task not found.');
      if (task.status === 'DONE' || task.status === 'CANCELLED') throw apiError(409, 'TASK_CLOSED', 'This task has already been decided.');
      if (dto.outcome !== 'APPROVE' && dto.outcome !== 'REJECT') {
        throw apiError(400, 'OUTCOME_NOT_SUPPORTED', 'This kind of task takes APPROVE or REJECT.');
      }
      const approve = dto.outcome === 'APPROVE';
      const now = new Date();

      switch (task.type) {
        case 'IDENTITY_REVIEW':
        case 'DUPLICATE_RESOLUTION':
          await this.decideIdentity(tx, task, actor.id, approve, now);
          break;
        case 'AGENT_PROFILE_REVIEW': {
          if (task.entityId === actor.id) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
          await tx.agentProfile.update({
            where: { userId: task.entityId },
            data: { status: approve ? 'PASSED' : 'FAILED', reviewedAt: now },
          });
          break;
        }
        default:
          throw apiError(400, 'OUTCOME_NOT_SUPPORTED', 'Tasks of this kind cannot be decided yet.');
      }

      const closed = await tx.reviewTask.update({
        where: { id: task.id },
        data: { status: 'DONE', outcome: dto.outcome, notes: dto.notes, assignedToId: actor.id, closedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'review.decided',
          entityType: task.entityType,
          entityId: task.entityId,
          metadata: { taskId: task.id, type: task.type, outcome: dto.outcome, notes: dto.notes },
        },
      });
      return this.withDetails(closed, tx);
    });
  }

  /**
   * A short-lived link to view a private document, for staff with a reason. Every view is recorded in the audit log
   * with the reason (Specification Section 15).
   */
  async viewDocument(actor: RequestUser, documentId: string, reason: string, ipAddress: string | undefined) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { owner: { select: { countryCode: true } } },
    });
    if (!doc || !inScope(actor.staff!, doc.owner.countryCode)) throw apiError(404, 'NOT_FOUND', 'Document not found.');
    if (doc.ownerId === actor.id) throw apiError(403, 'OWN_CASE', 'You cannot view your own documents here.');
    if (!doc.uploadedAt || doc.deletedAt) throw apiError(410, 'DOCUMENT_GONE', 'This document is not available (not uploaded, or deleted).');

    const expiresAt = new Date(Date.now() + VIEW_LINK_MINUTES * 60_000);
    const url = await this.storage.createViewLink(doc.storageKey, expiresAt);
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'document.viewed', entityType: 'Document', entityId: doc.id, metadata: { reason }, ipAddress: ipAddress ?? null },
    });
    return { url, expiresAt };
  }

  private async decideIdentity(tx: Prisma.TransactionClient, task: ReviewTask, staffId: string, approve: boolean, now: Date) {
    const check = await tx.identityVerification.findUniqueOrThrow({
      where: { id: task.entityId },
      include: { user: { select: { countryCode: true } } },
    });
    if (check.userId === staffId) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
    if (check.status !== 'MANUAL_REVIEW') throw apiError(409, 'CHECK_NOT_UNDER_REVIEW', 'This identity check is no longer under review.');
    if (approve) {
      // One ID, one verified account: an ID already verified on another account cannot be passed here.
      const heldElsewhere = await tx.identityVerification.findFirst({
        where: { idNumberHash: check.idNumberHash, userId: { not: check.userId }, status: 'PASSED' },
        select: { id: true },
      });
      if (heldElsewhere) {
        throw apiError(409, 'ID_HELD_BY_ANOTHER_ACCOUNT', 'This ID is verified on another account. Resolve that account first.');
      }
    }
    await tx.identityVerification.update({
      where: { id: check.id },
      data: {
        status: approve ? 'PASSED' : 'FAILED',
        nextAction: null,
        reviewedById: staffId,
        completedAt: now,
      },
    });
    if (approve) {
      await tx.user.updateMany({ where: { id: check.userId, identityVerifiedAt: null }, data: { identityVerifiedAt: now } });
    }
    if (check.documentId) {
      // The photo is kept only for the country's retention period after the check is closed (decision 55).
      const { retention } = await this.controls.getCountrySettings(check.user.countryCode);
      const days = retention.identityImagesDays;
      await tx.document.update({
        where: { id: check.documentId },
        data: { status: approve ? 'PASSED' : 'FAILED', deleteAfter: days ? new Date(now.getTime() + days * 86_400_000) : null },
      });
    }
  }

  /** The task, with what the team needs to decide it. Never includes ID numbers beyond their last four characters. */
  private async withDetails(task: ReviewTask, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const base = {
      id: task.id,
      type: task.type,
      countryCode: task.countryCode,
      entityType: task.entityType,
      entityId: task.entityId,
      status: task.status,
      assignedToId: task.assignedToId,
      outcome: task.outcome,
      notes: task.notes,
      dueAt: task.dueAt,
      createdAt: task.createdAt,
      closedAt: task.closedAt,
    };
    if (task.entityType === 'IdentityVerification') {
      const c = await db.identityVerification.findUnique({
        where: { id: task.entityId },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      });
      if (!c) return { ...base, details: null };
      return {
        ...base,
        details: {
          userId: c.user.id,
          accountName: `${c.user.firstName} ${c.user.lastName}`,
          idType: c.idType,
          idNumberLast4: c.idNumberLast4,
          nameOnId: c.nameOnId,
          livenessPassed: c.livenessPassed,
          faceMatchScore: c.faceMatchScore,
          checkStatus: c.status,
          failureReason: c.failureReason,
          documentId: c.documentId,
        },
      };
    }
    if (task.entityType === 'AgentProfile') {
      const p = await db.agentProfile.findUnique({
        where: { userId: task.entityId },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      if (!p) return { ...base, details: null };
      return {
        ...base,
        details: {
          userId: p.userId,
          accountName: `${p.user.firstName} ${p.user.lastName}`,
          businessName: p.businessName,
          registrationNumber: p.registrationNumber,
          profileStatus: p.status,
        },
      };
    }
    return { ...base, details: null };
  }
}
