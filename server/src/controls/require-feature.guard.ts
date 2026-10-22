import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { apiError } from '../common/api-error.js';
import { ControlsService } from './controls.service.js';
import type { FeatureKey } from './feature-catalogue.js';
import { contextFromRequest } from './request-context.js';

const FEATURE_KEY = 'fhq:requiredFeatures';

/**
 * Marks a route as belonging to one or more features. If any is switched off for the caller,
 * the request is refused with a clear message instead of an error.
 *
 *   @RequireFeature('contact.chat')
 */
export const RequireFeature = (...keys: FeatureKey[]) => SetMetadata(FEATURE_KEY, keys);

@Injectable()
export class RequireFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly controls: ControlsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const keys = this.reflector.getAllAndOverride<FeatureKey[] | undefined>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!keys?.length) return true;

    const ctx = contextFromRequest(context.switchToHttp().getRequest<Request>());
    for (const key of keys) {
      if (!(await this.controls.isEnabled(key, ctx))) {
        throw apiError(403, 'FEATURE_UNAVAILABLE', 'This feature is not available at the moment.', { feature: key });
      }
    }
    return true;
  }
}
