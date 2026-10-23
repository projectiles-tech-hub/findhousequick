import type { Request } from 'express';
import type { EvaluationContext } from './feature-evaluator.js';

/** The signed-in user, attached to the request by the sign-in check (src/accounts/auth.ts). */
export interface RequestUser {
  id: string;
  types: string[];
  countryCode: string;
  /** The signed-in device; signing out ends it. */
  sessionId: string;
  /** How this device signed in (decision 34). */
  signInMethod: 'PASSWORD' | 'SMS_CODE' | 'EMAIL_CODE';
  /** Present when the user is an active staff member (ADR 0005). */
  staff?: RequestStaff;
}

export interface RequestStaff {
  roles: string[];
  /** Country codes the staff member may act on; ['*'] means all. */
  countryScopes: string[];
  /**
   * True when this signed-in device passed the second step of two-step login within the period in the platform
   * settings (staffTwoStepMinutes; 3 hours by decision 32).
   */
  twoStepVerified: boolean;
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
