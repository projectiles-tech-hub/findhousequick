import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { apiError } from '../common/api-error.js';
import type { RequestUser } from '../controls/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LEVELS, nextStep, verificationLevel, type UserTypeName, type VerificationLevel } from './verification-level.js';

/*
 * The verification ladder check (decisions 6, 35, 37 and 64).
 *
 * A route marks the level it needs with @RequireLevel. Before the route runs, the server works out the user's
 * level from the database (never from anything the app sends) and refuses the request with 403
 * VERIFICATION_REQUIRED if it is too low. The answer says which level is needed and what to do next, so the app
 * can guide the user.
 *
 * Every action beyond browsing needs at least level 1 (decision 64), so any route that changes something for the
 * user, other than confirming their own contacts and managing their sign-in, should carry @RequireLevel.
 */

const LEVEL_KEY = 'fhq:requiredLevel';

/** The verification level a route needs: 1 (phone and email confirmed), 2 (identity checked) or 3 (bank account). */
export const RequireLevel = (level: 1 | 2 | 3) => SetMetadata(LEVEL_KEY, level);

/** What the ladder needs to know about one user. */
export const ladderSelect = {
  types: true,
  phone: true,
  phoneVerifiedAt: true,
  email: true,
  emailVerifiedAt: true,
  identityVerifiedAt: true,
  bankAccounts: { where: { status: 'PASSED' }, select: { id: true }, take: 1 },
} as const;

interface LadderRow {
  types: string[];
  phone: string | null;
  phoneVerifiedAt: Date | null;
  email: string | null;
  emailVerifiedAt: Date | null;
  identityVerifiedAt: Date | null;
  bankAccounts: { id: string }[];
}

/** The user's level and the next step, from a row read with ladderSelect. */
export function ladderOf(u: LadderRow) {
  const contacts = { phoneConfirmed: !!u.phone && !!u.phoneVerifiedAt, emailConfirmed: !!u.email && !!u.emailVerifiedAt };
  const level = verificationLevel({
    ...contacts,
    identityVerifiedAt: u.identityVerifiedAt,
    hasVerifiedBankAccount: u.bankAccounts.length > 0,
  });
  return { level, contacts, next: nextStep(level, u.types as UserTypeName[], contacts) };
}

@Injectable()
export class VerificationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<VerificationLevel | undefined>(LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined || required <= LEVELS.UNCONFIRMED) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    if (!user) throw apiError(401, 'UNAUTHENTICATED', 'Please sign in.');

    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: ladderSelect });
    const { level, next } = ladderOf(row);
    if (level >= required) return true;
    throw apiError(403, 'VERIFICATION_REQUIRED', MESSAGES[required as 1 | 2 | 3], { requiredLevel: required, currentLevel: level, next });
  }
}

const MESSAGES: Record<1 | 2 | 3, string> = {
  1: 'Please confirm your phone number and email address first.',
  2: 'Please verify your identity first.',
  3: 'Please add a bank account in your own name first.',
};
