import { parseCountrySettings } from '../controls/country-settings.schema.js';
import { Inject, Injectable } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { ControlsService } from '../controls/controls.service.js';
import type { RequestUser } from '../controls/request-context.js';
import type { EnforcementKind, Prisma, ReviewTask } from '../generated/prisma/client.js';
import { PRIVATE_STORAGE, type PrivateStorage } from '../integrations/storage/private-storage.js';
import { AlertsService } from '../notifications/alerts.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
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
    private readonly alerts: AlertsService,
    private readonly notifications: NotificationsService,
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
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ReviewTask" WHERE "id" = ${taskId}::uuid FOR UPDATE`;
      const task = await tx.reviewTask.findUnique({ where: { id: taskId } });
      if (!task || !inScope(staff, task.countryCode)) throw apiError(404, 'NOT_FOUND', 'Task not found.');
      if (task.status === 'DONE' || task.status === 'CANCELLED') throw apiError(409, 'TASK_CLOSED', 'This task has already been decided.');
      const now = new Date();
      // Each kind of task takes its own outcomes.
      const only = (...allowed: ReviewDecisionDto['outcome'][]) => {
        if (!allowed.includes(dto.outcome)) throw apiError(400, 'OUTCOME_NOT_SUPPORTED', `This kind of task takes ${allowed.join(', ')}.`, { allowed });
      };
      const approve = dto.outcome === 'APPROVE';

      switch (task.type) {
        case 'IDENTITY_REVIEW':
          only('APPROVE', 'REJECT');
          await this.decideIdentity(tx, task, actor.id, approve, now);
          break;
        case 'DUPLICATE_RESOLUTION':
          only('APPROVE', 'REJECT');
          if (task.entityType === 'Building') await this.decideBuildingDuplicate(tx, task, actor.id, approve);
          else await this.decideIdentity(tx, task, actor.id, approve, now);
          break;
        case 'AGENT_PROFILE_REVIEW': {
          only('APPROVE', 'REJECT');
          if (task.entityId === actor.id) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
          await tx.agentProfile.update({
            where: { userId: task.entityId },
            data: { status: approve ? 'PASSED' : 'FAILED', reviewedAt: now },
          });
          break;
        }
        case 'LISTING_REVIEW':
          only('APPROVE', 'REJECT', 'NEEDS_SITE_VISIT');
          if (dto.outcome === 'NEEDS_SITE_VISIT') await this.sendForSiteVisit(tx, task, actor.id, dto.notes);
          else await this.decideListing(tx, task, actor.id, approve, now);
          break;
        case 'SITE_VISIT':
          only('APPROVE', 'REJECT');
          await this.decideListing(tx, task, actor.id, approve, now);
          break;
        case 'RANDOM_AUDIT':
          only('APPROVE', 'REJECT');
          await this.decideAudit(tx, task, actor.id, approve);
          break;
        case 'AUTHORITY_CONFIRMATION':
          only('APPROVE', 'REJECT');
          await this.decideAuthority(tx, task, actor.id, approve, now);
          break;
        case 'REPORT':
          only('NO_ACTION', 'WARN_USER', 'REMOVE_BADGE', 'SUSPEND_USER', 'BAN_USER', 'NEEDS_SITE_VISIT');
          await this.decideReport(tx, task, actor.id, dto, now);
          break;
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
    // After the decision is saved: tell the lister, and alert tenants whose saved areas cover a newly live listing.
    if ((result.type === 'LISTING_REVIEW' || result.type === 'SITE_VISIT') && dto.outcome !== 'NEEDS_SITE_VISIT') {
      const listing = await this.prisma.listing.findUnique({ where: { id: result.entityId }, select: { id: true, title: true, createdById: true, status: true } });
      if (listing) {
        const live = listing.status === 'LIVE';
        await this.notifications.notify(listing.createdById, 'LISTING_UPDATE', {
          title: live ? 'Your listing is live' : 'Your listing needs changes',
          body: live ? `${listing.title} is now live on FindHouseQuick.` : `${listing.title} was not approved. Open it to see what to correct.`,
          data: { listingId: listing.id },
        });
        if (live) await this.alerts.listingWentLive(listing.id);
      }
    }
    if (result.type === 'REPORT') await this.afterReport(result.entityId, dto);
    return result;
  }

  /** A desk reviewer asks for a visit: the listing keeps waiting and a site visit task is opened. */
  private async sendForSiteVisit(tx: Prisma.TransactionClient, task: ReviewTask, staffId: string, notes: string) {
    const listing = await tx.listing.findUnique({ where: { id: task.entityId }, include: { unit: { include: { building: true } } } });
    if (!listing) throw apiError(404, 'NOT_FOUND', 'The listing no longer exists.');
    if (listing.createdById === staffId || listing.unit.building.ownerId === staffId) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
    if (listing.status !== 'IN_REVIEW') throw apiError(409, 'TASK_CLOSED', 'This listing is no longer waiting for review.');
    await tx.reviewTask.create({
      data: { type: 'SITE_VISIT', countryCode: task.countryCode, entityType: 'Listing', entityId: listing.id, notes: `Asked for at the desk review: ${notes}`.slice(0, 1000) },
    });
  }

  /** A random visit of a live listing (Specification 6.4). Approve leaves it live; reject takes it down for correction. */
  private async decideAudit(tx: Prisma.TransactionClient, task: ReviewTask, staffId: string, approve: boolean) {
    const listing = await tx.listing.findUnique({ where: { id: task.entityId }, include: { unit: { include: { building: true } } } });
    if (!listing) throw apiError(404, 'NOT_FOUND', 'The listing no longer exists.');
    if (listing.createdById === staffId || listing.unit.building.ownerId === staffId) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
    if (!approve) await tx.listing.updateMany({ where: { id: listing.id, status: { in: ['LIVE', 'PAUSED'] } }, data: { status: 'REJECTED' } });
  }

  /**
   * A building flagged as a possible duplicate when it was registered (Specification 6.5). Approve: it is a different
   * building. Reject: it is the same property, so its open listings are taken down.
   */
  private async decideBuildingDuplicate(tx: Prisma.TransactionClient, task: ReviewTask, staffId: string, approve: boolean) {
    const building = await tx.building.findUnique({ where: { id: task.entityId }, select: { id: true, ownerId: true, createdById: true } });
    if (!building) throw apiError(404, 'NOT_FOUND', 'The building no longer exists.');
    if (building.ownerId === staffId || building.createdById === staffId) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
    if (!approve) {
      await tx.listing.updateMany({
        where: { unit: { buildingId: building.id }, status: { in: ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'LIVE', 'PAUSED'] } },
        data: { status: 'REJECTED' },
      });
    }
  }

  /**
   * A report about a listing (Specification 7.2 and 7.3, decision 51). The team may take no action, warn the lister,
   * remove their verified badge, suspend or ban them, or ask for a visit. Each sanction is recorded against the
   * lister's verified identity. Suspending or banning always takes their listings down; otherwise the reported
   * listing is taken down when removeListing is set.
   */
  private async decideReport(tx: Prisma.TransactionClient, task: ReviewTask, staffId: string, dto: ReviewDecisionDto, now: Date) {
    const report = await tx.listingReport.findUnique({ where: { id: task.entityId }, include: { listing: { select: { id: true, createdById: true } } } });
    if (!report) throw apiError(404, 'NOT_FOUND', 'The report no longer exists.');
    const listerId = report.listing.createdById;
    if (listerId === staffId || report.reporterId === staffId) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
    await tx.listingReport.update({ where: { id: report.id }, data: { status: 'DONE' } });

    if (dto.outcome === 'NEEDS_SITE_VISIT') {
      await tx.reviewTask.create({
        data: { type: 'RANDOM_AUDIT', countryCode: task.countryCode, entityType: 'Listing', entityId: report.listingId, notes: `Visit after a report (${report.reason}): ${dto.notes}`.slice(0, 1000) },
      });
    }
    const kind = ({ WARN_USER: 'WARNING', REMOVE_BADGE: 'BADGE_REMOVED', SUSPEND_USER: 'SUSPENSION', BAN_USER: 'BAN' } as const)[dto.outcome as 'WARN_USER'];
    if (kind) await this.sanction(tx, listerId, kind, task, staffId, dto.notes, now);
    if (dto.removeListing && dto.outcome !== 'NO_ACTION') {
      await tx.listing.updateMany({ where: { id: report.listingId, status: { in: ['LIVE', 'PAUSED'] } }, data: { status: 'REMOVED' } });
    }
  }

  /** Applies a sanction and records it against the user's verified identity (decision 51). */
  private async sanction(tx: Prisma.TransactionClient, userId: string, kind: EnforcementKind, task: ReviewTask, staffId: string, reason: string, now: Date) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { countryCode: true, staff: { select: { active: true } } } });
    if (user.staff?.active) throw apiError(409, 'STAFF_ACCOUNT', 'A staff account is handled by a super admin, not through a report.');
    const identity = await tx.identityVerification.findFirst({ where: { userId, status: 'PASSED' }, orderBy: { completedAt: 'desc' }, select: { idType: true, idNumberHash: true } });
    await tx.enforcementAction.create({
      data: { userId, kind, reason, reviewTaskId: task.id, staffId, countryCode: user.countryCode, idType: identity?.idType ?? null, idNumberHash: identity?.idNumberHash ?? null },
    });
    if (kind === 'BADGE_REMOVED') await tx.user.update({ where: { id: userId }, data: { badgeRemovedAt: now } });
    if (kind === 'SUSPENSION' || kind === 'BAN') {
      await tx.user.update({ where: { id: userId }, data: { status: kind === 'BAN' ? 'BANNED' : 'SUSPENDED' } });
      // Every device is signed out, and their listings leave the search: paused for a suspension, removed for a ban.
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.pushDevice.deleteMany({ where: { userId } });
      if (kind === 'SUSPENSION') await tx.listing.updateMany({ where: { createdById: userId, status: 'LIVE' }, data: { status: 'PAUSED' } });
      else await tx.listing.updateMany({ where: { createdById: userId, status: { in: ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'LIVE', 'PAUSED', 'REJECTED'] } }, data: { status: 'REMOVED' } });
    }
    await tx.auditLog.create({
      data: { actorId: staffId, action: `enforcement.${kind.toLowerCase()}`, entityType: 'User', entityId: userId, metadata: { taskId: task.id, reason } },
    });
  }

  /** After a report is decided: a warning or badge removal is told to the lister; the reporter is thanked. */
  private async afterReport(reportId: string, dto: ReviewDecisionDto) {
    const report = await this.prisma.listingReport.findUnique({ where: { id: reportId }, include: { listing: { select: { id: true, title: true, createdById: true } } } });
    if (!report) return;
    if (dto.outcome === 'WARN_USER' || dto.outcome === 'REMOVE_BADGE') {
      await this.notifications.notify(report.listing.createdById, 'LISTING_UPDATE', {
        title: dto.outcome === 'WARN_USER' ? 'Warning about your listing' : 'Your verified badge was removed',
        body: `After a report about ${report.listing.title}, our team reviewed your account. Please open the app for details.`,
        data: { listingId: report.listing.id },
      });
    }
    await this.notifications.notify(report.reporterId, 'LISTING_UPDATE', {
      title: 'Your report was reviewed',
      body: `Thank you. Our team has reviewed your report about ${report.listing.title}.`,
      data: { listingId: report.listing.id },
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

  /**
   * Desk review of a listing (ADR 0009). Approving makes it live, starts its availability clock and passes the
   * building's ownership documents; rejecting returns it to the lister, who may correct it and submit again.
   */
  private async decideListing(tx: Prisma.TransactionClient, task: ReviewTask, staffId: string, approve: boolean, now: Date) {
    const listing = await tx.listing.findUnique({ where: { id: task.entityId }, include: { unit: { include: { building: true } } } });
    if (!listing) throw apiError(404, 'NOT_FOUND', 'The listing no longer exists.');
    const building = listing.unit.building;
    if (listing.createdById === staffId || building.ownerId === staffId) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
    if (listing.status !== 'IN_REVIEW') throw apiError(409, 'TASK_CLOSED', 'This listing is no longer waiting for review.');
    if (!approve) {
      await tx.listing.update({ where: { id: listing.id }, data: { status: 'REJECTED' } });
      return;
    }
    const country = await tx.country.findUniqueOrThrow({ where: { code: building.countryCode } });
    const days = parseCountrySettings(country.settings).listings.confirmAvailabilityDays;
    await tx.listing.update({
      where: { id: listing.id },
      data: { status: 'LIVE', publishedAt: now, lastConfirmedAt: now, expiresAt: new Date(now.getTime() + days * 86_400_000) },
    });
    await tx.document.updateMany({ where: { buildingId: building.id, purpose: 'OWNERSHIP', uploadedAt: { not: null }, status: 'PENDING' }, data: { status: 'PASSED' } });
  }

  /** The team has called the landlord about an agent's letter of authority (Specification 3.5). */
  private async decideAuthority(tx: Prisma.TransactionClient, task: ReviewTask, staffId: string, approve: boolean, now: Date) {
    const authority = await tx.propertyAuthority.findUnique({ where: { id: task.entityId } });
    if (!authority) throw apiError(404, 'NOT_FOUND', 'The request no longer exists.');
    if (authority.agentId === staffId) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
    if (authority.status !== 'REQUESTED') throw apiError(409, 'TASK_CLOSED', 'This request has already been decided.');
    await tx.propertyAuthority.update({
      where: { id: authority.id },
      data: { status: approve ? 'APPROVED' : 'REJECTED', decidedAt: now, reviewedById: staffId },
    });
    if (authority.letterDocumentId) {
      await tx.document.update({ where: { id: authority.letterDocumentId }, data: { status: approve ? 'PASSED' : 'FAILED' } });
    }
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
    if (task.entityType === 'Listing') {
      const l = await db.listing.findUnique({ where: { id: task.entityId }, select: { id: true, title: true, status: true, riskScore: true, riskBand: true, submittedAt: true, createdById: true } });
      if (!l) return { ...base, details: null };
      // The results of the latest run of the automatic checks (Specification 6.3).
      const checks = await db.verificationCheck.findMany({ where: { listingId: l.id, ...(l.submittedAt ? { ranAt: { gte: l.submittedAt } } : {}) }, orderBy: { ranAt: 'asc' } });
      return {
        ...base,
        details: {
          listingId: l.id,
          title: l.title,
          listingStatus: l.status,
          listerId: l.createdById,
          riskScore: l.riskScore,
          riskBand: l.riskBand,
          checks: checks.map((c) => ({ type: c.type, result: c.result, riskPoints: c.riskPoints, details: c.details })),
        },
      };
    }
    if (task.entityType === 'ListingReport') {
      const r = await db.listingReport.findUnique({ where: { id: task.entityId }, include: { listing: { select: { id: true, title: true, status: true, createdById: true } } } });
      if (!r) return { ...base, details: null };
      // Earlier sanctions guide the next one: a warning, then the badge, then suspension (Specification 7.2).
      const earlier = await db.enforcementAction.findMany({ where: { userId: r.listing.createdById }, orderBy: { createdAt: 'asc' }, select: { kind: true, createdAt: true } });
      return {
        ...base,
        details: {
          reportId: r.id,
          reason: r.reason,
          reportDetails: r.details,
          reporterId: r.reporterId,
          listingId: r.listing.id,
          title: r.listing.title,
          listingStatus: r.listing.status,
          listerId: r.listing.createdById,
          earlierSanctions: earlier,
        },
      };
    }
    return { ...base, details: null };
  }
}
