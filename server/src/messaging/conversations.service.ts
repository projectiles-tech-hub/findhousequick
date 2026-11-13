import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import type { EvaluationContext } from '../controls/feature-evaluator.js';
import { ControlsService } from '../controls/controls.service.js';
import type { RequestUser } from '../controls/request-context.js';
import type { Conversation, Message, Prisma } from '../generated/prisma/client.js';
import { LiveService } from '../live/live.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { checkMessage, WARNING } from './monitoring.js';
import { blockBetween } from './blocks.js';

const PAGE_SIZE = 30;
/** Inspections in these states count as "booked" for sharing phone numbers (Specification 6.1). */
const BOOKED = ['REQUESTED', 'CONFIRMED', 'COMPLETED'] as const;

type ConversationRow = Conversation & { messages: Message[] };

/**
 * Chat between a tenant and the lister of a listing (Specification 6.1). Phone numbers stay hidden until an inspection
 * is booked and both sides agree to share them. Messages are checked automatically for contact and payment details.
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    private readonly live: LiveService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Starts a conversation about a live listing, or reopens the one that already exists. */
  async start(user: RequestUser, listingId: string, firstMessage: string | undefined, ctx: EvaluationContext) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { status: true, createdById: true } });
    if (!listing || listing.status !== 'LIVE') throw new NotFoundException('Listing not found.');
    if (listing.createdById === user.id) throw apiError(400, 'OWN_LISTING', 'You cannot start a conversation about your own listing.');
    if (await blockBetween(this.prisma, user.id, listing.createdById)) throw apiError(403, 'BLOCKED', 'You cannot message this person.');
    const conversation = await this.prisma.conversation.upsert({
      where: { listingId_tenantId_listerId: { listingId, tenantId: user.id, listerId: listing.createdById } },
      create: { listingId, tenantId: user.id, listerId: listing.createdById, tenantReadAt: new Date() },
      update: {},
    });
    if (firstMessage?.trim()) await this.send(user, conversation.id, firstMessage, ctx);
    return this.view(user, conversation.id);
  }

  /** The user's conversations, most recent first. */
  async list(user: RequestUser, cursor?: string) {
    const after = decodeCursor(cursor);
    const rows = await this.prisma.conversation.findMany({
      where: {
        AND: [
          { OR: [{ tenantId: user.id }, { listerId: user.id }] },
          ...(after ? [{ OR: [{ lastMessageAt: { lt: after.at } }, { lastMessageAt: after.at, id: { lt: after.id } }] }] : []),
        ],
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      include: { messages: { orderBy: { id: 'desc' }, take: 1 } },
    });
    const mine = rows;
    const page = mine.slice(0, PAGE_SIZE);
    const items = [];
    for (const c of page) items.push(await this.toView(user, c));
    const last = page[page.length - 1];
    return { items, nextCursor: mine.length > PAGE_SIZE && last ? `${last.lastMessageAt.toISOString()}_${last.id}` : null };
  }

  /** Messages, newest first. Opening the newest page marks the conversation read. */
  async messages(user: RequestUser, conversationId: string, cursor?: string) {
    const c = await this.participantOf(user, conversationId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId, ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: 'desc' },
      take: PAGE_SIZE + 1,
    });
    const page = rows.slice(0, PAGE_SIZE);
    if (!cursor) await this.markRead(user, c);
    return { items: page.map(toMessage), nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1]!.id : null };
  }

  /** Sends a text message. A message that looks like contact or payment details is still sent, with a warning. */
  async send(user: RequestUser, conversationId: string, body: string, ctx: EvaluationContext) {
    const c = await this.participantOf(user, conversationId);
    const text = body.trim();
    if (!text) throw apiError(400, 'BAD_REQUEST', 'A message cannot be empty.');
    // While either has blocked the other, nothing more is sent (decision 88). The words do not say who blocked whom.
    if (await blockBetween(this.prisma, user.id, c.tenantId === user.id ? c.listerId : c.tenantId)) {
      throw apiError(403, 'BLOCKED', 'You can no longer send messages in this conversation.');
    }
    const flags = (await this.controls.isEnabled('trust.chat_monitoring', ctx)) ? checkMessage(text) : [];
    const now = new Date();
    const message = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({
        data: { conversationId, senderId: user.id, body: text, ...(flags.length ? { flags: { found: flags } } : {}) },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now, ...(c.tenantId === user.id ? { tenantReadAt: now } : { listerReadAt: now }) },
      });
      if (flags.length) {
        await tx.auditLog.create({
          data: { actorId: user.id, action: 'chat.flagged', entityType: 'Message', entityId: m.id, metadata: { conversationId, flags } },
        });
      }
      return m;
    });
    await this.announce(user, c, message);
    return { ...toMessage(message), warning: flags.length ? WARNING : null };
  }

  /** Adds a line to the chat for a call (answered, missed or declined), so both sides see it in the history. */
  async addCallLine(conversationId: string, senderId: string, text: string): Promise<void> {
    const c = await this.prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    const message = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({ data: { conversationId, senderId, kind: 'CALL', body: text } });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: m.createdAt } });
      return m;
    });
    await this.live.publish([c.tenantId, c.listerId], 'message.created', { conversationId, message: toMessage(message) });
  }

  /**
   * One side agrees to share phone numbers. Allowed once the tenant has booked an inspection of the listing; the numbers
   * are shown only when both sides have agreed.
   */
  async sharePhones(user: RequestUser, conversationId: string) {
    const c = await this.participantOf(user, conversationId);
    const booked = await this.prisma.inspection.count({ where: { listingId: c.listingId, tenantId: c.tenantId, status: { in: [...BOOKED] } } });
    if (!booked) throw apiError(409, 'INSPECTION_NOT_BOOKED', 'Phone numbers can be shared once an inspection is booked.');
    const now = new Date();
    const data: Prisma.ConversationUpdateInput = c.tenantId === user.id ? { tenantPhoneConsentAt: c.tenantPhoneConsentAt ?? now } : { listerPhoneConsentAt: c.listerPhoneConsentAt ?? now };
    const updated = await this.prisma.conversation.update({ where: { id: conversationId }, data });
    if (!updated.phonesSharedAt && updated.tenantPhoneConsentAt && updated.listerPhoneConsentAt) {
      await this.prisma.$transaction([
        this.prisma.conversation.update({ where: { id: conversationId }, data: { phonesSharedAt: now } }),
        this.prisma.auditLog.create({ data: { actorId: user.id, action: 'chat.phones_shared', entityType: 'Conversation', entityId: conversationId } }),
      ]);
    }
    return this.view(user, conversationId);
  }

  /** The conversation, checking the user is one of its two sides. */
  async participantOf(user: RequestUser, conversationId: string): Promise<Conversation> {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!c) throw new NotFoundException('Conversation not found.');
    if (c.tenantId !== user.id && c.listerId !== user.id) throw new ForbiddenException('This conversation is not yours.');
    return c;
  }

  async view(user: RequestUser, conversationId: string) {
    const c = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { messages: { orderBy: { id: 'desc' }, take: 1 } },
    });
    return this.toView(user, c);
  }

  private async toView(user: RequestUser, c: ConversationRow) {
    const iAmTenant = c.tenantId === user.id;
    const otherId = iAmTenant ? c.listerId : c.tenantId;
    const readAt = iAmTenant ? c.tenantReadAt : c.listerReadAt;
    const [other, unreadCount, block] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: otherId }, select: { firstName: true, lastName: true, phone: true, status: true } }),
      this.prisma.message.count({ where: { conversationId: c.id, senderId: { not: user.id }, ...(readAt ? { createdAt: { gt: readAt } } : {}) } }),
      blockBetween(this.prisma, user.id, otherId),
    ]);
    const deleted = other.status === 'DELETED';
    const myConsent = iAmTenant ? c.tenantPhoneConsentAt : c.listerPhoneConsentAt;
    const theirConsent = iAmTenant ? c.listerPhoneConsentAt : c.tenantPhoneConsentAt;
    return {
      id: c.id,
      listingId: c.listingId,
      role: iAmTenant ? 'TENANT' : 'LISTER',
      // A deleted account shows no name or number (decision 87).
      otherParty: { id: otherId, displayName: deleted ? null : `${other.firstName} ${other.lastName}`.trim(), phone: c.phonesSharedAt && !deleted ? other.phone : null, deleted },
      /** BLOCKED_BY_YOU shows "You blocked ..." with Unblock; CANNOT_REPLY tells the other side only that no more messages can be sent. */
      canSend: !block && !deleted,
      block: block === 'BY_YOU' ? 'BLOCKED_BY_YOU' : block === 'BY_THEM' ? 'CANNOT_REPLY' : null,
      phoneSharing: { youAgreed: !!myConsent, theyAgreed: !!theirConsent, shared: !!c.phonesSharedAt },
      lastMessage: c.messages[0] ? toMessage(c.messages[0]) : null,
      lastMessageAt: c.lastMessageAt,
      unreadCount,
    };
  }

  private async markRead(user: RequestUser, c: Conversation): Promise<void> {
    const now = new Date();
    const iAmTenant = c.tenantId === user.id;
    await this.prisma.conversation.update({ where: { id: c.id }, data: iAmTenant ? { tenantReadAt: now } : { listerReadAt: now } });
    await this.live.publish([iAmTenant ? c.listerId : c.tenantId], 'conversation.read', { conversationId: c.id, readerId: user.id, readAt: now });
  }

  private async announce(user: RequestUser, c: Conversation, message: Message): Promise<void> {
    const otherId = c.tenantId === user.id ? c.listerId : c.tenantId;
    await this.live.publish([c.tenantId, c.listerId], 'message.created', { conversationId: c.id, message: toMessage(message) });
    const sender = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { firstName: true } });
    await this.notifications.notify(otherId, 'NEW_MESSAGE', {
      title: `Message from ${sender.firstName}`,
      body: message.body.length > 120 ? `${message.body.slice(0, 117)}...` : message.body,
      data: { conversationId: c.id },
    });
  }
}

function toMessage(m: Message) {
  return { id: m.id, senderId: m.senderId, kind: m.kind, body: m.body, createdAt: m.createdAt };
}

function decodeCursor(cursor?: string): { at: Date; id: string } | null {
  if (!cursor) return null;
  const i = cursor.lastIndexOf('_');
  const at = new Date(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  if (i < 0 || Number.isNaN(at.getTime()) || !/^[0-9a-f-]{36}$/i.test(id)) throw apiError(400, 'BAD_REQUEST', 'The cursor is not valid.');
  return { at, id };
}
