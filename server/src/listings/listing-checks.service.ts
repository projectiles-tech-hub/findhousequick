import { Injectable } from '@nestjs/common';
import type { CountrySettings } from '../controls/country-settings.schema.js';
import type { CheckResult, CheckType, Prisma, RiskBand } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface CheckOutcome {
  type: CheckType;
  result: CheckResult;
  riskPoints: number;
  /** A plain sentence for the verification team. */
  summary: string;
  details?: Record<string, unknown>;
}

export interface RiskAssessment {
  score: number;
  band: RiskBand;
  checks: CheckOutcome[];
}

/**
 * A fingerprint with almost all bits the same comes from a picture with no shape in it (a blank wall, a plain
 * pattern). Such fingerprints match each other by accident, so they are left out of the duplicate photo check.
 */
const MIN_BITS = 8;

/** Listings in these states take part in the duplicate checks. */
const OPEN_LISTING = ['SUBMITTED', 'IN_REVIEW', 'LIVE', 'PAUSED'];

/**
 * The Release 1 automatic checks (Specification 6.3 to 6.5, decision 58): live media, the walkthrough video, the
 * duplicate checks (location and address, photo fingerprint, document numbers) and the name match, which the
 * verification team does by hand. Their points add up to the risk score: green goes live, amber goes to a desk
 * review, red needs a site visit (Specification 6.4). The satellite and stolen photo checks come in Release 2.
 */
@Injectable()
export class ListingChecksService {
  constructor(private readonly prisma: PrismaService) {}

