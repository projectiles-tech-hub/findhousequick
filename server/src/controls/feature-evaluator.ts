import { createHash } from 'node:crypto';

/**
 * Decides whether a feature is on for a given request. Pure logic, no database access, so it is
 * easy to test and fast to run on every request.
 *
 * How a decision is made:
 * 1. Only active rules inside their scheduled time window count.
 * 2. Only rules that match the request count (its country, region, city, user type or user).
 * 3. Emergency rules beat all other rules.
 * 4. Otherwise the most specific matching rule wins:
 *    user > city > region > country > user type > whole platform.
 *    If two equally specific rules match, the newest wins.
 * 5. If a winning rule switches the feature on for a percentage of users, each user is placed in
 *    a stable bucket from 0 to 99; only users below the percentage get the feature.
 * 6. If no rule matches, the feature's default applies.
 */

export type Scope = 'GLOBAL' | 'COUNTRY' | 'REGION' | 'CITY' | 'USER_TYPE' | 'USER';

export interface RuleInput {
  id: string;
  scope: Scope;
  scopeValue: string | null;
  enabled: boolean;
  rolloutPercent: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  emergency: boolean;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
}

export interface EvaluationContext {
  countryCode?: string | null;
  regionId?: string | null;
  cityId?: string | null;
  userTypes?: readonly string[];
  userId?: string | null;
  now?: Date;
}

export interface Decision {
  enabled: boolean;
  /** Id of the rule that decided, or null when the default applied. */
  ruleId: string | null;
  reason: 'default' | 'rule' | 'emergency' | 'rollout_excluded';
}

const SPECIFICITY: Record<Scope, number> = {
  USER: 5,
  CITY: 4,
  REGION: 3,
  COUNTRY: 2,
  USER_TYPE: 1,
  GLOBAL: 0,
};

function matches(rule: RuleInput, ctx: EvaluationContext): boolean {
  switch (rule.scope) {
    case 'GLOBAL':
      return true;
    case 'COUNTRY':
      return !!ctx.countryCode && rule.scopeValue === ctx.countryCode;
    case 'REGION':
      return !!ctx.regionId && rule.scopeValue === ctx.regionId;
    case 'CITY':
      return !!ctx.cityId && rule.scopeValue === ctx.cityId;
    case 'USER_TYPE':
      return !!rule.scopeValue && (ctx.userTypes ?? []).includes(rule.scopeValue);
    case 'USER':
      return !!ctx.userId && rule.scopeValue === ctx.userId;
  }
}

function inWindow(rule: RuleInput, now: Date): boolean {
  if (rule.startsAt && now < rule.startsAt) return false;
  if (rule.endsAt && now >= rule.endsAt) return false;
  return true;
}

/** Stable bucket 0 to 99 for a user and feature, so a user's result does not flip between requests. */
export function rolloutBucket(flagKey: string, userId: string): number {
  const digest = createHash('sha256').update(`${flagKey}:${userId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

function pickWinner(rules: RuleInput[]): RuleInput | undefined {
  return [...rules].sort(
    (a, b) => SPECIFICITY[b.scope] - SPECIFICITY[a.scope] || b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];
}

export function evaluateFeature(
  flag: { key: string; defaultEnabled: boolean },
  rules: readonly RuleInput[],
  ctx: EvaluationContext,
): Decision {
  const now = ctx.now ?? new Date();
  const applicable = rules.filter((r) => r.status === 'ACTIVE' && inWindow(r, now) && matches(r, ctx));

  const emergency = pickWinner(applicable.filter((r) => r.emergency));
  if (emergency) return { enabled: emergency.enabled, ruleId: emergency.id, reason: 'emergency' };

  const winner = pickWinner(applicable);
  if (!winner) return { enabled: flag.defaultEnabled, ruleId: null, reason: 'default' };

  if (winner.enabled && winner.rolloutPercent !== null && winner.rolloutPercent < 100) {
    const included = !!ctx.userId && rolloutBucket(flag.key, ctx.userId) < winner.rolloutPercent;
    return included
      ? { enabled: true, ruleId: winner.id, reason: 'rule' }
      : { enabled: false, ruleId: winner.id, reason: 'rollout_excluded' };
  }

  return { enabled: winner.enabled, ruleId: winner.id, reason: 'rule' };
}
