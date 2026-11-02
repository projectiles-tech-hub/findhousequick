import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import { geographyPoint } from '../common/geo.js';
import { uuidv7 } from '../common/ids.js';
import { ControlsService } from '../controls/controls.service.js';
import type { FeatureKey } from '../controls/feature-catalogue.js';
import type { RequestUser } from '../controls/request-context.js';
import { Prisma, type MediaAsset, type UnitPart } from '../generated/prisma/client.js';
import { PRIVATE_STORAGE, type PrivateStorage } from '../integrations/storage/private-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PropertiesService } from '../properties/properties.service.js';
import { MAX_PHOTO_BYTES, PHOTO_CONTENT_TYPES, VIDEO_CONTENT_TYPES, type StartMediaUploadDto } from './dto.js';
import { MediaQueue } from './media.queue.js';

/** Each part of a resumable upload is 8 MB, except the last. */
export const PART_SIZE_BYTES = 8 * 1024 * 1024;
/** Minutes an upload link or a display link stays valid. */
const UPLOAD_LINK_MINUTES = 60;
export const DISPLAY_LINK_MINUTES = 15;
/** A capture time may run ahead of the server clock by this much (phone clocks drift). */
const CLOCK_SLACK_MS = 5 * 60_000;
/** Listing states in which a unit's photos and videos are fixed (waiting for review, live or paused). */
const LOCKED_LISTING_STATES = ['SUBMITTED', 'IN_REVIEW', 'LIVE', 'PAUSED'] as const;

export type MediaWithPart = MediaAsset & { unitPart: UnitPart | null };