  async assess(listing: { id: string; unitId: string }, buildingId: string, settings: CountrySettings): Promise<RiskAssessment> {
    const points = settings.verification.riskPoints;
    const checks: CheckOutcome[] = [];

    // Live media: every photo and video that is ready was taken with the app's camera, at the building and within the
    // allowed time, and passed the quality checks when it was uploaded (ADR 0009).
    const media = await this.prisma.mediaAsset.findMany({
      where: { unitId: listing.unitId, status: 'READY', removedAt: null },
      select: { id: true, kind: true },
    });
    const photos = media.filter((m) => m.kind !== 'VIDEO');
    checks.push({ type: 'LIVE_MEDIA', result: photos.length ? 'PASS' : 'FAIL', riskPoints: photos.length ? 0 : settings.verification.riskBands.redFrom, summary: `${photos.length} photos taken on site through the app.` });
    const videos = media.length - photos.length;
    checks.push({
      type: 'VIDEO_WALKTHROUGH',
      result: videos ? 'PASS' : 'SKIPPED',
      riskPoints: 0,
      summary: videos ? 'Walkthrough video recorded at the building.' : 'No walkthrough video is required for this property type.',
    });

    // Duplicate location and address: another building at the same spot or address with an open listing.
    const near = await this.prisma.$queryRaw<{ id: string; sameAddress: boolean; metres: number }[]>`
      SELECT o."id", (o."addressKey" = b."addressKey") AS "sameAddress", ST_Distance(o."location", b."location") AS "metres"
      FROM "Building" b JOIN "Building" o ON o."id" <> b."id" AND o."countryCode" = b."countryCode"
        AND (o."addressKey" = b."addressKey" OR ST_DWithin(o."location", b."location", ${settings.listings.duplicateRadiusMetres}))
      WHERE b."id" = ${buildingId}::uuid
        AND EXISTS (SELECT 1 FROM "Listing" l JOIN "Unit" u ON u."id" = l."unitId" WHERE u."buildingId" = o."id" AND l."status"::text = ANY(${OPEN_LISTING}))
      LIMIT 10`;
    checks.push(
      near.length
        ? {
            type: 'DUPLICATE_LOCATION',
            result: 'FAIL',
            riskPoints: points.duplicateLocation,
            summary: `Another building with an open listing is at the same spot or address (${near.length} found).`,
            details: { buildings: near.map((n) => ({ id: n.id, sameAddress: n.sameAddress, metres: Math.round(n.metres) })) },
          }
        : { type: 'DUPLICATE_LOCATION', result: 'PASS', riskPoints: 0, summary: 'No other building with an open listing at this spot or address.' },
    );

    // Duplicate photos: a fingerprint that matches a photo of another building (Specification 6.5).
    const matches = await this.prisma.$queryRaw<{ id: string; otherId: string; otherBuildingId: string }[]>`
      SELECT m."id", o."id" AS "otherId", o."buildingId" AS "otherBuildingId"
      FROM "MediaAsset" m JOIN "MediaAsset" o ON o."buildingId" <> m."buildingId" AND o."status" = 'READY' AND o."removedAt" IS NULL
        AND o."kind" <> 'VIDEO' AND o."perceptualHash" ~ '^[0-9a-f]{16}$'
        AND bit_count(('x' || o."perceptualHash")::bit(64)) BETWEEN ${MIN_BITS} AND ${64 - MIN_BITS}
        AND bit_count(('x' || m."perceptualHash")::bit(64) # ('x' || o."perceptualHash")::bit(64)) <= ${settings.verification.photoMatchBits}
      WHERE m."unitId" = ${listing.unitId}::uuid AND m."status" = 'READY' AND m."removedAt" IS NULL AND m."kind" <> 'VIDEO'
        AND m."perceptualHash" ~ '^[0-9a-f]{16}$'
        AND bit_count(('x' || m."perceptualHash")::bit(64)) BETWEEN ${MIN_BITS} AND ${64 - MIN_BITS}
      LIMIT 20`;
    checks.push(
      matches.length
        ? {
            type: 'DUPLICATE_PHOTO',
            result: 'FAIL',
            riskPoints: points.duplicatePhoto,
            summary: `${new Set(matches.map((m) => m.id)).size} photo(s) match photos of another building.`,
            details: { matches: matches.map((m) => ({ mediaId: m.id, otherMediaId: m.otherId, otherBuildingId: m.otherBuildingId })) },
          }
        : { type: 'DUPLICATE_PHOTO', result: 'PASS', riskPoints: 0, summary: 'No photo matches a photo of another building.' },
    );

    // Duplicate documents: a document number already used on another building.
    const documents = await this.prisma.document.findMany({
      where: { buildingId, purpose: 'OWNERSHIP', uploadedAt: { not: null }, deletedAt: null },
      select: { id: true, documentNumber: true, status: true },
    });
    const numbers = documents.map((d) => d.documentNumber).filter((n): n is string => !!n);
    const reused = numbers.length
      ? await this.prisma.document.findMany({
          where: { documentNumber: { in: numbers }, buildingId: { not: buildingId }, deletedAt: null, NOT: { buildingId: null } },
          select: { id: true, buildingId: true },
          take: 10,
        })
      : [];
    checks.push(
      !numbers.length
        ? { type: 'DUPLICATE_DOCUMENT', result: 'SKIPPED', riskPoints: 0, summary: 'No document number has been recorded yet; the team records it at the desk review.' }
        : reused.length
          ? {
              type: 'DUPLICATE_DOCUMENT',
              result: 'FAIL',
              riskPoints: points.duplicateDocument,
              summary: 'A document number on this building is already used on another building.',
              details: { documents: reused },
            }
          : { type: 'DUPLICATE_DOCUMENT', result: 'PASS', riskPoints: 0, summary: 'No document number is used on another building.' },
    );

    // Name match: done by the verification team (decision 58). Until the ownership documents have passed their
    // review, the listing needs a desk review.
    const matched = documents.length > 0 && documents.every((d) => d.status === 'PASSED');
    checks.push(
      matched
        ? { type: 'NAME_MATCH', result: 'PASS', riskPoints: 0, summary: "The ownership documents were matched to the owner's name by the team." }
        : { type: 'NAME_MATCH', result: 'WARN', riskPoints: points.nameMatchPending, summary: "The team has not yet matched the ownership documents to the owner's verified name." },
    );

    const score = checks.reduce((sum, c) => sum + c.riskPoints, 0);
    const { amberFrom, redFrom } = settings.verification.riskBands;
    return { score, band: score >= redFrom ? 'RED' : score >= amberFrom ? 'AMBER' : 'GREEN', checks };
  }

  /** Stores the results of one run and the score on the listing. Earlier runs are kept as history. */
  async record(tx: Prisma.TransactionClient, listingId: string, a: RiskAssessment): Promise<void> {
    await tx.verificationCheck.createMany({
      data: a.checks.map((c) => ({ listingId, type: c.type, result: c.result, riskPoints: c.riskPoints, details: { summary: c.summary, ...c.details } as Prisma.InputJsonValue })),
    });
    await tx.listing.update({ where: { id: listingId }, data: { riskScore: a.score, riskBand: a.band } });
  }
}
