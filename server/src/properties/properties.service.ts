import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { geographyPoint } from '../common/geo.js';
import { uuidv7 } from '../common/ids.js';
import { ControlsService } from '../controls/controls.service.js';
import type { CountrySettings } from '../controls/country-settings.schema.js';
import type { RequestUser } from '../controls/request-context.js';
import { Prisma, type Unit, type UnitPart } from '../generated/prisma/client.js';
import { generateParts } from '../listings/parts.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { addressKey } from './address.js';
import type { CreateBuildingDto, CreateUnitDto, UpdateUnitDto } from './dto.js';
import { checkUnitDetails } from './unit-details.js';

const SQFT_IN_SQM = 0.09290304;

type PartWithCount = UnitPart & { captured: number };

/**
 * Buildings, units and the parts checklist (Release 1 step 4; Product Specification, Sections 5.1 to 5.3).
 *
 * A building is registered while standing at it, with the phone's live location. Each unit gets a checklist of the
 * parts to photograph, made from its property type and room counts; toilets are counted and photographed separately
 * from bathrooms, the distance to the main road is recorded, and each part can carry a note (decision 56).
 *
 * Who may see and change a building: its landlord (owner), the person who registered it, and agents with approved,
 * unexpired authority for it.
 */
@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
  ) {}

  // -------------------------------------------------------------------
  // Buildings
  // -------------------------------------------------------------------

  async createBuilding(user: RequestUser, dto: CreateBuildingDto) {
    const isLandlord = user.types.includes('LANDLORD');
    const isAgent = user.types.includes('AGENT');
    if (!isLandlord && !isAgent) throw apiError(403, 'NOT_A_LISTER', 'Only landlords and agents can add buildings.');
    if (dto.offPlatformOwner && !isAgent) {
      throw apiError(400, 'BAD_REQUEST', "Only agents can add a landlord's details; a landlord adds his own buildings.");
    }

    const city = await this.prisma.city.findUnique({ where: { id: dto.cityId }, include: { region: { include: { country: true } } } });
    if (!city || !city.enabled || !city.region.enabled || !city.region.country.enabled) {
      throw apiError(400, 'CITY_NOT_AVAILABLE', 'FindHouseQuick is not open in this city yet.');
    }
    const countryCode = city.region.countryCode;
    const settings = await this.controls.getCountrySettings(countryCode);

    // A landlord adding his own building owns it. An agent's building has no owner on the platform until the
    // landlord approves the agent's authority, or it records the landlord's details when he is not on the app.
    const actingAsAgent = isAgent && (!!dto.offPlatformOwner || !isLandlord);
    const ownerId = actingAsAgent ? null : user.id;
    const key = addressKey({ cityId: city.id, area: dto.area, street: dto.street, houseNumber: dto.houseNumber });

    const id = uuidv7();
    await this.prisma.$executeRaw`
        INSERT INTO "Building" ("id", "countryCode", "cityId", "area", "street", "houseNumber", "landmark", "distanceToMainRoadM",
          "addressKey", "location", "locationAccuracyM", "ownerId", "offPlatformOwnerName", "offPlatformOwnerPhone", "createdById", "updatedAt")
        VALUES (${id}::uuid, ${countryCode}, ${city.id}::uuid, ${dto.area}, ${dto.street}, ${dto.houseNumber ?? null}, ${dto.landmark ?? null},
          ${dto.distanceToMainRoadM ?? null}, ${key}, ${geographyPoint(dto.location)}, ${dto.locationAccuracyM}, ${ownerId}::uuid,
          ${dto.offPlatformOwner?.name ?? null}, ${dto.offPlatformOwner?.phone ?? null}, ${user.id}::uuid, now())`;

    // The same building listed twice: another building within the country's duplicate radius, or at the same address.
    const near = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT b."id" FROM "Building" b
      WHERE b."id" <> ${id}::uuid AND b."countryCode" = ${countryCode}
        AND (b."addressKey" = ${key}
             OR ST_DWithin(b."location", (SELECT "location" FROM "Building" WHERE "id" = ${id}::uuid), ${settings.listings.duplicateRadiusMetres}))
      ORDER BY b."createdAt"`;
    const possibleDuplicates = near.map((r) => r.id);
    if (possibleDuplicates.length) {
      await this.prisma.reviewTask.create({
        data: {
          type: 'DUPLICATE_RESOLUTION',
          countryCode,
          entityType: 'Building',
          entityId: id,
          notes: `Possible duplicate of ${possibleDuplicates.join(', ')}`,
        },
      });
    }

    const view = await this.buildingView(id, settings);
    return { ...view, possibleDuplicates };
  }

  async getBuilding(user: RequestUser, buildingId: string) {
    const building = await this.assertMayManage(user, buildingId);
    return this.buildingView(building.id, await this.controls.getCountrySettings(building.countryCode));
  }

  // -------------------------------------------------------------------
  // Units and the parts checklist
  // -------------------------------------------------------------------

  async addUnit(user: RequestUser, buildingId: string, dto: CreateUnitDto) {
    const building = await this.assertMayManage(user, buildingId);
    const settings = await this.controls.getCountrySettings(building.countryCode);
    const type = await this.prisma.propertyType.findUnique({ where: { id: dto.propertyTypeId } });
    if (!type || !type.enabled || type.countryCode !== building.countryCode) {
      throw apiError(400, 'PROPERTY_TYPE_NOT_AVAILABLE', 'This property type is not offered in this country.');
    }
    if (type.category === 'SHORT_LET' && !settings.shortLet.allowed) {
      throw apiError(400, 'PROPERTY_TYPE_NOT_AVAILABLE', 'Short lets are not offered in this country.');
    }
    const details = this.details(dto.details ?? {}, settings);
    const counts = { bedrooms: dto.bedrooms, bathrooms: dto.bathrooms, toilets: dto.toilets };
    const parts = generateParts(type.partTemplate, counts, settings.listings.defaultMinPhotosPerPart);

    try {
      const unit = await this.prisma.unit.create({
        data: {
          buildingId: building.id,
          label: dto.label,
          propertyTypeId: type.id,
          ...counts,
          floorLevel: dto.floorLevel ?? null,
          floorAreaSqm: dto.floorArea === undefined ? null : toSqm(dto.floorArea, settings),
          details,
          parts: { create: parts },
        },
      });
      return this.unitView(unit.id, settings);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw apiError(409, 'UNIT_LABEL_TAKEN', `This building already has a unit called "${dto.label}".`);
      }
      throw e;
    }
  }

  async getUnit(user: RequestUser, unitId: string) {
    const unit = await this.findUnit(unitId);
    const building = await this.assertMayManage(user, unit.buildingId);
    return this.unitView(unit.id, await this.controls.getCountrySettings(building.countryCode));
  }

  /**
   * Changes room counts or details. New room counts rebuild the checklist: parts that remain keep their notes and
   * media; parts no longer needed are removed, unless photos or videos were already taken for them, in which case
   * they are kept as optional so nothing captured is lost.
   */
  async updateUnit(user: RequestUser, unitId: string, dto: UpdateUnitDto) {
    const unit = await this.findUnit(unitId);
    const building = await this.assertMayManage(user, unit.buildingId);
    const settings = await this.controls.getCountrySettings(building.countryCode);
    const details = dto.details === undefined ? undefined : this.details({ ...(unit.details as object), ...dto.details }, settings);
    const counts = {
      bedrooms: dto.bedrooms ?? unit.bedrooms,
      bathrooms: dto.bathrooms ?? unit.bathrooms,
      toilets: dto.toilets ?? unit.toilets,
    };
    const countsChanged = counts.bedrooms !== unit.bedrooms || counts.bathrooms !== unit.bathrooms || counts.toilets !== unit.toilets;

    await this.prisma.$transaction(async (tx) => {
      await tx.unit.update({ where: { id: unit.id }, data: { ...counts, ...(details !== undefined && { details }) } });
      if (!countsChanged) return;
      const type = await tx.propertyType.findUniqueOrThrow({ where: { id: unit.propertyTypeId } });
      const wanted = generateParts(type.partTemplate, counts, settings.listings.defaultMinPhotosPerPart);
      const existing = await tx.unitPart.findMany({ where: { unitId: unit.id }, include: { _count: { select: { media: true } } } });
      const byCode = new Map(existing.map((p) => [p.code, p]));
      for (const part of wanted) {
        const { code, ...rest } = part;
        if (byCode.has(code)) await tx.unitPart.update({ where: { id: byCode.get(code)!.id }, data: rest });
        else await tx.unitPart.create({ data: { unitId: unit.id, ...part } });
      }
      const wantedCodes = new Set(wanted.map((p) => p.code));
      let order = wanted.length;
      for (const p of existing.filter((x) => !wantedCodes.has(x.code))) {
        if (p._count.media > 0) await tx.unitPart.update({ where: { id: p.id }, data: { required: false, sortOrder: order++ } });
        else await tx.unitPart.delete({ where: { id: p.id } });
      }
    });
    return this.unitView(unit.id, settings);
  }

  /** Adds, changes or removes the note on one part, e.g. "newly tiled" (decision 56). */
  async setPartNote(user: RequestUser, unitId: string, partCode: string, note: string | null | undefined) {
    const unit = await this.findUnit(unitId);
    const building = await this.assertMayManage(user, unit.buildingId);
    const part = await this.prisma.unitPart.findUnique({ where: { unitId_code: { unitId: unit.id, code: partCode } } });
    if (!part) throw new NotFoundException('This unit has no such part.');
    await this.prisma.unitPart.update({ where: { id: part.id }, data: { note: note?.trim() ? note.trim() : null } });
    return this.unitView(unit.id, await this.controls.getCountrySettings(building.countryCode));
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private details(raw: unknown, settings: CountrySettings) {
    const result = checkUnitDetails(raw, settings);
    if (!result.ok) throw apiError(400, 'INVALID_DETAILS', `These details are not valid: ${result.problems.join('; ')}`);
    return result.details;
  }

  private async findUnit(unitId: string): Promise<Unit> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found.');
    return unit;
  }

  /**
   * The building, if the user is its owner, registered it, or is an agent with approved and unexpired authority
   * for it. Anyone else gets "not found", so the building's existence is not revealed.
   */
  private async assertMayManage(user: RequestUser, buildingId: string) {
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
      select: {
        id: true,
        countryCode: true,
        ownerId: true,
        createdById: true,
        authorities: {
          where: { agentId: user.id, status: 'APPROVED', OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!building || (building.ownerId !== user.id && building.createdById !== user.id && building.authorities.length === 0)) {
      throw new NotFoundException('Building not found.');
    }
    return building;
  }

  private async buildingView(buildingId: string, settings: CountrySettings) {
    const [row] = await this.prisma.$queryRaw<
      {
        id: string;
        cityId: string;
        area: string;
        street: string;
        houseNumber: string | null;
        landmark: string | null;
        distanceToMainRoadM: number | null;
        lat: number;
        lng: number;
        locationAccuracyM: number | null;
        ownerId: string | null;
        offPlatformOwnerName: string | null;
        createdAt: Date;
      }[]
    >`
      SELECT "id", "cityId", "area", "street", "houseNumber", "landmark", "distanceToMainRoadM",
             ST_Y("location"::geometry) AS "lat", ST_X("location"::geometry) AS "lng", "locationAccuracyM",
             "ownerId", "offPlatformOwnerName", "createdAt"
      FROM "Building" WHERE "id" = ${buildingId}::uuid`;
    const owner = row.ownerId ? await this.prisma.user.findUnique({ where: { id: row.ownerId }, select: { identityVerifiedAt: true } }) : null;
    const units = await this.prisma.unit.findMany({ where: { buildingId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    return {
      id: row.id,
      cityId: row.cityId,
      area: row.area,
      street: row.street,
      houseNumber: row.houseNumber,
      landmark: row.landmark,
      distanceToMainRoadM: row.distanceToMainRoadM,
      location: { lat: row.lat, lng: row.lng },
      locationAccuracyM: row.locationAccuracyM,
      ownerOnPlatform: !!row.ownerId,
      ownerVerified: !!owner?.identityVerifiedAt,
      offPlatformOwnerName: row.offPlatformOwnerName,
      createdAt: row.createdAt,
      units: await Promise.all(units.map((u) => this.unitView(u.id, settings))),
    };
  }

  private async unitView(unitId: string, settings: CountrySettings) {
    const unit = await this.prisma.unit.findUniqueOrThrow({ where: { id: unitId }, include: { parts: { orderBy: { sortOrder: 'asc' } } } });
    const counts = await this.prisma.mediaAsset.groupBy({
      by: ['unitPartId'],
      where: { unitId, status: 'READY', removedAt: null, unitPartId: { not: null } },
      _count: { _all: true },
    });
    const captured = new Map(counts.map((c) => [c.unitPartId!, c._count._all]));
    const parts: PartWithCount[] = unit.parts.map((p) => ({ ...p, captured: captured.get(p.id) ?? 0 }));
    return {
      id: unit.id,
      buildingId: unit.buildingId,
      label: unit.label,
      propertyTypeId: unit.propertyTypeId,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      toilets: unit.toilets,
      floorLevel: unit.floorLevel,
      floorArea: unit.floorAreaSqm === null ? null : fromSqm(Number(unit.floorAreaSqm), settings),
      areaUnit: settings.formats.areaUnit,
      details: unit.details,
      parts: parts.map((p) => ({
        code: p.code,
        label: p.label,
        required: p.required,
        minPhotos: p.minPhotos,
        mediaKind: p.mediaKind,
        note: p.note,
        captured: p.captured,
        complete: p.captured >= Math.max(p.minPhotos, 1),
      })),
      checklistComplete: parts.filter((p) => p.required).every((p) => p.captured >= Math.max(p.minPhotos, 1)),
    };
  }
}

function toSqm(value: number, settings: CountrySettings): number {
  return Math.round((settings.formats.areaUnit === 'SQFT' ? value * SQFT_IN_SQM : value) * 100) / 100;
}

function fromSqm(value: number, settings: CountrySettings): number {
  return Math.round((settings.formats.areaUnit === 'SQFT' ? value / SQFT_IN_SQM : value) * 100) / 100;
}
