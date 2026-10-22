import { applyDecorators, CanActivate, ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { apiError } from '../common/api-error.js';
import type { StaffRole } from '../generated/prisma/client.js';
import type { RequestUser } from '../controls/request-context.js';

const ROLES_KEY = 'fhq:staffRoles';
const SKIP_TWO_STEP_KEY = 'fhq:staffSkipTwoStep';

/**
 * Marks a route as staff only (ADR 0005). With roles given, the staff member needs at least one of them;
 * with none, any active staff member may use it. The signed-in device must have passed the second step,
 * unless `{ twoStep: false }` is given (only for the routes that perform the second step).
 *
 *   @StaffOnly('SUPER_ADMIN', 'COUNTRY_MANAGER')
 */
export function StaffOnly(...rolesOrOptions: (StaffRole | { twoStep: false })[]) {
  const roles = rolesOrOptions.filter((r): r is StaffRole => typeof r === 'string');
  const skipTwoStep = rolesOrOptions.some((r) => typeof r === 'object' && r.twoStep === false);
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    SetMetadata(SKIP_TWO_STEP_KEY, skipTwoStep),
    UseGuards(StaffGuard),
    ApiBearerAuth(),
  );
}

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES_KEY, targets) ?? [];
    const skipTwoStep = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_TWO_STEP_KEY, targets) ?? false;
    const staff = context.switchToHttp().getRequest<Request & { user?: RequestUser }>().user?.staff;

    if (!staff) throw apiError(403, 'FORBIDDEN', 'This is for FindHouseQuick staff only.');
    if (!skipTwoStep && !staff.twoStepVerified) {
      throw apiError(403, 'TWO_STEP_REQUIRED', 'Please complete two-step login on this device first.');
    }
    if (roles.length && !roles.some((r) => staff.roles.includes(r))) {
      throw apiError(403, 'FORBIDDEN', 'Your staff role does not allow this.');
    }
    return true;
  }
}
