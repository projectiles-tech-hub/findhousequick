import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { FeatureRule, FeatureScope, StaffRole } from '../generated/prisma/client.js';
import { parseCountrySettings, type CountrySettings } from './country-settings.schema.js';
import { FEATURES, isFeatureKey, type FeatureKey } from './feature-catalogue.js';
import { evaluateFeature, type Decision, type EvaluationContext } from './feature-evaluator.js';

/** The staff member making a change. Comes from the authenticated session once accounts are built. */
export interface StaffActor {
  userId: string;
  roles: readonly StaffRole[];
  /** Country codes the staff member may act on; ['*'] means all. */
  countryScopes: readonly string[];
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

  // -------------------------------------------------------------------
  // Changing rules (used by the admin panel once staff accounts exist)
  // -------------------------------------------------------------------

  /**
   * Creates a feature rule.
   * - Critical features: switching ON needs a second staff member's approval, so the rule starts as
   *   PENDING_APPROVAL. Switching OFF takes effect immediately, so emergency pauses are never delayed.
   * - Every change is recorded in ControlChange.
   */
  async createRule(input: CreateRuleInput, actor: StaffActor): Promise<FeatureRule> {
    if (!isFeatureKey(input.flagKey)) throw new BadRequestException(`Unknown feature: ${input.flagKey}`);
    if (!input.reason?.trim()) throw new BadRequestException('A reason is required for every change');
    if ((input.scope === 'GLOBAL') !== (input.scopeValue === null)) {
      throw new BadRequestException('Whole-platform rules have no scope value; all other rules need one');
    }
    if (input.rolloutPercent != null && (input.rolloutPercent < 0 || input.rolloutPercent > 100)) {
      throw new BadRequestException('Rollout percentage must be between 0 and 100');
    }
    if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
      throw new BadRequestException('The end time must be after the start time');
    }
    await this.assertMayChangeScope(actor, input.scope, input.scopeValue);

    const flag = await this.prisma.featureFlag.findUniqueOrThrow({ where: { key: input.flagKey } });
    const needsApproval = flag.critical && input.enabled;

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
   * Approves a pending rule. The approver must be a different person from the creator, and at least
   * one of the two must be a super admin (the Managing Director or a person he appoints).
   */
  async approveRule(ruleId: string, approver: StaffActor): Promise<FeatureRule> {
    const rule = await this.prisma.featureRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException('Rule not found');
    if (rule.status !== 'PENDING_APPROVAL') throw new BadRequestException('This rule is not waiting for approval');
    if (rule.createdById === approver.userId) {
      throw new ForbiddenException('A change must be approved by a different staff member');
    }
    await this.assertMayChangeScope(approver, rule.scope, rule.scopeValue);

    const creator = await this.prisma.staffMember.findUnique({ where: { userId: rule.createdById } });
    const superAdminInvolved = approver.roles.includes('SUPER_ADMIN') || !!creator?.roles.includes('SUPER_ADMIN');
    if (!superAdminInvolved) {
      throw new ForbiddenException('Critical changes need approval from the Managing Director or his appointee');
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
   * Withdraws a rule. Withdrawing a rule that currently switches a critical feature OFF would switch
   * it back on, so that also needs approval: it is done by creating an approved ON rule instead.
   */
  async archiveRule(ruleId: string, actor: StaffActor, reason: string): Promise<FeatureRule> {
    if (!reason?.trim()) throw new BadRequestException('A reason is required for every change');
    const rule = await this.prisma.featureRule.findUnique({ where: { id: ruleId }, include: { flag: true } });
    if (!rule) throw new NotFoundException('Rule not found');
    if (rule.status === 'ARCHIVED') return rule;
    await this.assertMayChangeScope(actor, rule.scope, rule.scopeValue);
    if (rule.flag.critical && rule.status === 'ACTIVE' && !rule.enabled) {
      throw new ForbiddenException(
        'Removing an OFF rule on a critical feature switches it back on. Create an ON rule and have it approved instead.',
      );
    }

    const archived = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.featureRule.update({ where: { id: ruleId }, data: { status: 'ARCHIVED' } });
      await tx.controlChange.create({
        data: {
          entityType: 'FeatureRule',
          entityId: ruleId,
          action: 'RULE_ARCHIVED',
          before: toJson(rule),
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

  private async assertMayChangeScope(actor: StaffActor, scope: FeatureScope, scopeValue: string | null) {
    if (actor.roles.includes('SUPER_ADMIN')) return;
    if (!actor.roles.includes('COUNTRY_MANAGER')) {
      throw new ForbiddenException('Only super admins and country managers can change feature controls');
    }
    if (scope === 'GLOBAL' || scope === 'USER_TYPE') {
      throw new ForbiddenException('Only super admins can change whole-platform or user-type rules');
    }
    const country = await this.countryOfScope(scope, scopeValue!);
    if (!actor.countryScopes.includes('*') && !actor.countryScopes.includes(country)) {
      throw new ForbiddenException(`You are not assigned to country ${country}`);
    }
  }

  private async countryOfScope(scope: FeatureScope, value: string): Promise<string> {
    switch (scope) {
      case 'COUNTRY':
        return value;
      case 'REGION': {
        const r = await this.prisma.region.findUnique({ where: { id: value } });
        if (!r) throw new BadRequestException('Region not found');
        return r.countryCode;
      }
      case 'CITY': {
        const c = await this.prisma.city.findUnique({ where: { id: value }, include: { region: true } });
        if (!c) throw new BadRequestException('City not found');
        return c.region.countryCode;
      }
      case 'USER': {
        const u = await this.prisma.user.findUnique({ where: { id: value } });
        if (!u) throw new BadRequestException('User not found');
        return u.countryCode;
      }
      default:
        throw new BadRequestException(`Scope ${scope} has no country`);
    }
  }
}

function toJson(value: object): object {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
