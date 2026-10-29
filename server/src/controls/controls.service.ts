import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { FeatureRule, FeatureScope, RuleStatus, StaffRole } from '../generated/prisma/client.js';
import { apiError } from '../common/api-error.js';
import { applyCountrySettingsChange, parseCountrySettings, type CountrySettings } from './country-settings.schema.js';
import {
  parsePlatformSettings,
  platformSettingsChangeSchema,
  type PlatformSettings,
} from './platform-settings.schema.js';
import { FEATURES, isFeatureKey, type FeatureKey } from './feature-catalogue.js';
import { evaluateFeature, type Decision, type EvaluationContext } from './feature-evaluator.js';

/** The staff member making a change. Comes from the authenticated session once accounts are built. */
export interface StaffActor {
  userId: string;
  roles: readonly StaffRole[];
  /** Country codes the staff member may act on; ['*'] means all. */
  countryScopes: readonly string[];
}

/** A change to a country: any of these may be sent. */
export interface CountryChange {
  enabled?: boolean;
  languages?: string[];
  /** Only the settings to change; groups are merged, lists and maps replaced. */
  settings?: unknown;
}

export interface CreateRuleInput {
  flagKey: string;
  scope: FeatureScope;
  scopeValue: string | null;
  enabled: boolean;
  rolloutPercent?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  emergency?: boolean;
  reason: string;
}

interface Snapshot {
  loadedAt: number;
  flags: Map<string, { key: string; defaultEnabled: boolean; critical: boolean }>;
  rules: Map<string, FeatureRule[]>;
}

const CACHE_TTL_MS = 30_000;

