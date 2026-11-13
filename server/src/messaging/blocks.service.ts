import { Injectable } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { ControlsService } from '../controls/controls.service.js';
import type { RequestUser } from '../controls/request-context.js';
import { LiveService } from '../live/live.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConversationsService } from './conversations.service.js';

/**
 * Blocking another user in chat (decision 88; Specification 7.1). While a block stands, neither person can message or
 * call the other, nor book an inspection with the other. The blocked person is not told; their conversation simply
 * accepts no more messages. Blocks are kept as records after unblocking.
 */
@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    private readonly conversations: ConversationsService,
    private readonly live: LiveService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Blocks the other person in a conversation, cancelling inspections booked between them; optionally reports them. */
  async block(user: RequestUser, conversationId: string, report?: { details?: string }) {
    const c = await this.conversations.participantOf(user, conversationId);
    const otherId = c.tenantId === user.id ? c.listerId : c.tenantId;
    const existing = await this.prisma.userBlock.findFirst({ where: { blockerId: user.id, blockedId: otherId, unblockedAt: null } });
    if (!existing) await this.prisma.userBlock.create({ data: { blockerId: user.id, blockedId: otherId, conversationId } });

    // Inspections booked between them, either way round, are cancelled; both are told it is cancelled, nothing more.
    const open = await this.prisma.inspection.findMany({
      where: { status: { in: ['REQUESTED', 'CONFIRMED'] }, OR: [{ tenantId: user.id, hostId: otherId }, { tenantId: otherId, hostId: user.id }] },
      include: { listing: { select: { title: true } } },
    });
    for (const i of open) {
      await this.prisma.inspection.update({ where: { id: i.id }, data: { status: 'CANCELLED', cancelReason: 'BLOCKED', closedById: user.id } });
      await this.live.publish([i.tenantId, i.hostId], 'inspection.updated', { inspectionId: i.id, listingId: i.listingId, status: 'CANCELLED', scheduledAt: i.scheduledAt });
      await this.notifications.notify(otherId, 'INSPECTION_UPDATE', { title: 'Inspection cancelled', body: `The inspection of ${i.listing.title} is cancelled.`, data: { inspectionId: i.id, listingId: i.listingId } });
    }

    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { countryCode: true } });
    if (report) {
      await this.prisma.reviewTask.create({
        data: { type: 'REPORT', countryCode: me.countryCode, entityType: 'User', entityId: otherId, notes: `Reported when blocked, from conversation ${conversationId}. ${report.details?.trim() ?? ''}`.trim() },
      });
    }
    // Many different people blocking one account sends it to the trust team; a block on its own leads to no penalty.
    const { verification } = await this.controls.getCountrySettings(me.countryCode);
    const blockers = await this.prisma.userBlock.findMany({ where: { blockedId: otherId, unblockedAt: null }, distinct: ['blockerId'], select: { blockerId: true } });
    if (blockers.length >= verification.blocksForReview) {
      const open = await this.prisma.reviewTask.count({ where: { type: 'REPORT', entityType: 'User', entityId: otherId, status: 'OPEN', notes: { startsWith: 'Blocked by' } } });
      if (!open) {
        await this.prisma.reviewTask.create({
          data: { type: 'REPORT', countryCode: me.countryCode, entityType: 'User', entityId: otherId, notes: `Blocked by ${blockers.length} different people.` },
        });
      }
    }
    await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'chat.blocked', entityType: 'User', entityId: otherId, metadata: { conversationId, reported: !!report } } });
    return this.conversations.view(user, conversationId);
  }

  async unblock(user: RequestUser, blockedId: string) {
    const done = await this.prisma.userBlock.updateMany({ where: { blockerId: user.id, blockedId, unblockedAt: null }, data: { unblockedAt: new Date() } });
    if (!done.count) throw apiError(404, 'NOT_BLOCKED', 'You have not blocked this person.');
    await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'chat.unblocked', entityType: 'User', entityId: blockedId } });
  }

  /** The people the user has blocked, newest first, for the settings screen. */
  async list(user: RequestUser) {
    const rows = await this.prisma.userBlock.findMany({ where: { blockerId: user.id, unblockedAt: null }, orderBy: { createdAt: 'desc' } });
    const people = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.blockedId) } }, select: { id: true, firstName: true, lastName: true } });
    const byId = new Map(people.map((p) => [p.id, p]));
    return {
      items: rows.map((r) => {
        const p = byId.get(r.blockedId);
        return { userId: r.blockedId, displayName: p ? `${p.firstName} ${p.lastName}`.trim() : '', blockedAt: r.createdAt };
      }),
    };
  }
}
