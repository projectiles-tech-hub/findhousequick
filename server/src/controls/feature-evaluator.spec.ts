import { evaluateFeature, rolloutBucket, type RuleInput } from './feature-evaluator.js';

const flag = { key: 'listings.short_let', defaultEnabled: false };
let seq = 0;
const rule = (over: Partial<RuleInput>): RuleInput => ({
  id: `r${++seq}`,
  scope: 'GLOBAL',
  scopeValue: null,
  enabled: true,
  rolloutPercent: null,
  startsAt: null,
  endsAt: null,
  emergency: false,
  status: 'ACTIVE',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  ...over,
});
const lagos = { countryCode: 'NG', regionId: 'edo', cityId: 'benin', userTypes: ['TENANT'], userId: 'u1' };

describe('evaluateFeature', () => {
  it('uses the default when no rule matches', () => {
    expect(evaluateFeature(flag, [], lagos)).toEqual({ enabled: false, ruleId: null, reason: 'default' });
    expect(evaluateFeature({ ...flag, defaultEnabled: true }, [], lagos).enabled).toBe(true);
  });

  it('switches a feature off in one city only', () => {
    const rules = [rule({ enabled: true }), rule({ scope: 'CITY', scopeValue: 'benin', enabled: false })];
    expect(evaluateFeature(flag, rules, lagos).enabled).toBe(false);
    expect(evaluateFeature(flag, rules, { ...lagos, cityId: 'lagos-city' }).enabled).toBe(true);
  });

  it('prefers the more specific rule', () => {
    const rules = [
      rule({ scope: 'COUNTRY', scopeValue: 'NG', enabled: false }),
      rule({ scope: 'USER', scopeValue: 'u1', enabled: true }),
    ];
    expect(evaluateFeature(flag, rules, lagos).enabled).toBe(true);
    expect(evaluateFeature(flag, rules, { ...lagos, userId: 'u2' }).enabled).toBe(false);
  });

  it('lets the newest rule win between equally specific rules', () => {
    const rules = [
      rule({ scope: 'COUNTRY', scopeValue: 'NG', enabled: true, createdAt: new Date('2026-10-01') }),
      rule({ scope: 'COUNTRY', scopeValue: 'NG', enabled: false, createdAt: new Date('2026-10-05') }),
    ];
    expect(evaluateFeature(flag, rules, lagos).enabled).toBe(false);
  });

  it('lets an emergency rule beat even a user-level rule', () => {
    const rules = [
      rule({ scope: 'USER', scopeValue: 'u1', enabled: true }),
      rule({ scope: 'GLOBAL', enabled: false, emergency: true }),
    ];
    expect(evaluateFeature(flag, rules, lagos)).toMatchObject({ enabled: false, reason: 'emergency' });
  });

  it('ignores pending, archived and out-of-window rules', () => {
    const now = new Date('2026-10-22T12:00:00Z');
    const rules = [
      rule({ status: 'PENDING_APPROVAL' }),
      rule({ status: 'ARCHIVED' }),
      rule({ startsAt: new Date('2026-11-01T00:00:00Z') }),
      rule({ endsAt: new Date('2026-10-22T12:00:00Z') }),
    ];
    expect(evaluateFeature(flag, rules, { ...lagos, now }).reason).toBe('default');
  });

  it('honours scheduled start times', () => {
    const r = rule({ startsAt: new Date('2026-11-01T00:00:00Z') });
    expect(evaluateFeature(flag, [r], { ...lagos, now: new Date('2026-10-31T23:59:59Z') }).enabled).toBe(false);
    expect(evaluateFeature(flag, [r], { ...lagos, now: new Date('2026-11-01T00:00:00Z') }).enabled).toBe(true);
  });

  it('matches user types', () => {
    const rules = [rule({ scope: 'USER_TYPE', scopeValue: 'LANDLORD', enabled: true })];
    expect(evaluateFeature(flag, rules, lagos).enabled).toBe(false);
    expect(evaluateFeature(flag, rules, { ...lagos, userTypes: ['LANDLORD'] }).enabled).toBe(true);
  });

  describe('gradual release', () => {
    it('gives the feature to roughly the right share of users, consistently', () => {
      const rules = [rule({ rolloutPercent: 10 })];
      const users = Array.from({ length: 5000 }, (_, i) => `user-${i}`);
      const on = users.filter((u) => evaluateFeature(flag, rules, { userId: u }).enabled).length;
      expect(on / users.length).toBeGreaterThan(0.08);
      expect(on / users.length).toBeLessThan(0.12);
      // The same user always gets the same answer.
      expect(evaluateFeature(flag, rules, { userId: 'user-7' })).toEqual(
        evaluateFeature(flag, rules, { userId: 'user-7' }),
      );
    });

    it('excludes users who are not signed in', () => {
      expect(evaluateFeature(flag, [rule({ rolloutPercent: 50 })], {})).toMatchObject({
        enabled: false,
        reason: 'rollout_excluded',
      });
    });

    it('treats 100% as everyone, including signed-out users', () => {
      expect(evaluateFeature(flag, [rule({ rolloutPercent: 100 })], {}).enabled).toBe(true);
    });

    it('produces buckets in range', () => {
      for (let i = 0; i < 200; i++) {
        const b = rolloutBucket('k', `u${i}`);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(100);
      }
    });
  });
});
