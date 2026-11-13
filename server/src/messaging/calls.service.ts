import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import type { RequestUser } from '../controls/request-context.js';
import type { Call } from '../generated/prisma/client.js';
import { CALL_PROVIDER, type CallProvider } from '../integrations/calls/call-provider.js';
import { LiveService } from '../live/live.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConversationsService } from './conversations.service.js';
import { blockBetween } from './blocks.js';

/** A call nobody answers within this time is missed. */
export const RING_SECONDS = 60;

export type CallAction = 'ANSWER' | 'DECLINE' | 'END';

/**
 * Voice calls inside the app (decision 44), between the two sides of a conversation. Neither side sees the other's
 * phone number: the server sets the call up with the calling service, and the voice runs between the apps and that
 * service. Each call leaves a line in the chat.
 */
@Injectable()
export class CallsService {
  private readonly logger = new Logger('Calls');

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly live: LiveService,
    private readonly notifications: NotificationsService,
    @Inject(CALL_PROVIDER) private readonly provider: CallProvider,
  ) {}

  async start(user: RequestUser, conversationId: string) {
    const c = await this.conversations.participantOf(user, conversationId);
    const calleeId = c.tenantId === user.id ? c.listerId : c.tenantId;
    if (await blockBetween(this.prisma, user.id, calleeId)) throw apiError(403, 'BLOCKED', 'You cannot call this person.');
    const open = await this.prisma.call.count({ where: { conversationId, status: { in: ['RINGING', 'ANSWERED'] } } });
    if (open) throw apiError(409, 'CALL_IN_PROGRESS', 'A call in this conversation is already in progress.');
    const call = await this.prisma.call.create({ data: { conversationId, callerId: user.id, calleeId } });
    let connection: Record<string, unknown>;
    try {
      const setup = await this.provider.createCall(call.id, user.id, calleeId);
      connection = setup.callerConnection;
      await this.prisma.call.update({ where: { id: call.id }, data: { providerRef: setup.providerRef } });
      call.providerRef = setup.providerRef;
    } catch (err) {
      await this.prisma.call.update({ where: { id: call.id }, data: { status: 'ENDED', endedAt: new Date() } });
      this.logger.warn(`Calling service refused call ${call.id}: ${(err as Error).message}`);
      throw apiError(503, 'CALLS_UNAVAILABLE', 'Calls cannot be made at the moment. Please try again or send a message.');
    }
    const caller = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { firstName: true, lastName: true } });
    const callerName = `${caller.firstName} ${caller.lastName}`.trim();
    await this.live.publish([calleeId], 'call.ringing', { call: toCall(call), callerName });
    await this.notifications.notify(
      calleeId,
      'INCOMING_CALL',
      { title: 'Incoming call', body: `${callerName} is calling you on FindHouseQuick.`, data: { callId: call.id, conversationId } },
      { urgent: true },
    );
    return { ...toCall(call), connection };
  }

  async changeStatus(user: RequestUser, callId: string, action: CallAction) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found.');
    if (call.callerId !== user.id && call.calleeId !== user.id) throw new ForbiddenException('This call is not yours.');
    const now = new Date();

    if (action === 'ANSWER' || action === 'DECLINE') {
      if (call.calleeId !== user.id) throw apiError(409, 'NOT_THE_CALLEE', 'Only the person being called can answer or decline.');
      if (call.status !== 'RINGING') throw apiError(409, 'CALL_NOT_RINGING', 'This call is no longer ringing.');
    } else if (call.status !== 'RINGING' && call.status !== 'ANSWERED') {
      throw apiError(409, 'CALL_OVER', 'This call has already ended.');
    }

    if (action === 'ANSWER') {
      // Only one answer counts, e.g. when the call rings on a phone and a computer at once.
      const { count } = await this.prisma.call.updateMany({ where: { id: callId, status: 'RINGING' }, data: { status: 'ANSWERED', answeredAt: now } });
      if (!count) throw apiError(409, 'CALL_NOT_RINGING', 'This call is no longer ringing.');
      const connection = await this.provider.joinCall(call.providerRef ?? '', user.id);
      const updated = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });
      await this.live.publish([call.callerId, call.calleeId], 'call.answered', { call: toCall(updated) });
      return { ...toCall(updated), connection };
    }

    // Declined, or ended by either side. An unanswered call ended by the caller counts as missed.
    const status = action === 'DECLINE' ? 'DECLINED' : call.status === 'ANSWERED' ? 'ENDED' : 'MISSED';
    const updated = await this.finish(call, status, now);
    return updated ? toCall(updated) : toCall(await this.prisma.call.findUniqueOrThrow({ where: { id: callId } }));
  }

  /** Marks calls that rang for too long as missed. Run every minute. */
  async sweepUnanswered(): Promise<number> {
    const stale = await this.prisma.call.findMany({ where: { status: 'RINGING', startedAt: { lt: new Date(Date.now() - RING_SECONDS * 1000) } } });
    for (const call of stale) await this.finish(call, 'MISSED', new Date());
    return stale.length;
  }

  /** Closes the call once, tells both apps, leaves a line in the chat, and tells the callee about a missed call. */
  private async finish(call: Call, status: 'ENDED' | 'DECLINED' | 'MISSED', now: Date): Promise<Call | null> {
    const { count } = await this.prisma.call.updateMany({
      where: { id: call.id, status: { in: ['RINGING', 'ANSWERED'] } },
      data: { status, endedAt: now },
    });
    if (!count) return null;
    const updated = await this.prisma.call.findUniqueOrThrow({ where: { id: call.id } });
    if (call.providerRef) {
      await this.provider.endCall(call.providerRef).catch((err: Error) => this.logger.warn(`Ending call ${call.id} at the service: ${err.message}`));
    }
    await this.live.publish([call.callerId, call.calleeId], 'call.ended', { call: toCall(updated) });
    await this.conversations.addCallLine(call.conversationId, call.callerId, callLine(updated));
    if (status === 'MISSED') {
      const caller = await this.prisma.user.findUniqueOrThrow({ where: { id: call.callerId }, select: { firstName: true } });
      await this.notifications.notify(call.calleeId, 'NEW_MESSAGE', {
        title: 'Missed call',
        body: `You missed a call from ${caller.firstName}.`,
        data: { conversationId: call.conversationId, callId: call.id },
      });
    }
    return updated;
  }
}

function callLine(call: Call): string {
  if (call.status === 'MISSED') return 'Missed call';
  if (call.status === 'DECLINED') return 'Call declined';
  const seconds = call.answeredAt && call.endedAt ? Math.round((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000) : 0;
  const m = Math.floor(seconds / 60);
  return `Call, ${m > 0 ? `${m} min ` : ''}${seconds % 60} sec`;
}

function toCall(c: Call) {
  return { id: c.id, conversationId: c.conversationId, callerId: c.callerId, status: c.status, startedAt: c.startedAt, answeredAt: c.answeredAt, endedAt: c.endedAt };
}
