import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apiError } from '../common/api-error.js';
import { geographyPoint, type LatLng } from '../common/geo.js';
import { uuidv7 } from '../common/ids.js';
import type { Env } from '../config/env.js';
import { ControlsService } from '../controls/controls.service.js';
import type { RequestUser } from '../controls/request-context.js';
import { Prisma, type ScoutRewardLine } from '../generated/prisma/client.js';
import { ACTIVE_AUTHORITY } from '../listings/authorities.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { conflictsOf, hashInvitationCode, newInvitationCode, onFeeReceived, onFirstRental, type Conflict, type Party } from './rules.js';

const PAGE_SIZE = 20;
/** One scout may send this many reports in 24 hours. */
const MAX_REPORTS_PER_DAY = 20;

interface ReportRow {
  id: string;
  scoutId: string;
  description: string;
  landlordName: string | null;
  alreadyOnPlatform: boolean;
  createdAt: Date;
  lat: number;
  lng: number;
}

/**
 * Scouts and the referral record (decisions 70 to 72; ADR 0008). A scout reports a vacant property and invites its
 * landlord; the landlord registers and lists it himself. A scout never gains any right over a property. Rewards are
 * only recorded here, as waiting for a rental; paying them comes with the completed rental fee in Release 2.
 */
@Injectable()
export class ScoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // Becoming a scout ---------------------------------------------------------------------------------

  async optIn(user: RequestUser) {
    const profile = await this.prisma.scoutProfile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    return this.profileView(profile);
  }

  async profile(user: RequestUser) {
    const profile = await this.prisma.scoutProfile.findUnique({ where: { userId: user.id } });
    if (!profile) throw apiError(404, 'NOT_A_SCOUT', 'You have not joined as a scout yet.');
    return this.profileView(profile);
  }

  private profileView(p: { status: string; optedInAt: Date; suspendedReason: string | null }) {
    return { status: p.status, optedInAt: p.optedInAt, suspendedReason: p.status === 'SUSPENDED' ? p.suspendedReason : null };
  }

  /** The scout's profile, refusing those who have not joined or are suspended. */
  private async activeScout(user: RequestUser) {
    const profile = await this.prisma.scoutProfile.findUnique({ where: { userId: user.id } });
    if (!profile) throw apiError(403, 'NOT_A_SCOUT', 'Join as a scout first.');
    if (profile.status !== 'ACTIVE') throw apiError(403, 'SCOUT_SUSPENDED', 'Your scout account is suspended. Please contact support.');
    return profile;
  }

  // Reporting a vacant property ----------------------------------------------------------------------

  async report(user: RequestUser, dto: { location: LatLng; description: string; landlordName?: string }) {
    await this.activeScout(user);
    const today = await this.prisma.scoutReport.count({ where: { scoutId: user.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (today >= MAX_REPORTS_PER_DAY) throw apiError(429, 'TOO_MANY_REPORTS', 'You have reported many properties today. Please try again tomorrow.');
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { countryCode: true } });
    const settings = await this.controls.getCountrySettings(me.countryCode);
    // Already on the platform? The same location check as for duplicate buildings (decision 58).
    const [{ count }] = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT count(*) AS "count" FROM "Building" b
      WHERE ST_DWithin(b."location", ${geographyPoint(dto.location)}, ${settings.listings.duplicateRadiusMetres})`;
    const id = uuidv7();
    await this.prisma.$executeRaw`
      INSERT INTO "ScoutReport" ("id", "scoutId", "countryCode", "location", "description", "landlordName", "alreadyOnPlatform")
      VALUES (${id}::uuid, ${user.id}::uuid, ${me.countryCode}, ${geographyPoint(dto.location)}, ${dto.description.trim()}, ${dto.landlordName?.trim() || null}, ${count > 0n})`;
    await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'scout.reported', entityType: 'ScoutReport', entityId: id, metadata: { alreadyOnPlatform: count > 0n } } });
    return this.reportView((await this.reportRows(Prisma.sql`r."id" = ${id}::uuid`))[0]!);
  }

  async myReports(user: RequestUser, cursor?: string) {
    const rows = await this.reportRows(Prisma.sql`r."scoutId" = ${user.id}::uuid ${cursor ? Prisma.sql`AND r."id" < ${cursor}::uuid` : Prisma.empty}`, PAGE_SIZE + 1);
    const page = rows.slice(0, PAGE_SIZE);
    const items = [];
    for (const r of page) items.push(await this.reportView(r));
    return { items, nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1]!.id : null };
  }

  private reportRows(where: Prisma.Sql, limit = 1) {
    return this.prisma.$queryRaw<ReportRow[]>`
      SELECT r."id", r."scoutId", r."description", r."landlordName", r."alreadyOnPlatform", r."createdAt",
             ST_Y(r."location"::geometry) AS "lat", ST_X(r."location"::geometry) AS "lng"
      FROM "ScoutReport" r WHERE ${where} ORDER BY r."id" DESC LIMIT ${limit}`;
  }

  private async reportView(r: ReportRow) {
    const invitation = await this.prisma.scoutInvitation.findUnique({ where: { reportId: r.id }, select: { status: true, createdAt: true, acceptedAt: true, referral: { select: { id: true } } } });
    return {
      id: r.id,
      location: { lat: r.lat, lng: r.lng },
      description: r.description,
      landlordName: r.landlordName,
      alreadyOnPlatform: r.alreadyOnPlatform,
      createdAt: r.createdAt,
      /** Where the report stands, for "my referrals". */
      stage: r.alreadyOnPlatform ? 'ALREADY_ON_PLATFORM' : !invitation ? 'REPORTED' : invitation.referral ? 'PROPERTY_ADDED' : invitation.status === 'ACCEPTED' ? 'LANDLORD_JOINED' : 'INVITED',
    };
  }

  // Inviting the landlord ----------------------------------------------------------------------------

  /**
   * Makes the invitation for a report and gives its code and link. The code is shown only now; asking again while
   * the invitation is still unused replaces the code, so a lost one can be given afresh.
   */
  async invite(user: RequestUser, reportId: string) {
    await this.activeScout(user);
    const report = await this.prisma.scoutReport.findUnique({ where: { id: reportId }, select: { scoutId: true, alreadyOnPlatform: true, invitation: { select: { id: true, status: true } } } });
    if (!report) throw new NotFoundException('Report not found.');
    if (report.scoutId !== user.id) throw new ForbiddenException('This report is not yours.');
    if (report.alreadyOnPlatform) throw apiError(409, 'ALREADY_ON_PLATFORM', 'This property is already on FindHouseQuick, so no reward is possible for it.');
    if (report.invitation?.status === 'ACCEPTED') throw apiError(409, 'INVITATION_USED', 'The landlord has already joined with this invitation.');
    const code = newInvitationCode();
    const codeHash = hashInvitationCode(code);
    const invitation = await this.prisma.scoutInvitation.upsert({
      where: { reportId },
      create: { reportId, scoutId: user.id, codeHash },
      update: { codeHash },
    });
    const pretty = `${code.slice(0, 5)}-${code.slice(5)}`;
    return { id: invitation.id, code: pretty, link: `${this.config.get('PUBLIC_WEB_URL', { infer: true }).replace(/\/$/, '')}/invite/${code}`, status: invitation.status };
  }

  /** What the landlord sees before registering: who invited him. Nothing private, and nothing about the property. */
  async invitationInfo(code: string) {
    const invitation = await this.prisma.scoutInvitation.findUnique({ where: { codeHash: hashInvitationCode(code) }, select: { status: true, scoutId: true } });
    if (!invitation || invitation.status !== 'PENDING') throw apiError(404, 'INVALID_INVITATION', 'This invitation is not valid or has already been used.');
    const scout = await this.prisma.user.findUniqueOrThrow({ where: { id: invitation.scoutId }, select: { firstName: true } });
    return { valid: true, invitedBy: scout.firstName };
  }

  // The landlord's side ------------------------------------------------------------------------------

  /** The invitation the landlord registered with, while his property is not yet linked to it. */
  async myInvitation(user: RequestUser) {
    const invitation = await this.prisma.scoutInvitation.findUnique({ where: { acceptedById: user.id }, select: { id: true, reportId: true, scoutId: true, referral: { select: { buildingId: true } } } });
    if (!invitation) return { invitation: null };
    const scout = await this.prisma.user.findUniqueOrThrow({ where: { id: invitation.scoutId }, select: { firstName: true } });
    const [report] = await this.reportRows(Prisma.sql`r."id" = ${invitation.reportId}::uuid`);
    return {
      invitation: { invitedBy: scout.firstName, reportedPlace: report!.description, reportedLocation: { lat: report!.lat, lng: report!.lng }, linkedBuildingId: invitation.referral?.buildingId ?? null },
    };
  }

  /**
   * The invited landlord confirms that a building he added is the property the scout reported (ADR 0008, section 3).
   * It must be his own building, near the reported pin. Every unit of the building then carries one reward line.
   */
  async linkBuilding(user: RequestUser, buildingId: string) {
    const invitation = await this.prisma.scoutInvitation.findUnique({ where: { acceptedById: user.id }, include: { referral: true } });
    if (!invitation) throw apiError(404, 'NO_INVITATION', 'You did not join through a scout\'s invitation.');
    if (invitation.referral) throw apiError(409, 'ALREADY_LINKED', 'Your invitation is already linked to a property.');
    const building = await this.prisma.building.findUnique({ where: { id: buildingId }, select: { id: true, ownerId: true, countryCode: true } });
    if (!building) throw new NotFoundException('Building not found.');
    if (building.ownerId !== user.id) throw new ForbiddenException('Only the owner of the building can confirm this.');
    const settings = await this.controls.getCountrySettings(building.countryCode);
    const [{ near }] = await this.prisma.$queryRaw<[{ near: boolean }]>`
      SELECT ST_DWithin(b."location", r."location", ${settings.scouts.matchRadiusMetres}) AS "near"
      FROM "Building" b, "ScoutReport" r WHERE b."id" = ${buildingId}::uuid AND r."id" = ${invitation.reportId}::uuid`;
    if (!near) throw apiError(409, 'NOT_THE_REPORTED_PROPERTY', 'This building is not where the scout reported the property.');

    const conflicts = await this.conflicts(invitation.scoutId, buildingId);
    try {
      const referral = await this.prisma.$transaction(async (tx) => {
        const created = await tx.scoutReferral.create({ data: { scoutId: invitation.scoutId, invitationId: invitation.id, landlordId: user.id, buildingId } });
        const units = await tx.unit.findMany({ where: { buildingId }, select: { id: true } });
        for (const u of units) await this.addLine(tx, created.id, u.id, conflicts);
        if (conflicts.length) await this.openConflictTask(tx, created.id, building.countryCode, conflicts);
        await tx.auditLog.create({ data: { actorId: user.id, action: 'scout.referral_linked', entityType: 'ScoutReferral', entityId: created.id, metadata: { buildingId, conflicts } } });
        return created;
      });
      return { referralId: referral.id, buildingId };
    } catch (e) {
      // The building already belongs to another referral: the earliest valid invitation wins (ADR 0008, section 4).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw apiError(409, 'PROPERTY_ALREADY_REFERRED', 'This property is already linked to another invitation.');
      }
      throw e;
    }
  }

  /** Called when a unit is added to a building: a referred building gains one reward line for it. */
  async onUnitAdded(buildingId: string, unitId: string): Promise<void> {
    const referral = await this.prisma.scoutReferral.findUnique({ where: { buildingId } });
    if (!referral) return;
    const conflicts = await this.conflicts(referral.scoutId, buildingId);
    await this.prisma.$transaction(async (tx) => {
      await this.addLine(tx, referral.id, unitId, conflicts);
    });
  }

  private async addLine(tx: Prisma.TransactionClient, referralId: string, unitId: string, conflicts: Conflict[]): Promise<void> {
    await tx.scoutRewardLine.upsert({
      where: { unitId },
      create: conflicts.length
        ? { referralId, unitId, status: 'VOID', voidReason: 'CONFLICT_OF_INTEREST', voidNote: conflicts.join(', ') }
        : { referralId, unitId },
      update: {},
    });
  }

  private async openConflictTask(tx: Prisma.TransactionClient, referralId: string, countryCode: string, conflicts: Conflict[]): Promise<void> {
    const open = await tx.reviewTask.count({ where: { type: 'SCOUT_CONFLICT', entityId: referralId, status: { in: ['OPEN', 'ASSIGNED'] } } });
    if (!open) {
      await tx.reviewTask.create({ data: { type: 'SCOUT_CONFLICT', countryCode, entityType: 'ScoutReferral', entityId: referralId, notes: `Conflict of interest found: ${conflicts.join(', ')}. Confirm it, or put it right if the match is a mistake.` } });
    }
  }

  /**
   * The conflict of interest checks for a scout and a building (ADR 0008, section 6): against the landlord, the
   * agents with authority over it and, when given, the tenant of the first rental.
   */
  async conflicts(scoutId: string, buildingId: string, tenantId?: string): Promise<Conflict[]> {
    const building = await this.prisma.building.findUnique({ where: { id: buildingId }, select: { ownerId: true, createdById: true } });
    if (!building) return [];
    const agents = await this.prisma.propertyAuthority.findMany({ where: { buildingId, ...ACTIVE_AUTHORITY() }, select: { agentId: true } });
    const roles = new Map<string, Party['role']>();
    if (tenantId) roles.set(tenantId, 'TENANT');
    for (const a of agents) roles.set(a.agentId, 'AGENT');
    if (building.createdById) roles.set(building.createdById, building.createdById === building.ownerId ? 'LANDLORD' : 'AGENT');
    if (building.ownerId) roles.set(building.ownerId, 'LANDLORD');
    const users = await this.prisma.user.findMany({
      where: { id: { in: [scoutId, ...roles.keys()] } },
      select: { id: true, phone: true, email: true, devices: { select: { deviceId: true } } },
    });
    const party = (id: string) => {
      const u = users.find((x) => x.id === id)!;
      return { id, phone: u.phone, email: u.email, deviceIds: u.devices.map((d) => d.deviceId) };
    };
    return conflictsOf(party(scoutId), [...roles].map(([id, role]) => ({ ...party(id), role })));
  }

  // Rewards ------------------------------------------------------------------------------------------

  /**
   * Records the first rental of a unit (ADR 0008, section 5). Called by the rentals part when it exists (Release 2).
   * A rental through escrow voids that unit's reward; the conflict checks run again, now with the tenant.
   */
  async recordFirstRental(unitId: string, rental: { throughEscrow: boolean; tenantId: string; at?: Date }): Promise<ScoutRewardLine | null> {
    const line = await this.prisma.scoutRewardLine.findUnique({ where: { unitId }, include: { referral: true } });
    if (!line) return null;
    const change = onFirstRental(line, rental.throughEscrow, rental.at ?? new Date());
    if (!change) return line;
    const conflicts = change.status === 'VOID' ? [] : await this.conflicts(line.referral.scoutId, line.referral.buildingId, rental.tenantId);
    return this.prisma.$transaction(async (tx) => {
      if (conflicts.length) {
        const building = await tx.building.findUniqueOrThrow({ where: { id: line.referral.buildingId }, select: { countryCode: true } });
        await this.openConflictTask(tx, line.referralId, building.countryCode, conflicts);
        return tx.scoutRewardLine.update({ where: { id: line.id }, data: { status: 'VOID', voidReason: 'CONFLICT_OF_INTEREST', voidNote: conflicts.join(', '), rentedAt: change.rentedAt } });
      }
      return tx.scoutRewardLine.update({ where: { id: line.id }, data: change });
    });
  }

  /**
   * Records that Projectiles received its full completed rental fee for the first rental of a unit. The line becomes
   * eligible with the country's reward of that day saved on it; while the reward is not set, it keeps waiting.
   */
  async recordFeeReceived(unitId: string, at = new Date()): Promise<ScoutRewardLine | null> {
    const line = await this.prisma.scoutRewardLine.findUnique({ where: { unitId }, include: { referral: true } });
    if (!line) return null;
    const building = await this.prisma.building.findUniqueOrThrow({ where: { id: line.referral.buildingId }, select: { countryCode: true } });
    const country = await this.controls.findCountry(building.countryCode);
    const settings = await this.controls.getCountrySettings(building.countryCode);
    const change = onFeeReceived(line, settings.scouts.rewardMinor, at);
    if (!change || !country) return line;
    return this.prisma.scoutRewardLine.update({ where: { id: line.id }, data: { ...change, currency: country.currency } });
  }

  /** The scout's referrals and the state of each reward. The scout sees the area, never the address or the landlord's contact. */
  async myReferrals(user: RequestUser) {
    await this.profile(user);
    const referrals = await this.prisma.scoutReferral.findMany({ where: { scoutId: user.id }, orderBy: { id: 'desc' }, include: { lines: { orderBy: { createdAt: 'asc' } } } });
    const items = [];
    for (const r of referrals) items.push(await this.referralView(r, false));
    return { items };
  }

  private async referralView(r: Prisma.ScoutReferralGetPayload<{ include: { lines: true } }>, staff: boolean) {
    const building = await this.prisma.building.findUniqueOrThrow({ where: { id: r.buildingId }, select: { area: true, street: true, city: { select: { name: true } } } });
    const units = await this.prisma.unit.findMany({ where: { id: { in: r.lines.map((l) => l.unitId) } }, select: { id: true, label: true } });
    return {
      id: r.id,
      createdAt: r.createdAt,
      property: { area: building.area, city: building.city.name, ...(staff ? { street: building.street, buildingId: r.buildingId } : {}) },
      ...(staff ? { scoutId: r.scoutId, landlordId: r.landlordId } : {}),
      rewards: r.lines.map((l) => ({
        id: l.id,
        unitLabel: units.find((u) => u.id === l.unitId)?.label ?? '',
        status: l.status,
        voidReason: l.voidReason,
        ...(staff ? { voidNote: l.voidNote } : {}),
        amount: l.amountMinor !== null && l.currency ? { amountMinor: l.amountMinor.toString(), currency: l.currency } : null,
        rentedAt: l.rentedAt,
        eligibleAt: l.eligibleAt,
      })),
    };
  }

  // Staff --------------------------------------------------------------------------------------------

  async listReferrals(actor: RequestUser, q: { status?: string; cursor?: string }) {
    const countries = actor.staff!.countryScopes;
    const rows = await this.prisma.scoutReferral.findMany({
      where: {
        ...(q.cursor ? { id: { lt: q.cursor } } : {}),
        ...(q.status ? { lines: { some: { status: q.status as ScoutRewardLine['status'] } } } : {}),
      },
      orderBy: { id: 'desc' },
      take: PAGE_SIZE * 3,
      include: { lines: { orderBy: { createdAt: 'asc' } } },
    });
    // Staff see the referrals of the countries they work on.
    const buildings = await this.prisma.building.findMany({ where: { id: { in: rows.map((r) => r.buildingId) } }, select: { id: true, countryCode: true } });
    const allowed = rows.filter((r) => actor.staff!.roles.includes('SUPER_ADMIN') || countries.includes(buildings.find((b) => b.id === r.buildingId)?.countryCode ?? ''));
    const page = allowed.slice(0, PAGE_SIZE);
    const items = [];
    for (const r of page) items.push(await this.referralView(r, true));
    return { items, nextCursor: allowed.length > PAGE_SIZE ? page[page.length - 1]!.id : null };
  }

  /** Staff void the rewards of a referral that are still open, with a reason (for example after confirmed abuse). */
  async voidReferral(actor: RequestUser, referralId: string, reason: string) {
    const referral = await this.prisma.scoutReferral.findUnique({ where: { id: referralId } });
    if (!referral) throw new NotFoundException('Referral not found.');
    if (referral.scoutId === actor.id || referral.landlordId === actor.id) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
    await this.prisma.$transaction([
      this.prisma.scoutRewardLine.updateMany({
        where: { referralId, status: { in: ['WAITING_FOR_RENTAL', 'ELIGIBLE'] } },
        data: { status: 'VOID', voidReason: 'VOIDED_BY_STAFF', voidNote: reason },
      }),
      this.prisma.auditLog.create({ data: { actorId: actor.id, action: 'scout.referral_voided', entityType: 'ScoutReferral', entityId: referralId, metadata: { reason } } }),
    ]);
    const fresh = await this.prisma.scoutReferral.findUniqueOrThrow({ where: { id: referralId }, include: { lines: { orderBy: { createdAt: 'asc' } } } });
    return this.referralView(fresh, true);
  }

  /** Staff suspend a scout, or lift the suspension. A suspended scout cannot report or invite. */
  async setScoutStatus(actor: RequestUser, userId: string, status: 'ACTIVE' | 'SUSPENDED', reason: string) {
    if (userId === actor.id) throw apiError(403, 'OWN_CASE', 'You cannot decide your own case.');
    const profile = await this.prisma.scoutProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('This user is not a scout.');
    const [updated] = await this.prisma.$transaction([
      this.prisma.scoutProfile.update({
        where: { userId },
        data: status === 'SUSPENDED' ? { status, suspendedAt: new Date(), suspendedReason: reason, suspendedById: actor.id } : { status, suspendedAt: null, suspendedReason: null, suspendedById: null },
      }),
      this.prisma.auditLog.create({ data: { actorId: actor.id, action: status === 'SUSPENDED' ? 'scout.suspended' : 'scout.reinstated', entityType: 'User', entityId: userId, metadata: { reason } } }),
    ]);
    return { userId, status: updated.status, suspendedReason: updated.suspendedReason };
  }
}
