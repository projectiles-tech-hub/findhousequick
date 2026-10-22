import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  HttpException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { apiError } from '../common/api-error.js';
import type { RequestUser } from '../controls/request-context.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { SessionsService } from './sessions.service.js';

/*
 * How sign-in is checked on each request:
 *
 * 1. `authMiddleware` runs before everything else. If the request carries `Authorization: Bearer <token>`,
 *    it checks the token, confirms the account is active and the device is still signed in, and attaches
 *    the user to the request. A bad token is remembered, not rejected, so public routes still work.
 * 2. `AuthGuard` then refuses any route not marked `@Public()` unless a user was attached.
 *
 * Doing the check first means the feature switches and the verification ladder can rely on knowing
 * who the user is.
 */

type AuthedRequest = Request & { user?: RequestUser; authError?: HttpException };

const PUBLIC_KEY = 'fhq:public';

/** Marks a route (or controller) as open to signed-out users. Everything else needs sign-in. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** The signed-in user, in a controller method: `me(@CurrentUser() user: RequestUser)`. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser | undefined => ctx.switchToHttp().getRequest<AuthedRequest>().user,
);

export function authMiddleware(sessions: SessionsService, prisma: PrismaService) {
  return async (req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header) return next();
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match) {
      req.authError = apiError(401, 'UNAUTHENTICATED', 'Please sign in.');
      return next();
    }
    try {
      const claims = await sessions.verifyAccessToken(match[1]);
      // Read the account fresh on every request, so suspension, sign-out and changes to user types
      // take effect at once rather than when the access token runs out.
      const user = await prisma.user.findUnique({
        where: { id: claims.userId },
        select: {
          id: true,
          status: true,
          types: true,
          countryCode: true,
          refreshTokens: {
            where: { familyId: claims.sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!user || user.status === 'DELETED' || user.refreshTokens.length === 0) {
        req.authError = apiError(401, 'SESSION_INVALID', 'Your session has ended. Please sign in again.');
      } else if (user.status !== 'ACTIVE') {
        req.authError = apiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended. Please contact support.');
      } else {
        req.user = { id: user.id, types: user.types, countryCode: user.countryCode, sessionId: claims.sessionId };
      }
    } catch (err) {
      req.authError =
        err instanceof HttpException ? err : apiError(401, 'UNAUTHENTICATED', 'Please sign in.');
    }
    next();
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.user) return true;
    throw req.authError ?? apiError(401, 'UNAUTHENTICATED', 'Please sign in.');
  }
}
