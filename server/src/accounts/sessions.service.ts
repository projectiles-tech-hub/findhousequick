import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import type { Env } from '../config/env.js';
import { apiError } from '../common/api-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateToken, hashToken } from './secrets.js';

const ISSUER = 'findhousequick';
const AUDIENCE = 'findhousequick-apps';

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}

export interface AccessClaims {
  userId: string;
  /** The signed-in device (refresh token family). */
  sessionId: string;
}

/**
 * Sign-in sessions.
 *
 * - The **access token** proves who the user is on each request. It is short-lived (ACCESS_TOKEN_MINUTES)
 *   and signed by the server, so it can be checked without storing it.
 * - The **refresh token** is a long random value the app keeps safely and swaps for a new pair of tokens
 *   when the access token runs out. Only its hash is stored. Each one works once.
 * - Every token issued to one signed-in device shares a **family** id. Signing out ends the family.
 *   If a refresh token that was already used comes back, someone copied it, so the family is ended.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly key: Uint8Array;
  private readonly accessMinutes: number;
  private readonly refreshDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.key = new TextEncoder().encode(config.get('JWT_SECRET', { infer: true }));
    this.accessMinutes = config.get('ACCESS_TOKEN_MINUTES', { infer: true });
    this.refreshDays = config.get('REFRESH_TOKEN_DAYS', { infer: true });
  }

  /** Signs a device in: a new family with its first refresh token. */
  async start(userId: string, device: string | null): Promise<IssuedTokens> {
    return this.issue(userId, randomUUID(), device);
  }

  /** Swaps a refresh token for new tokens. Returns the user id with them. */
  async refresh(refreshToken: string): Promise<IssuedTokens & { userId: string }> {
    const invalid = () => apiError(401, 'SESSION_INVALID', 'Your session has ended. Please sign in again.');
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) throw invalid();

    // Mark it used; only one request can do this, even if two arrive together.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, usedAt: null, revokedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await this.endFamily(row.familyId);
      await this.prisma.auditLog.create({
        data: {
          actorId: row.userId,
          action: 'auth.refresh_token_reused',
          entityType: 'RefreshTokenFamily',
          entityId: row.familyId,
        },
      });
      this.logger.warn(`Reused refresh token; signed out family ${row.familyId}`);
      throw invalid();
    }

    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { status: true } });
    if (user?.status !== 'ACTIVE') {
      await this.endFamily(row.familyId);
      throw invalid();
    }
    return { userId: row.userId, ...(await this.issue(row.userId, row.familyId, row.device, row.twoStepAt)) };
  }

  /** Signs a device out. */
  async endFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Signs every device of a user out (for example after a password reset or suspension). */
  async endAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Checks an access token's signature and expiry. Throws an error with a code the apps can act on. */
  async verifyAccessToken(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
      if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new Error('wrong token type');
      }
      return { userId: payload.sub, sessionId: payload.sid };
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) {
        throw apiError(401, 'TOKEN_EXPIRED', 'Your sign-in has expired. Please refresh it.');
      }
      throw apiError(401, 'UNAUTHENTICATED', 'Please sign in.');
    }
  }

  /** Marks a signed-in device as having passed the second step of two-step login (staff, ADR 0005). */
  async markTwoStepPassed(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { twoStepAt: new Date() } });
  }

  private async issue(
    userId: string,
    familyId: string,
    device: string | null,
    twoStepAt: Date | null = null,
  ): Promise<IssuedTokens> {
    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + this.accessMinutes * 60_000);
    const accessToken = await new SignJWT({ typ: 'access', sid: familyId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(accessTokenExpiresAt.getTime() / 1000))
      .sign(this.key);

    const refreshToken = generateToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(refreshToken),
        device: device?.slice(0, 100) ?? null,
        // A device that passed the second step keeps that status when its tokens are renewed.
        twoStepAt,
        expiresAt: new Date(now + this.refreshDays * 24 * 60 * 60_000),
      },
    });
    return { accessToken, accessTokenExpiresAt, refreshToken };
  }
}
