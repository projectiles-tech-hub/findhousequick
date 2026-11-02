import { Injectable, NotFoundException } from '@nestjs/common';
import { partTemplateSchema } from '../listings/parts.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Document purposes the apps choose from; evidence and other documents are only used inside other flows. */
const LISTED_PURPOSES = ['IDENTITY', 'OWNERSHIP', 'AUTHORITY_LETTER'] as const;

@Injectable()
export class ReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  private async country(code: string): Promise<string> {
    const c = await this.prisma.country.findUnique({ where: { code: code.toUpperCase() }, select: { code: true, enabled: true } });
    if (!c || !c.enabled) throw new NotFoundException(`Country ${code.toUpperCase()} is not available`);
    return c.code;
  }

  async propertyTypes(code: string) {
    const countryCode = await this.country(code);
    const types = await this.prisma.propertyType.findMany({
      where: { countryCode, enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    return types.map((t) => ({ id: t.id, category: t.category, code: t.code, label: t.label, partTemplate: partTemplateSchema.parse(t.partTemplate) }));
  }

  async documentTypes(code: string) {
    const countryCode = await this.country(code);
    const types = await this.prisma.documentType.findMany({
      where: { countryCode, enabled: true, purpose: { in: [...LISTED_PURPOSES] } },
      orderBy: [{ purpose: 'asc' }, { label: 'asc' }],
    });
    return types.map((t) => ({ code: t.code, label: t.label, purpose: t.purpose }));
  }

  async regions(code: string) {
    const countryCode = await this.country(code);
    const regions = await this.prisma.region.findMany({ where: { countryCode }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, enabled: true } });
    // City centres are geography points, which Prisma cannot read directly.
    const cities = await this.prisma.$queryRaw<{ id: string; regionId: string; name: string; enabled: boolean; lat: number | null; lng: number | null }[]>`
      SELECT c."id", c."regionId", c."name", c."enabled",
             ST_Y(c."centre"::geometry) AS "lat", ST_X(c."centre"::geometry) AS "lng"
      FROM "City" c JOIN "Region" r ON r."id" = c."regionId"
      WHERE r."countryCode" = ${countryCode}
      ORDER BY c."name"`;
    return regions.map((r) => ({
      ...r,
      cities: cities
        .filter((c) => c.regionId === r.id)
        .map((c) => ({ id: c.id, name: c.name, enabled: c.enabled, centre: c.lat === null || c.lng === null ? null : { lat: c.lat, lng: c.lng } })),
    }));
  }
}
