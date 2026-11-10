import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

interface SavedFilters {
  kind?: string;
  category?: string;
  propertyType?: string;
  minRent?: string;
  maxRent?: string;
  minBedrooms?: number;
  furnished?: string;
}

/**
 * Saved-area alerts (Specification 4.2): when a listing goes live, everyone whose saved area covers it, and whose
 * filters it matches, is told. Each user is told once, however many of their saved areas match.
 */
@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listingWentLive(listingId: string): Promise<number> {
    const [l] = await this.prisma.$queryRaw<
      { id: string; title: string; area: string; createdById: string; kind: string; category: string; code: string; rentMinor: bigint; bedrooms: number; furnishing: string | null }[]
    >`
      SELECT l."id", l."title", b."area", l."createdById", l."kind"::text AS "kind", pt."category"::text AS "category", pt."code",
             l."rentMinor", u."bedrooms", u."details"->>'furnishing' AS "furnishing"
      FROM "Listing" l JOIN "Unit" u ON u."id" = l."unitId" JOIN "Building" b ON b."id" = u."buildingId" JOIN "PropertyType" pt ON pt."id" = u."propertyTypeId"
      WHERE l."id" = ${listingId}::uuid AND l."status" = 'LIVE'`;
    if (!l) return 0;
    const searches = await this.prisma.$queryRaw<{ id: string; userId: string; name: string; filters: SavedFilters }[]>`
      SELECT s."id", s."userId", s."name", s."filters"
      FROM "SavedSearch" s
      WHERE s."alertsEnabled" AND s."userId" <> ${l.createdById}::uuid
        AND ST_Covers(s."area", (SELECT b."location" FROM "Building" b JOIN "Unit" u ON u."buildingId" = b."id" JOIN "Listing" x ON x."unitId" = u."id" WHERE x."id" = ${listingId}::uuid))`;
    const told = new Set<string>();
    for (const s of searches) {
      if (told.has(s.userId) || !matches(s.filters ?? {}, l)) continue;
      told.add(s.userId);
      await this.notifications.notify(s.userId, 'SAVED_SEARCH_ALERT', {
        title: `New home in ${s.name}`,
        body: `${l.title}, in ${l.area}, has just been listed.`,
        data: { listingId: l.id, savedSearchId: s.id },
      });
    }
    return told.size;
  }
}

function matches(f: SavedFilters, l: { kind: string; category: string; code: string; rentMinor: bigint; bedrooms: number; furnishing: string | null }): boolean {
  if (f.kind && f.kind !== l.kind) return false;
  if (f.category && f.category !== l.category) return false;
  if (f.propertyType && f.propertyType !== l.code) return false;
  if (f.minRent && l.rentMinor < BigInt(f.minRent)) return false;
  if (f.maxRent && l.rentMinor > BigInt(f.maxRent)) return false;
  if (f.minBedrooms !== undefined && l.bedrooms < f.minBedrooms) return false;
  if (f.furnished && f.furnished !== l.furnishing) return false;
  return true;
}