@Injectable()
export class ControlsService implements OnModuleInit {
  private readonly logger = new Logger(ControlsService.name);
  private snapshot: Snapshot | null = null;
  private loading: Promise<Snapshot> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.syncCatalogue();
  }

  /**
   * Makes the database list of features match the catalogue in code. Descriptions, areas, critical
   * flags and defaults come from code; rules set by staff are never touched.
   */
  async syncCatalogue(): Promise<void> {
    await this.prisma.$transaction(
      FEATURES.map((def) =>
        this.prisma.featureFlag.upsert({
          where: { key: def.key },
          create: { ...def },
          update: { area: def.area, description: def.description, critical: def.critical, defaultEnabled: def.defaultEnabled },
        }),
      ),
    );
    this.invalidate();
    this.logger.log(`Feature catalogue synced (${FEATURES.length} features)`);
  }

  invalidate(): void {
    this.snapshot = null;
    this.platform = null;
  }

  private platform: { loadedAt: number; value: PlatformSettings } | null = null;

  /**
   * Platform-wide settings (platform-settings.schema.ts). Cached for up to 30 seconds like the feature switches,
   * so a change reaches every server within half a minute (at once on the server where it was made).
   */
  async getPlatformSettings(): Promise<PlatformSettings> {
    if (this.platform && Date.now() - this.platform.loadedAt < CACHE_TTL_MS) return this.platform.value;
    const row = await this.prisma.platformSettings.findUnique({ where: { id: 1 } });
    const value = parsePlatformSettings(row?.settings);
    this.platform = { loadedAt: Date.now(), value };
    return value;
  }

  /** Changes platform-wide settings. Super admins only; every change is recorded with before and after values. */
  async updatePlatformSettings(change: unknown, reason: string, actor: StaffActor): Promise<PlatformSettings> {
    if (!isSuperAdmin(actor)) throw apiError(403, 'FORBIDDEN', 'Only super admins can change platform settings.');
    if (!reason?.trim()) throw apiError(400, 'REASON_REQUIRED', 'A reason is required for every change.');
    const parsed = platformSettingsChangeSchema.safeParse(change);
    if (!parsed.success) {
      const problems = parsed.error.issues.map((i) => `${i.path.join('.') || 'settings'}: ${i.message}`).join('; ');
      throw apiError(400, 'INVALID_SETTINGS', `These settings are not valid: ${problems}`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      // Lock the row so two changes at the same moment cannot overwrite each other.
      await tx.$executeRaw`INSERT INTO "PlatformSettings" ("id", "settings", "updatedAt") VALUES (1, '{}', now()) ON CONFLICT ("id") DO NOTHING`;
      const [row] = await tx.$queryRaw<{ settings: unknown }[]>`SELECT "settings" FROM "PlatformSettings" WHERE "id" = 1 FOR UPDATE`;
      const before = parsePlatformSettings(row.settings);
      const after = parsePlatformSettings({ ...before, ...parsed.data });
      await tx.platformSettings.update({ where: { id: 1 }, data: { settings: after } });
      await tx.controlChange.create({
        data: {
          entityType: 'PlatformSettings',
          entityId: '1',
          action: 'SETTINGS_CHANGED',
          before: toJson(before),
          after: toJson(after),
          reason: reason.trim(),
          actorId: actor.userId,
        },
      });
      return after;
    });
    this.invalidate();
    return updated;
  }

  private async load(): Promise<Snapshot> {
    if (this.snapshot && Date.now() - this.snapshot.loadedAt < CACHE_TTL_MS) return this.snapshot;
    this.loading ??= (async () => {
      try {
        const [flags, rules] = await Promise.all([
          this.prisma.featureFlag.findMany(),
          this.prisma.featureRule.findMany({ where: { status: 'ACTIVE' } }),
        ]);
        const byFlag = new Map<string, FeatureRule[]>();
        for (const r of rules) byFlag.set(r.flagKey, [...(byFlag.get(r.flagKey) ?? []), r]);
        this.snapshot = {
          loadedAt: Date.now(),
          flags: new Map(flags.map((f) => [f.key, f])),
          rules: byFlag,
        };
        return this.snapshot;
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  async decide(key: FeatureKey, ctx: EvaluationContext): Promise<Decision> {
    const snap = await this.load();
    const flag = snap.flags.get(key);
    if (!flag) return { enabled: false, ruleId: null, reason: 'default' };
    return evaluateFeature(flag, snap.rules.get(key) ?? [], ctx);
  }

  async isEnabled(key: FeatureKey, ctx: EvaluationContext): Promise<boolean> {
    return (await this.decide(key, ctx)).enabled;
  }

  /** Every feature's on/off state for one context, as sent to the apps. */
  async evaluateAll(ctx: EvaluationContext): Promise<Record<string, boolean>> {
    const snap = await this.load();
    const out: Record<string, boolean> = {};
    for (const flag of snap.flags.values()) {
      out[flag.key] = evaluateFeature(flag, snap.rules.get(flag.key) ?? [], ctx).enabled;
    }
    return out;
  }

  /** The country and its validated settings, or null if the country is not set up. */
  async findCountry(code: string) {
    const country = await this.prisma.country.findUnique({ where: { code: code.toUpperCase() } });
    return country ? { ...country, settings: parseCountrySettings(country.settings) } : null;
  }

  async getCountry(code: string) {
    const country = await this.prisma.country.findUnique({ where: { code: code.toUpperCase() } });
    if (!country) throw new NotFoundException(`Country ${code} is not set up`);
    return { ...country, settings: parseCountrySettings(country.settings) };
  }

  async getCountrySettings(code: string): Promise<CountrySettings> {
    return (await this.getCountry(code)).settings;
  }

  /**
   * Changes a country's settings, its languages, or switches it on or off. Super admins only; every change is
   * recorded with the values before and after. Country settings are read fresh on every request, so the
   * change applies at once on every server.
   */
  async updateCountry(code: string, change: CountryChange, reason: string, actor: StaffActor) {
    if (!isSuperAdmin(actor)) throw apiError(403, 'FORBIDDEN', 'Only super admins can change country settings.');
    if (!reason?.trim()) throw apiError(400, 'REASON_REQUIRED', 'A reason is required for every change.');
    if (change.enabled === undefined && change.languages === undefined && change.settings === undefined) {
      throw apiError(400, 'NOTHING_TO_CHANGE', 'Send at least one of enabled, languages or settings.');
    }
    const countryCode = code.toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      // Lock the row so two changes at the same moment cannot overwrite each other.
      const [row] = await tx.$queryRaw<{ code: string }[]>`SELECT "code" FROM "Country" WHERE "code" = ${countryCode} FOR UPDATE`;
      if (!row) throw new NotFoundException(`Country ${countryCode} is not set up`);
      const before = await tx.country.findUniqueOrThrow({ where: { code: countryCode } });

      const data: { enabled?: boolean; languages?: string[]; settings?: object } = {};
      if (change.enabled !== undefined) data.enabled = change.enabled;
      if (change.languages !== undefined) {
        const languages = [...new Set(change.languages.map((l) => l.trim().toLowerCase()))];
        const unknown = languages.filter((l) => !isFeatureKey(`language.${l}`));
        if (unknown.length) throw apiError(400, 'INVALID_SETTINGS', `These languages are not offered: ${unknown.join(', ')}`);
        if (!languages.includes(before.defaultLanguage)) {
          throw apiError(400, 'INVALID_SETTINGS', `The languages must include the country's default language (${before.defaultLanguage}).`);
        }
        data.languages = languages;
      }
      if (change.settings !== undefined) {
        const result = applyCountrySettingsChange(before.settings, change.settings);
        if (!result.ok) throw apiError(400, 'INVALID_SETTINGS', `These settings are not valid: ${result.problems.join('; ')}`);
        data.settings = toJson(result.settings);
      }

      const after = await tx.country.update({ where: { code: countryCode }, data });
      const snapshot = (c: typeof before) => ({ enabled: c.enabled, languages: c.languages, settings: parseCountrySettings(c.settings) });
      await tx.controlChange.create({
        data: {
          entityType: 'Country',
          entityId: countryCode,
          action: 'COUNTRY_CHANGED',
          before: toJson(snapshot(before)),
          after: toJson(snapshot(after)),
          reason: reason.trim(),
          actorId: actor.userId,
        },
      });
      return { ...after, settings: parseCountrySettings(after.settings) };
    });
  }

  // -------------------------------------------------------------------
  // Changing rules (used by the admin panel once staff accounts exist)
  // -------------------------------------------------------------------

  /**
   * Creates a feature rule (ADR 0002, as confirmed in Decisions Log decision 28).
   *
   * - **Switching off at once** (a plain OFF rule: no schedule, no end time, no percentage) applies
   *   immediately, for super admins and for country managers in their own countries, so an emergency pause
   *   is never delayed.
   * - **Country managers**: anything else (switching on, scheduling, gradual release) waits for a super admin.
   * - **Super admins**: applies at once, except switching a critical feature ON, which waits for a different
   *   staff member's approval.
   * - Every change is recorded in ControlChange.
   */
  async createRule(input: CreateRuleInput, actor: StaffActor): Promise<FeatureRule> {
    if (!isFeatureKey(input.flagKey)) throw apiError(400, 'UNKNOWN_FEATURE', `Unknown feature: ${input.flagKey}`);
    if (!input.reason?.trim()) throw apiError(400, 'REASON_REQUIRED', 'A reason is required for every change.');
    if ((input.scope === 'GLOBAL') !== (input.scopeValue === null)) {
      throw apiError(400, 'BAD_REQUEST', 'Whole-platform rules have no scope value; all other rules need one.');
    }
    if (input.rolloutPercent != null && (input.rolloutPercent < 0 || input.rolloutPercent > 100)) {
      throw apiError(400, 'BAD_REQUEST', 'Rollout percentage must be between 0 and 100.');
    }
    if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
      throw apiError(400, 'BAD_REQUEST', 'The end time must be after the start time.');
    }
    await this.assertMayChangeScope(actor, input.scope, input.scopeValue);

    const flag = await this.prisma.featureFlag.findUniqueOrThrow({ where: { key: input.flagKey } });
    const switchOffNow = !input.enabled && !input.startsAt && !input.endsAt && input.rolloutPercent == null;
    const needsApproval = isSuperAdmin(actor) ? flag.critical && input.enabled : !switchOffNow;

    const rule = await this.prisma.$transaction(async (tx) => {
      const created = await tx.featureRule.create({
        data: {
          flagKey: input.flagKey,
          scope: input.scope,
          scopeValue: input.scopeValue,
          enabled: input.enabled,
          rolloutPercent: input.rolloutPercent ?? null,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          emergency: input.emergency ?? false,
          status: needsApproval ? 'PENDING_APPROVAL' : 'ACTIVE',
          reason: input.reason.trim(),
          createdById: actor.userId,
        },
      });
      await tx.controlChange.create({
        data: {
          entityType: 'FeatureRule',
          entityId: created.id,
          action: needsApproval ? 'RULE_PROPOSED' : 'RULE_CREATED',
          after: toJson(created),
          reason: created.reason,
          actorId: actor.userId,
        },
      });
      return created;
    });
    this.invalidate();
    return rule;
  }

  /**
   * Approves a waiting change: either a new rule, or a country manager's request to withdraw a live rule.
   *
   * - The approver must be a different person from the one who asked.
   * - A country manager's change needs a super admin. A super admin's critical change needs any second
   *   authorised staff member (so one of the two is always a super admin).
   */
  async approveRule(ruleId: string, approver: StaffActor): Promise<FeatureRule> {
    const rule = await this.prisma.featureRule.findUnique({ where: { id: ruleId }, include: { flag: true } });
    if (!rule) throw apiError(404, 'RULE_NOT_FOUND', 'Rule not found.');

    if (rule.status === 'ACTIVE' && rule.archiveRequestedById) return this.approveWithdrawal(rule, approver);
    if (rule.status !== 'PENDING_APPROVAL') {
      throw apiError(400, 'NOT_WAITING', 'This rule is not waiting for approval.');
    }
    if (rule.createdById === approver.userId) {
      throw apiError(403, 'SAME_PERSON', 'A change must be approved by a different staff member.');
    }
    await this.assertMayChangeScope(approver, rule.scope, rule.scopeValue);

    const creator = await this.prisma.staffMember.findUnique({ where: { userId: rule.createdById } });
    if (!isSuperAdmin(approver) && !creator?.roles.includes('SUPER_ADMIN')) {
      throw apiError(
        403,
        'SUPER_ADMIN_APPROVAL_REQUIRED',
        'This change needs approval from the Managing Director or his appointee (a super admin).',
      );
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.featureRule.update({
        where: { id: ruleId },
        data: { status: 'ACTIVE', approvedById: approver.userId },
      });
      await tx.controlChange.create({
        data: {
          entityType: 'FeatureRule',
          entityId: ruleId,
          action: 'RULE_APPROVED',
          before: toJson(rule),
          after: toJson(updated),
          reason: rule.reason,
          actorId: rule.createdById,
          approvedById: approver.userId,
        },
      });
      return updated;
    });
    this.invalidate();
    return approved;
  }

  /**
   * Withdraws a rule.
   *
   * - Super admins withdraw at once.
   * - A country manager can withdraw their own proposal at once, since it changes nothing live. Any other
   *   withdrawal by a country manager is recorded as a request; the rule stays in force until a super admin
   *   approves it with approveRule.
   * - Withdrawing a live rule that switches a critical feature OFF would switch it back on, so it is not
   *   allowed for anyone: create an ON rule and have it approved instead.
   */
  async archiveRule(ruleId: string, actor: StaffActor, reason: string): Promise<FeatureRule> {
    if (!reason?.trim()) throw apiError(400, 'REASON_REQUIRED', 'A reason is required for every change.');
    const rule = await this.prisma.featureRule.findUnique({ where: { id: ruleId }, include: { flag: true } });
    if (!rule) throw apiError(404, 'RULE_NOT_FOUND', 'Rule not found.');
    if (rule.status === 'ARCHIVED') return stripFlag(rule);
    await this.assertMayChangeScope(actor, rule.scope, rule.scopeValue);
    if (rule.flag.critical && rule.status === 'ACTIVE' && !rule.enabled) {
      throw apiError(
        403,
        'CRITICAL_OFF_RULE',
        'Removing an OFF rule on a critical feature switches it back on. Create an ON rule and have it approved instead.',
      );
    }

    const ownProposal = rule.status === 'PENDING_APPROVAL' && rule.createdById === actor.userId;
    if (!isSuperAdmin(actor) && !ownProposal) return this.requestWithdrawal(rule, actor, reason.trim());

    const archived = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.featureRule.update({ where: { id: ruleId }, data: { status: 'ARCHIVED' } });
      await tx.controlChange.create({
        data: {
          entityType: 'FeatureRule',
          entityId: ruleId,
          action: 'RULE_ARCHIVED',
          before: toJson(stripFlag(rule)),
          after: toJson(updated),
          reason: reason.trim(),
          actorId: actor.userId,
        },
      });
      return updated;
    });
    this.invalidate();
    return archived;
  }

  /**
   * Rules for the admin panel, newest first. Super admins see every rule; country managers see the
   * whole-platform and user-type rules (which affect their countries) and the rules for their own countries.
   */
  async listRules(actor: StaffActor, filter: { status?: RuleStatus; flagKey?: string } = {}): Promise<FeatureRule[]> {
    const rules = await this.prisma.featureRule.findMany({
      where: { ...(filter.status && { status: filter.status }), ...(filter.flagKey && { flagKey: filter.flagKey }) },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    if (isSuperAdmin(actor) || actor.countryScopes.includes('*')) return rules;
    const visible: FeatureRule[] = [];
    for (const r of rules) {
      if (r.scope === 'GLOBAL' || r.scope === 'USER_TYPE') {
        visible.push(r);
        continue;
      }
      const country = await this.countryOfScope(r.scope, r.scopeValue!).catch(() => null);
      if (country && actor.countryScopes.includes(country)) visible.push(r);
    }
    return visible;
  }

  /** Records a country manager's request to withdraw a rule. The rule stays as it is until approved. */
  private async requestWithdrawal(rule: FeatureRule & { flag: unknown }, actor: StaffActor, reason: string): Promise<FeatureRule> {
    if (rule.archiveRequestedById) {
      throw apiError(409, 'ALREADY_REQUESTED', 'Withdrawal of this rule has already been requested.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.featureRule.update({
        where: { id: rule.id },
        data: { archiveRequestedById: actor.userId, archiveRequestedAt: new Date(), archiveReason: reason },
      });
      await tx.controlChange.create({
        data: {
          entityType: 'FeatureRule',
          entityId: rule.id,
          action: 'RULE_ARCHIVE_REQUESTED',
          before: toJson(stripFlag(rule)),
          after: toJson(u),
          reason,
          actorId: actor.userId,
        },
      });
      return u;
    });
    // Nothing live changed, so the cache stays as it is.
    return updated;
  }

  private async approveWithdrawal(rule: FeatureRule, approver: StaffActor): Promise<FeatureRule> {
    if (!isSuperAdmin(approver)) {
      throw apiError(
        403,
        'SUPER_ADMIN_APPROVAL_REQUIRED',
        'Withdrawing a rule needs approval from the Managing Director or his appointee (a super admin).',
      );
    }
    if (rule.archiveRequestedById === approver.userId) {
      throw apiError(403, 'SAME_PERSON', 'A change must be approved by a different staff member.');
    }
    const archived = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.featureRule.update({ where: { id: rule.id }, data: { status: 'ARCHIVED' } });
      await tx.controlChange.create({
        data: {
          entityType: 'FeatureRule',
          entityId: rule.id,
          action: 'RULE_ARCHIVED',
          before: toJson(stripFlag(rule)),
          after: toJson(updated),
          reason: rule.archiveReason ?? 'Withdrawal approved',
          actorId: rule.archiveRequestedById!,
          approvedById: approver.userId,
        },
      });
      return updated;
    });
    this.invalidate();
    return archived;
  }

  private async assertMayChangeScope(actor: StaffActor, scope: FeatureScope, scopeValue: string | null) {
    if (isSuperAdmin(actor)) return;
    if (!actor.roles.includes('COUNTRY_MANAGER')) {
      throw apiError(403, 'FORBIDDEN', 'Only super admins and country managers can change feature controls.');
    }
    if (scope === 'GLOBAL' || scope === 'USER_TYPE') {
      throw apiError(403, 'FORBIDDEN', 'Only super admins can change whole-platform or user-type rules.');
    }
    const country = await this.countryOfScope(scope, scopeValue!);
    if (!actor.countryScopes.includes('*') && !actor.countryScopes.includes(country)) {
      throw apiError(403, 'FORBIDDEN', `You are not assigned to country ${country}.`);
    }
  }

  private async countryOfScope(scope: FeatureScope, value: string): Promise<string> {
    switch (scope) {
      case 'COUNTRY':
        return value;
      case 'REGION': {
        const r = await this.prisma.region.findUnique({ where: { id: value } });
        if (!r) throw apiError(400, 'REGION_NOT_FOUND', 'Region not found.');
        return r.countryCode;
      }
      case 'CITY': {
        const c = await this.prisma.city.findUnique({ where: { id: value }, include: { region: true } });
        if (!c) throw apiError(400, 'CITY_NOT_FOUND', 'City not found.');
        return c.region.countryCode;
      }
      case 'USER': {
        const u = await this.prisma.user.findUnique({ where: { id: value } });
        if (!u) throw apiError(400, 'USER_NOT_FOUND', 'User not found.');
        return u.countryCode;
      }
      default:
        throw apiError(400, 'BAD_REQUEST', `Scope ${scope} has no country.`);
    }
  }
}

function isSuperAdmin(actor: StaffActor): boolean {
  return actor.roles.includes('SUPER_ADMIN');
}

/** The rule without its joined feature, for the change record. */
function stripFlag<T extends object>(rule: T): Omit<T, 'flag'> {
  const { flag: _flag, ...rest } = rule as T & { flag?: unknown };
  return rest;
}

function toJson(value: object): object {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
