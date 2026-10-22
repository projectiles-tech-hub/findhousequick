import type { Request } from 'express';
import type { EvaluationContext } from './feature-evaluator.js';

/** Fields the authentication layer will attach to the request once accounts are built. */
export interface RequestUser {
  id: string;
  types: string[];
  countryCode: string;
}

/**
 * Builds the feature-control context for a request.
 * Location comes from headers the apps send (X-Country, X-Region, X-City); the signed-in user,
 * when present, comes from the authentication layer.
 */
export function contextFromRequest(req: Request): EvaluationContext {
  const user = (req as Request & { user?: RequestUser }).user;
  const header = (name: string) => {
    const v = req.headers[name];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  return {
    countryCode: (header('x-country') ?? user?.countryCode ?? null)?.toUpperCase() ?? null,
    regionId: header('x-region'),
    cityId: header('x-city'),
    userTypes: user?.types ?? [],
    userId: user?.id ?? null,
  };
}
