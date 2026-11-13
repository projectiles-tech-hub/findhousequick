import { Inject, Injectable, Logger } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { ControlsService } from '../controls/controls.service.js';
import { PRIVATE_STORAGE, type PrivateStorage } from '../integrations/storage/private-storage.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** How long a download link given to the user works. */
const LINK_MINUTES = 15;

/** Never written into a copy: secrets, codes and encrypted values (ID and account numbers appear only masked). */
const SECRET_KEY = /hash|token|secret|cipher|encrypted|otp|code$|^codeHash$|password|iv$|authTag/i;

/** Copies values, leaving out secrets and turning large numbers into text so the file is plain JSON. */
function clean(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return undefined;
  if (Array.isArray(value)) return value.map(clean);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k) && !/^(countryCode|idType|partCode|postCode|code)$/.test(k)) continue;
      const c = clean(v);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return value;
}

/**
 * A copy of everything held about a user, made at their request (Specification 15.2: "users can see, correct,
 * download and delete their information"). The copy is made in the background, kept in private storage for the
 * country's dataExportLinkDays, then deleted.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger('DataExport');

  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    private readonly notifications: NotificationsService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  /** Asks for a copy. One at a time, and no more often than the country's dataExportEveryHours. */
  async request(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { countryCode: true } });
    const { retention } = await this.controls.getCountrySettings(user.countryCode);
    const last = await this.prisma.dataExport.findFirst({ where: { userId }, orderBy: { requestedAt: 'desc' } });
    if (last?.status === 'PREPARING') throw apiError(409, 'EXPORT_IN_PROGRESS', 'Your copy is already being prepared.');
    if (last && last.status !== 'FAILED' && Date.now() - last.requestedAt.getTime() < retention.dataExportEveryHours * 3600_000) {
      const next = new Date(last.requestedAt.getTime() + retention.dataExportEveryHours * 3600_000);
      throw apiError(429, 'EXPORT_TOO_SOON', 'You asked for a copy recently. You can ask again later.', { nextAllowedAt: next.toISOString() });
    }
    const row = await this.prisma.dataExport.create({ data: { userId } });
    return this.view(row);
  }

  /** The user's copies, newest first, with a short-lived download link for one that is ready. */
  async list(userId: string) {
    const rows = await this.prisma.dataExport.findMany({ where: { userId }, orderBy: { requestedAt: 'desc' }, take: 5 });
    return { items: await Promise.all(rows.map((r) => this.view(r, true))) };
  }

  private async view(r: { id: string; status: string; requestedAt: Date; readyAt: Date | null; expiresAt: Date | null; sizeBytes: number | null; storageKey: string | null }, link = false) {
    const downloadUrl =
      link && r.status === 'READY' && r.storageKey ? await this.storage.createViewLink(r.storageKey, new Date(Date.now() + LINK_MINUTES * 60_000)) : null;
    return { id: r.id, status: r.status, requestedAt: r.requestedAt, readyAt: r.readyAt, expiresAt: r.expiresAt, sizeBytes: r.sizeBytes, downloadUrl };
  }

  /** Background job: makes the copies asked for, and deletes the ones whose time is up. */
  async run(): Promise<{ prepared: number; expired: number }> {
    let prepared = 0;
    const pending = await this.prisma.dataExport.findMany({ where: { status: 'PREPARING' }, orderBy: { requestedAt: 'asc' }, take: 10 });
    for (const row of pending) {
      // Claim the row first, so two servers never make the same copy.
      const claimed = await this.prisma.dataExport.updateMany({ where: { id: row.id, status: 'PREPARING', storageKey: null }, data: { storageKey: `exports/${row.userId}/${row.id}.json` } });
      if (!claimed.count) continue;
      try {
        await this.prepare(row.id, row.userId);
        prepared++;
      } catch (err) {
        this.logger.error(`Copy ${row.id} failed: ${(err as Error).message}`);
        await this.prisma.dataExport.update({ where: { id: row.id }, data: { status: 'FAILED', storageKey: null } });
      }
    }
    let expired = 0;
    const old = await this.prisma.dataExport.findMany({ where: { status: 'READY', expiresAt: { lt: new Date() } } });
    for (const row of old) {
      if (row.storageKey) await this.storage.delete(row.storageKey);
      await this.prisma.dataExport.update({ where: { id: row.id }, data: { status: 'EXPIRED', storageKey: null } });
      expired++;
    }
    return { prepared, expired };
  }

  private async prepare(exportId: string, userId: string): Promise<void> {
    const data = await this.collect(userId);
    const body = Buffer.from(JSON.stringify(data, null, 2));
    const key = `exports/${userId}/${exportId}.json`;
    await this.storage.write(key, body, 'application/json');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { countryCode: true } });
    const { retention } = await this.controls.getCountrySettings(user.countryCode);
    const expiresAt = new Date(Date.now() + retention.dataExportLinkDays * 86_400_000);
    await this.prisma.dataExport.update({ where: { id: exportId }, data: { status: 'READY', readyAt: new Date(), expiresAt, sizeBytes: body.length } });
    await this.notifications.notifyAccount(userId, {
      title: 'Your copy of your data is ready',
      body: `Download it from Me, then Privacy, in the app before ${expiresAt.toDateString()}. After that it is deleted.`,
      data: { exportId },
    });
  }

  /** Everything held about the user, in the user's own words where they wrote it. */
  async collect(userId: string): Promise<Record<string, unknown>> {
    const p = this.prisma;
    const user = await p.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        agentProfile: true,
        staff: true,
        identityChecks: { select: { id: true, idType: true, idNumberLast4: true, status: true, createdAt: true, completedAt: true } },
        bankAccounts: { select: { id: true, bankName: true, accountName: true, accountNumberLast4: true, createdAt: true } },
        documents: { select: { id: true, documentTypeId: true, purpose: true, status: true, createdAt: true } },
        savedSearches: true,
        savedPlaces: true,
        savedListings: true,
        confirmedContacts: true,
        devices: true,
        scoutProfile: true,
      },
    });
    const [buildings, listings, conversations, inspections, reports, enforcement, media, scoutReports, scoutInvitations, activity] = await Promise.all([
      p.building.findMany({ where: { OR: [{ ownerId: userId }, { createdById: userId }] }, include: { units: true } }),
      p.listing.findMany({ where: { createdById: userId } }),
      p.conversation.findMany({ where: { OR: [{ tenantId: userId }, { listerId: userId }] }, include: { messages: { orderBy: { createdAt: 'asc' } }, calls: true } }),
      p.inspection.findMany({ where: { OR: [{ tenantId: userId }, { hostId: userId }] } }),
      p.listingReport.findMany({ where: { reporterId: userId } }),
      p.enforcementAction.findMany({ where: { userId } }),
      p.mediaAsset.findMany({ where: { uploadedById: userId }, select: { id: true, buildingId: true, unitId: true, unitPartId: true, kind: true, status: true, capturedAt: true, createdAt: true } }),
      p.scoutReport.findMany({ where: { scoutId: userId } }),
      p.scoutInvitation.findMany({ where: { scoutId: userId } }),
      p.auditLog.findMany({ where: { actorId: userId }, orderBy: { createdAt: 'desc' }, take: 1000, select: { action: true, entityType: true, entityId: true, createdAt: true, ipAddress: true } }),
    ]);
    return clean({
      madeAt: new Date(),
      about: 'Everything FindHouseQuick holds about you. ID and bank account numbers are shown only by their last four digits.',
      account: user,
      buildings,
      listings,
      conversations: conversations.map((c) => ({
        ...c,
        // The conversation as the user saw it: both sides' messages, marked by who sent them.
        messages: c.messages.map((m) => ({ ...m, fromYou: m.senderId === userId })),
      })),
      inspections,
      reportsYouMade: reports,
      actionsOnYourAccount: enforcement,
      photosAndVideosYouUploaded: media,
      scoutReports,
      scoutInvitations,
      activity,
    }) as Record<string, unknown>;
  }
}
