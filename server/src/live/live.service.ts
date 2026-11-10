import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { Redis } from 'ioredis';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { SessionsService } from '../accounts/sessions.service.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const LIVE_PATH = '/v1/live';
const CHANNEL = 'fhq:live';
/** A connection that has not sent its sign-in token within this time is closed. */
const AUTH_TIMEOUT_MS = 10_000;
const PING_MS = 30_000;

export type LiveEvent =
  | 'message.created'
  | 'conversation.read'
  | 'inspection.updated'
  | 'call.ringing'
  | 'call.answered'
  | 'call.ended'
  | 'notification';

interface Envelope {
  userIds: string[];
  event: LiveEvent;
  data: unknown;
}

type LiveSocket = WebSocket & { userId?: string; sessionId?: string; alive?: boolean };

/**
 * The live connection (decision 47). Signed-in apps open a WebSocket at /v1/live and send their access token as the
 * first message; the server then pushes events to them as they happen.
 *
 * With several servers, an event is published on Redis and every server passes it to the connections it holds. If
 * Redis cannot be reached, the server still delivers to its own connections; the push notification sent alongside
 * covers the rest.
 */
@Injectable()
export class LiveService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Live');
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  private readonly byUser = new Map<string, Set<LiveSocket>>();
  private pub?: Redis;
  private sub?: Redis;
  private ping?: NodeJS.Timeout;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly config: ConfigService<Env, true>,
    private readonly sessions: SessionsService,
    private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    const server = this.adapterHost.httpAdapter?.getHttpServer() as Server | undefined;
    server?.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      if (new URL(req.url ?? '/', 'http://x').pathname !== LIVE_PATH) return;
      this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws as LiveSocket));
    });
    this.ping = setInterval(() => {
      for (const ws of this.wss.clients as Set<LiveSocket>) {
        if (ws.alive === false) {
          ws.terminate();
          continue;
        }
        ws.alive = false;
        ws.ping();
      }
      void this.recheckSessions();
    }, PING_MS);
    this.ping.unref();

    const url = this.config.get('REDIS_URL', { infer: true });
    const opts = { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 2_000 };
    this.pub = new Redis(url, opts);
    this.sub = new Redis(url, { ...opts, enableOfflineQueue: true });
    this.pub.on('error', () => undefined);
    this.sub.on('error', () => undefined);
    this.sub.subscribe(CHANNEL).catch(() => undefined);
    this.sub.on('message', (_channel, raw) => {
      try {
        this.deliverLocal(JSON.parse(raw) as Envelope);
      } catch {
        // A bad message on the channel is ignored.
      }
    });
  }

  /** Sends an event to every open connection of these users, on every server. */
  async publish(userIds: string[], event: LiveEvent, data: unknown): Promise<void> {
    const envelope: Envelope = { userIds: [...new Set(userIds)], event, data };
    try {
      if (this.pub?.status !== 'ready') throw new Error('Redis not ready');
      await this.pub.publish(CHANNEL, JSON.stringify(envelope));
    } catch {
      this.deliverLocal(envelope);
    }
  }

  /** How many connections a user has open on this server (for tests and support). */
  connectionsOf(userId: string): number {
    return this.byUser.get(userId)?.size ?? 0;
  }

  private accept(ws: LiveSocket): void {
    ws.alive = true;
    ws.on('pong', () => (ws.alive = true));
    const timer = setTimeout(() => ws.close(4401, 'Sign in first'), AUTH_TIMEOUT_MS);
    ws.once('message', async (raw) => {
      clearTimeout(timer);
      try {
        const token = String(raw).trim();
        const claims = await this.sessions.verifyAccessToken(token);
        const user = await this.prisma.user.findUnique({
          where: { id: claims.userId },
          select: { status: true, refreshTokens: { where: { familyId: claims.sessionId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true }, take: 1 } },
        });
        if (!user || user.status !== 'ACTIVE' || user.refreshTokens.length === 0) throw new Error('session');
        ws.userId = claims.userId;
        ws.sessionId = claims.sessionId;
        const set = this.byUser.get(claims.userId) ?? new Set<LiveSocket>();
        set.add(ws);
        this.byUser.set(claims.userId, set);
        ws.send(JSON.stringify({ event: 'ready', data: { userId: claims.userId } }));
      } catch {
        ws.close(4401, 'Sign-in not valid');
      }
    });
    ws.on('close', () => {
      clearTimeout(timer);
      if (!ws.userId) return;
      const set = this.byUser.get(ws.userId);
      set?.delete(ws);
      if (set && set.size === 0) this.byUser.delete(ws.userId);
    });
  }

  private deliverLocal(e: Envelope): void {
    const text = JSON.stringify({ event: e.event, data: e.data });
    for (const id of e.userIds) {
      for (const ws of this.byUser.get(id) ?? []) if (ws.readyState === WebSocket.OPEN) ws.send(text);
    }
  }

  /**
   * Closes connections whose device has signed out or whose account was suspended, on whichever server holds them.
   * Run with each ping, in one query for all connections on this server.
   */
  async recheckSessions(): Promise<void> {
    const sockets = [...this.wss.clients as Set<LiveSocket>].filter((ws) => ws.sessionId);
    if (!sockets.length) return;
    try {
      const valid = await this.prisma.refreshToken.findMany({
        where: { familyId: { in: [...new Set(sockets.map((ws) => ws.sessionId!))] }, revokedAt: null, expiresAt: { gt: new Date() }, user: { status: 'ACTIVE' } },
        select: { familyId: true },
      });
      const ok = new Set(valid.map((v) => v.familyId));
      for (const ws of sockets) if (!ok.has(ws.sessionId!)) ws.close(4401, 'Signed out');
    } catch (err) {
      this.logger.warn(`Session recheck failed: ${(err as Error).message}`);
    }
  }

  /** Closes a user's connections, e.g. when they sign out or are suspended. */
  closeFor(userId: string, sessionId?: string): void {
    for (const ws of this.byUser.get(userId) ?? []) if (!sessionId || ws.sessionId === sessionId) ws.close(4401, 'Signed out');
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.ping) clearInterval(this.ping);
    for (const ws of this.wss.clients) ws.terminate();
    this.wss.close();
    this.pub?.disconnect();
    this.sub?.disconnect();
  }
}