/**
 * Photo and video upload for each part of a unit (ADR 0009; Specification 5.3 and 15.3).
 *
 * The app sends each file in parts straight to private storage, then confirms; the server joins the parts, checks the
 * file is the one declared, and hands it to the media queue for processing. Only display copies, behind expiring
 * links, are ever returned; originals stay private.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    private readonly properties: PropertiesService,
    private readonly queue: MediaQueue,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async start(user: RequestUser, unitId: string, dto: StartMediaUploadDto, idempotencyKey: string | undefined) {
    if (idempotencyKey) {
      const earlier = await this.prisma.mediaAsset.findUnique({
        where: { uploadedById_idempotencyKey: { uploadedById: user.id, idempotencyKey } },
      });
      if (earlier) return this.ticketFor(earlier);
    }

    const unit = await this.prisma.unit.findUnique({ where: { id: unitId }, include: { building: { include: { city: true } } } });
    if (!unit) throw new NotFoundException('Unit not found.');
    const building = await this.properties.assertMayManage(user, unit.buildingId);
    await this.assertNotLocked(unit.id);
    const part = await this.prisma.unitPart.findUnique({ where: { unitId_code: { unitId: unit.id, code: dto.partCode } } });
    if (!part) throw apiError(400, 'UNKNOWN_PART', 'This unit has no such part. Check the checklist.');

    // The kind must suit the part: photos for photo parts, video for the walkthrough.
    const isVideo = dto.kind === 'VIDEO';
    if (isVideo !== (part.mediaKind === 'VIDEO')) {
      throw apiError(400, 'WRONG_MEDIA_KIND', isVideo ? 'This part takes photos, not a video.' : 'This part takes a video.');
    }
    const allowedTypes: readonly string[] = isVideo ? VIDEO_CONTENT_TYPES : PHOTO_CONTENT_TYPES;
    if (!allowedTypes.includes(dto.contentType)) {
      throw apiError(400, 'WRONG_CONTENT_TYPE', `This kind of media is sent as ${allowedTypes.join(' or ')}.`);
    }
    if (!isVideo && dto.sizeBytes > MAX_PHOTO_BYTES) throw apiError(400, 'FILE_TOO_LARGE', 'A photo can be at most 25 MB.');
    const extraFeature: FeatureKey | null = dto.kind === 'PHOTO_360' ? 'listings.photo_360' : dto.kind === 'FLOOR_PLAN' ? 'listings.floor_plan' : null;
    if (extraFeature && !(await this.controls.isEnabled(extraFeature, this.contextFor(user, unit.building)))) {
      throw apiError(403, 'FEATURE_UNAVAILABLE', 'This feature is not available at the moment.', { feature: extraFeature });
    }

    // Taken with the app's camera, at the building, recently (Specification 5.3 and 6.2).
    const settings = await this.controls.getCountrySettings(building.countryCode);
    const capturedAt = new Date(dto.capturedAt);
    const now = Date.now();
    if (capturedAt.getTime() > now + CLOCK_SLACK_MS) throw apiError(422, 'CAPTURE_TIME_INVALID', 'The capture time is in the future.');
    if (capturedAt.getTime() < now - settings.listings.maxCaptureAgeHours * 3_600_000) {
      throw apiError(422, 'CAPTURE_TOO_OLD', `Photos and videos must be uploaded within ${settings.listings.maxCaptureAgeHours} hours of being taken. Please take it again.`);
    }
    const [{ metres }] = await this.prisma.$queryRaw<{ metres: number }[]>`
      SELECT ST_Distance("location", ${geographyPoint(dto.captureLocation)}) AS "metres" FROM "Building" WHERE "id" = ${unit.buildingId}::uuid`;
    const allowed = settings.listings.captureRadiusMetres + (dto.captureAccuracyM ?? 0);
    if (metres > allowed) {
      throw apiError(422, 'CAPTURE_TOO_FAR', 'This was not taken at the property. Photos and videos must be taken on site with the app.', {
        distanceM: Math.round(metres),
      });
    }

    const id = uuidv7();
    const partCount = Math.max(1, Math.ceil(dto.sizeBytes / PART_SIZE_BYTES));
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "MediaAsset" ("id", "buildingId", "unitId", "unitPartId", "kind", "status", "originalKey", "sha256", "contentType",
          "sizeBytes", "partCount", "partSizeBytes", "capturedAt", "captureLocation", "captureAccuracyM", "occupantConsent",
          "idempotencyKey", "uploadedById")
        VALUES (${id}::uuid, ${unit.buildingId}::uuid, ${unit.id}::uuid, ${part.id}::uuid, ${dto.kind}::"MediaKind", 'UPLOADING',
          ${`media/${unit.buildingId}/${id}/original`}, ${dto.sha256}, ${dto.contentType}, ${dto.sizeBytes}, ${partCount},
          ${PART_SIZE_BYTES}, ${capturedAt}, ${geographyPoint(dto.captureLocation)}, ${dto.captureAccuracyM ?? null},
          ${dto.occupantConsent ?? false}, ${idempotencyKey ?? null}, ${user.id}::uuid)`;
    } catch (err) {
      // The same Idempotency-Key sent twice at the same moment: carry on with the one that was saved.
      if (idempotencyKey && isUniqueViolation(err)) {
        const saved = await this.prisma.mediaAsset.findUniqueOrThrow({
          where: { uploadedById_idempotencyKey: { uploadedById: user.id, idempotencyKey } },
        });
        return this.ticketFor(saved);
      }
      throw err;
    }
    return this.ticketFor(await this.prisma.mediaAsset.findUniqueOrThrow({ where: { id } }));
  }

  /**
   * Joins the parts, checks the file is the one declared, and starts processing. Confirming again while processing,
   * or after, returns the media as it stands.
   */
  async complete(user: RequestUser, mediaId: string) {
    const media = await this.findOwnMedia(user, mediaId);
    if (media.status !== 'UPLOADING') return this.toItem(media);

    const stored = await this.storage.assembleParts(media.originalKey, media.partCount);
    if (!stored) {
      const received = await this.storage.uploadedParts(media.originalKey, media.partCount);
      throw apiError(409, 'UPLOAD_NOT_FOUND', 'Some parts of the file have not arrived yet. Send the missing parts, then try again.', {
        receivedParts: received,
        partCount: media.partCount,
      });
    }
    if (stored.sizeBytes !== media.sizeBytes || stored.sha256 !== media.sha256) {
      await this.storage.delete(media.originalKey);
      await this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: { status: 'REMOVED', removedAt: new Date(), qualityFlags: { rejectionReasons: ['UPLOAD_MISMATCH'] } },
      });
      throw apiError(400, 'UPLOAD_MISMATCH', 'The file received is not the one described. Please start the upload again.');
    }
    // Only one confirmation moves the media on, even if two arrive together.
    const moved = await this.prisma.mediaAsset.updateMany({ where: { id: media.id, status: 'UPLOADING' }, data: { status: 'PROCESSING' } });
    if (moved.count === 1) await this.queue.add(media.id);
    return this.toItem(await this.findMedia(media.id));
  }

  /** Every photo and video taken for the unit, by part in checklist order. For those who may manage the building. */
  async list(user: RequestUser, unitId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found.');
    await this.properties.assertMayManage(user, unit.buildingId);
    const media = await this.prisma.mediaAsset.findMany({
      where: { unitId, status: { not: 'REMOVED' } },
      include: { unitPart: true },
      orderBy: [{ unitPart: { sortOrder: 'asc' } }, { capturedAt: 'asc' }],
    });
    return Promise.all(media.map((m) => this.toItem(m)));
  }

  /** Removes a photo or video while the unit has no listing waiting for review, live or paused. */
  async remove(user: RequestUser, mediaId: string): Promise<void> {
    const media = await this.findOwnMedia(user, mediaId, false);
    if (media.status === 'REMOVED') return;
    if (media.unitId) await this.assertNotLocked(media.unitId);
    await this.prisma.mediaAsset.update({ where: { id: media.id }, data: { status: 'REMOVED', removedAt: new Date() } });
    await this.deleteFiles(media);
  }

  /** The item the apps see: never the original, only display copies behind short-lived links. */
  async toItem(m: MediaWithPart) {
    const flags = (m.qualityFlags ?? {}) as { rejectionReasons?: string[] };
    let display: Record<string, string | Date> | null = null;
    if (m.status === 'READY' && m.variants && typeof m.variants === 'object') {
      const expiresAt = new Date(Date.now() + DISPLAY_LINK_MINUTES * 60_000);
      display = { expiresAt };
      for (const [size, key] of Object.entries(m.variants as Record<string, string>)) {
        display[size] = await this.storage.createViewLink(key, expiresAt);
      }
    }
    return {
      id: m.id,
      partCode: m.unitPart?.code ?? null,
      kind: m.kind,
      status: m.status,
      rejectionReasons: flags.rejectionReasons ?? [],
      capturedAt: m.capturedAt,
      durationSeconds: m.durationSeconds,
      display,
    };
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private async ticketFor(m: MediaAsset) {
    if (m.status !== 'UPLOADING') {
      throw apiError(409, 'MEDIA_ALREADY_UPLOADED', 'This photo or video has already been uploaded.', { mediaId: m.id });
    }
    const expiresAt = new Date(Date.now() + UPLOAD_LINK_MINUTES * 60_000);
    const links = await this.storage.createPartUploadLinks(m.originalKey, m.partCount, m.partSizeBytes ?? PART_SIZE_BYTES, m.contentType!, expiresAt);
    return {
      mediaId: m.id,
      partSizeBytes: m.partSizeBytes ?? PART_SIZE_BYTES,
      partUrls: links.map((l) => l.url),
      uploadHeaders: links[0]?.headers ?? {},
      receivedParts: await this.storage.uploadedParts(m.originalKey, m.partCount),
      expiresAt,
    };
  }

  private async assertNotLocked(unitId: string): Promise<void> {
    const locked = await this.prisma.listing.findFirst({ where: { unitId, status: { in: [...LOCKED_LISTING_STATES] } }, select: { status: true } });
    if (locked) {
      throw apiError(409, 'LISTING_LOCKED', 'Photos and videos cannot change while the listing is waiting for review, live or paused. Close the listing first.', {
        listingStatus: locked.status,
      });
    }
  }

  private async findMedia(mediaId: string): Promise<MediaWithPart> {
    return this.prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId }, include: { unitPart: true } });
  }

  /** The media, if the user uploaded it or may manage its building; otherwise "not found". */
  private async findOwnMedia(user: RequestUser, mediaId: string, mustBeUploader = true): Promise<MediaWithPart> {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId }, include: { unitPart: true } });
    if (!media) throw new NotFoundException('Media not found.');
    if (mustBeUploader && media.uploadedById !== user.id) throw new NotFoundException('Media not found.');
    await this.properties.assertMayManage(user, media.buildingId).catch(() => {
      throw new NotFoundException('Media not found.');
    });
    return media;
  }

  private async deleteFiles(m: MediaAsset): Promise<void> {
    await this.storage.delete(m.originalKey);
    for (const key of Object.values((m.variants ?? {}) as Record<string, string>)) await this.storage.delete(key);
  }

  private contextFor(user: RequestUser, building: { countryCode: string; cityId: string; city: { regionId: string } }) {
    return { countryCode: building.countryCode, regionId: building.city.regionId, cityId: building.cityId, userTypes: user.types, userId: user.id };
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return true;
  // Raw inserts report the database error code instead.
  return err instanceof Error && /23505|unique constraint/i.test(err.message);
}
