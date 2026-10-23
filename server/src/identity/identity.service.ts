import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apiError } from '../common/api-error.js';
import { FieldEncryption } from '../common/field-encryption.js';
import type { Env } from '../config/env.js';
import { ControlsService } from '../controls/controls.service.js';
import type { RequestUser } from '../controls/request-context.js';
import type { CheckStatus, IdentityNextAction, IdentityVerification, Prisma } from '../generated/prisma/client.js';
import {
  IDENTITY_PROVIDERS,
  UntrustedResultError,
  type IdentityCheckResult,
  type IdentityProviders,
  type IncomingResult,
} from '../integrations/identity/identity-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AgentProfileDto, StartIdentityCheckDto } from './dto.js';
import { idLookupHash, idNumberFits, last4, namesMatch, standardIdNumber } from './id-number.js';

/** Checks that still count as holding an ID number: a later account using the same number goes to review. */
const HOLDING: CheckStatus[] = ['PENDING', 'PASSED', 'MANUAL_REVIEW'];

export interface Outcome {
  status: Exclude<CheckStatus, 'PENDING'>;
  failureReason: string | null;
  nextAction: IdentityNextAction | null;
}

/**
 * What a provider's findings mean (ADR 0007, decision 49).
 *
 * - Liveness failed: the selfie was not a live person. Try again; a document photo would not help.
 * - ID not found, or face does not match the ID photo: failed, but the user may add a document photo for the
 *   verification team (the official record or its photo may be wrong or old).
 * - Name does not clearly match: sent to the verification team, and the user may add a document photo.
 * - Otherwise: passed.
 */
export function outcomeOf(result: IdentityCheckResult, user: { firstName: string; lastName: string }): Outcome {
  if (!result.livenessPassed) return { status: 'FAILED', failureReason: 'LIVENESS_FAILED', nextAction: null };
  if (!result.idFound) return { status: 'FAILED', failureReason: 'ID_NOT_FOUND', nextAction: 'UPLOAD_ID_DOCUMENT' };
  if (!result.faceMatched) return { status: 'FAILED', failureReason: 'FACE_MISMATCH', nextAction: 'UPLOAD_ID_DOCUMENT' };
  if (!namesMatch(user.firstName, user.lastName, result.nameOnId)) {
    return { status: 'MANUAL_REVIEW', failureReason: 'NAME_MISMATCH', nextAction: 'UPLOAD_ID_DOCUMENT' };
  }
  return { status: 'PASSED', failureReason: null, nextAction: null };
}

/** An identity check as the apps see it. The ID number is never returned, only its last four characters. */
export function toCheckView(c: IdentityVerification) {
  return {
    id: c.id,
    idType: c.idType,
    idNumberLast4: c.idNumberLast4,
    status: c.status,
    failureReason: c.failureReason,
    nextAction: c.nextAction,
    documentAttached: c.documentId !== null,
    createdAt: c.createdAt,
    completedAt: c.completedAt,
  };
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  private readonly lookupSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    private readonly encryption: FieldEncryption,
    @Inject(IDENTITY_PROVIDERS) private readonly providers: IdentityProviders,
    config: ConfigService<Env, true>,
  ) {
    this.lookupSecret = config.get('LOOKUP_HASH_SECRET', { infer: true });
  }

  /**
   * Starts an identity check and returns the values the app needs for the provider's camera flow.
   *
   * Refused when the user is already verified, has a check with the verification team, or has used up the day's
   * checks. Starting again replaces an unfinished check. If another account already holds the same ID number,
   * nothing is sent to the provider: the check goes to the verification team and the answer is 409.
   */
  async start(user: RequestUser, dto: StartIdentityCheckDto) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { firstName: true, lastName: true, countryCode: true, identityVerifiedAt: true },
    });
    if (u.identityVerifiedAt) throw apiError(409, 'ALREADY_VERIFIED', 'Your identity is already verified.');

    const settings = await this.controls.getCountrySettings(u.countryCode);
    const provider = settings.verification.identityProvider
      ? this.providers.get(settings.verification.identityProvider)
      : undefined;
    if (!provider) {
      throw apiError(403, 'IDENTITY_CHECK_UNAVAILABLE', 'Identity checks are not available in your country yet.');
    }
    if (!settings.verification.acceptedIdTypes.includes(dto.idType)) {
      throw apiError(400, 'ID_TYPE_NOT_ACCEPTED', 'This type of ID is not accepted in your country.', {
        acceptedIdTypes: settings.verification.acceptedIdTypes,
      });
    }
    const idNumber = standardIdNumber(dto.idNumber);
    if (!idNumberFits(idNumber, settings.verification.idNumberPatterns[dto.idType])) {
      throw apiError(400, 'INVALID_ID_NUMBER', 'This ID number is not in the right format. Please check it.');
    }
    const idNumberHash = idLookupHash(this.lookupSecret, u.countryCode, dto.idType, idNumber);

    const { check, duplicate } = await this.prisma.$transaction(async (tx) => {
      // Lock the user's row so two checks started at the same moment are handled one after the other.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id}::uuid FOR UPDATE`;

      const underReview = await tx.identityVerification.findFirst({
        where: { userId: user.id, status: 'MANUAL_REVIEW' },
        select: { id: true },
      });
      if (underReview) {
        throw apiError(409, 'CHECK_UNDER_REVIEW', 'Your last identity check is with our verification team. We will let you know.');
      }
      const today = await tx.identityVerification.count({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
          OR: [{ failureReason: null }, { failureReason: { not: 'PROVIDER_ERROR' } }],
        },
      });
      if (today >= settings.verification.maxIdentityChecksPerDay) {
        throw apiError(429, 'TOO_MANY_CHECKS', 'You have tried the identity check too many times today. Please try again tomorrow.');
      }

      const heldElsewhere = await tx.identityVerification.findFirst({
        where: { idNumberHash, userId: { not: user.id }, status: { in: HOLDING } },
        select: { id: true },
      });
      const now = new Date();
      // An unfinished check is replaced; a late result for it is ignored.
      await tx.identityVerification.updateMany({
        where: { userId: user.id, status: 'PENDING' },
        data: { status: 'FAILED', failureReason: 'REPLACED', completedAt: now },
      });
      const created = await tx.identityVerification.create({
        data: {
          userId: user.id,
          provider: provider.name,
          idType: dto.idType,
          idNumberEncrypted: this.encryption.encrypt(idNumber),
          idNumberLast4: last4(idNumber),
          idNumberHash,
          ...(heldElsewhere ? { status: 'MANUAL_REVIEW', failureReason: 'DUPLICATE_ID' } : {}),
        },
      });
      if (heldElsewhere) await this.sendForReview(tx, 'DUPLICATE_RESOLUTION', u.countryCode, created.id);
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: heldElsewhere ? 'identity.duplicate_id' : 'identity.check_started',
          entityType: 'IdentityVerification',
          entityId: created.id,
          metadata: { idType: dto.idType, provider: provider.name },
        },
      });
      return { check: created, duplicate: !!heldElsewhere };
    });

    if (duplicate) {
      throw apiError(
        409,
        'ID_ALREADY_LINKED',
        'This ID is already linked to another account. Our verification team will review it and contact you.',
        { check: toCheckView(check) },
      );
    }

    let started;
    try {
      started = await provider.start({
        checkId: check.id,
        countryCode: u.countryCode,
        idType: dto.idType,
        idNumber,
        firstName: u.firstName,
        lastName: u.lastName,
      });
    } catch (err) {
      this.logger.error(`Identity provider ${provider.name} could not start check ${check.id}: ${String(err)}`);
      await this.prisma.identityVerification.update({
        where: { id: check.id },
        data: { status: 'FAILED', failureReason: 'PROVIDER_ERROR', completedAt: new Date() },
      });
      throw apiError(503, 'IDENTITY_PROVIDER_UNAVAILABLE', 'The identity check service is not available right now. Please try again shortly.');
    }
    const saved = await this.prisma.identityVerification.update({
      where: { id: check.id },
      data: { providerReference: started.reference },
    });
    return { ...toCheckView(saved), providerSession: started.session };
  }

  async list(userId: string) {
    const checks = await this.prisma.identityVerification.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return checks.map(toCheckView);
  }

  async get(userId: string, checkId: string) {
    const check = await this.prisma.identityVerification.findFirst({ where: { id: checkId, userId } });
    if (!check) throw apiError(404, 'NOT_FOUND', 'Identity check not found.');
    return toCheckView(check);
  }

  /**
   * Records a result sent by a provider. The adapter first confirms the result is genuine. A result for a check
   * that is no longer pending (already decided, or replaced) is ignored, so a provider resending it is harmless.
   */
  async receiveResult(providerName: string, incoming: IncomingResult): Promise<{ recorded: boolean }> {
    const provider = this.providers.get(providerName);
    if (!provider) throw apiError(404, 'NOT_FOUND', 'Unknown identity provider.');
    let result: IdentityCheckResult;
    try {
      result = await provider.readResult(incoming);
    } catch (err) {
      if (err instanceof UntrustedResultError) throw apiError(401, 'UNTRUSTED_RESULT', 'This result could not be verified.');
      throw err;
    }

    const check = await this.prisma.identityVerification.findUnique({
      where: { provider_providerReference: { provider: provider.name, providerReference: result.reference } },
      include: { user: { select: { firstName: true, lastName: true, countryCode: true } } },
    });
    if (!check) throw apiError(404, 'NOT_FOUND', 'Identity check not found.');
    if (check.status !== 'PENDING') return { recorded: false };

    const recorded = await this.prisma.$transaction(async (tx) => {
      // Two accounts that started checks on the same ID at the same moment both reach here; the later
      // result goes to the verification team instead of passing.
      const heldElsewhere = await tx.identityVerification.findFirst({
        where: { idNumberHash: check.idNumberHash, userId: { not: check.userId }, status: { in: ['PASSED', 'MANUAL_REVIEW'] } },
        select: { id: true },
      });
      const outcome: Outcome = heldElsewhere
        ? { status: 'MANUAL_REVIEW', failureReason: 'DUPLICATE_ID', nextAction: null }
        : outcomeOf(result, check.user);
      const now = new Date();
      // Only a check still pending is updated, so two deliveries of the same result cannot both count.
      const { count } = await tx.identityVerification.updateMany({
        where: { id: check.id, status: 'PENDING' },
        data: {
          nameOnId: result.nameOnId,
          livenessPassed: result.livenessPassed,
          faceMatchScore: result.faceMatchScore,
          nameMatches: namesMatch(check.user.firstName, check.user.lastName, result.nameOnId),
          status: outcome.status,
          failureReason: outcome.failureReason,
          nextAction: outcome.nextAction,
          completedAt: outcome.status === 'MANUAL_REVIEW' ? null : now,
        },
      });
      if (count === 0) return false;

      if (outcome.status === 'PASSED') {
        await tx.user.updateMany({ where: { id: check.userId, identityVerifiedAt: null }, data: { identityVerifiedAt: now } });
      } else if (outcome.status === 'MANUAL_REVIEW') {
        const type = outcome.failureReason === 'DUPLICATE_ID' ? 'DUPLICATE_RESOLUTION' : 'IDENTITY_REVIEW';
        await this.sendForReview(tx, type, check.user.countryCode, check.id);
      }
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'identity.check_completed',
          entityType: 'IdentityVerification',
          entityId: check.id,
          metadata: { provider: provider.name, status: outcome.status, failureReason: outcome.failureReason },
        },
      });
      return true;
    });
    return { recorded };
  }

  /**
   * Adds a document photo to a check that failed or did not match (decision 49), and sends it to the verification
   * team. Only allowed when the check says UPLOAD_ID_DOCUMENT, and only with a finished identity upload of the user's
   * own that is not attached to another check.
   */
  async attachDocument(userId: string, checkId: string, documentId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "IdentityVerification" WHERE "id" = ${checkId}::uuid FOR UPDATE`;
      const check = await tx.identityVerification.findFirst({
        where: { id: checkId, userId },
        include: { user: { select: { countryCode: true, identityVerifiedAt: true } } },
      });
      if (!check) throw apiError(404, 'NOT_FOUND', 'Identity check not found.');
      if (check.nextAction !== 'UPLOAD_ID_DOCUMENT' || check.user.identityVerifiedAt) {
        throw apiError(409, 'DOCUMENT_NOT_REQUESTED', 'This identity check does not need a document.');
      }
      const doc = await tx.document.findFirst({
        where: { id: documentId, ownerId: userId, purpose: 'IDENTITY', deletedAt: null },
        include: { identityCheck: { select: { id: true } } },
      });
      if (!doc) throw apiError(404, 'NOT_FOUND', 'Document not found.');
      if (!doc.uploadedAt) throw apiError(409, 'UPLOAD_NOT_COMPLETE', 'Please finish uploading the document first.');
      if (doc.identityCheck) throw apiError(409, 'DOCUMENT_ALREADY_USED', 'This document is already attached to another check.');

      const saved = await tx.identityVerification.update({
        where: { id: check.id },
        data: { documentId: doc.id, status: 'MANUAL_REVIEW', nextAction: null, completedAt: null },
      });
      const open = await tx.reviewTask.findFirst({
        where: { entityType: 'IdentityVerification', entityId: check.id, status: { in: ['OPEN', 'ASSIGNED'] } },
        select: { id: true },
      });
      if (!open) await this.sendForReview(tx, 'IDENTITY_REVIEW', check.user.countryCode, check.id);
      await tx.auditLog.create({
        data: { actorId: userId, action: 'identity.document_added', entityType: 'IdentityVerification', entityId: check.id, metadata: { documentId: doc.id } },
      });
      return toCheckView(saved);
    });
  }

  /** Saves an agent's company details (decision 50) and asks the verification team to check them. */
  async saveAgentProfile(user: RequestUser, dto: AgentProfileDto) {
    if (!user.types.includes('AGENT')) {
      throw apiError(403, 'NOT_AN_AGENT', 'Company details are for agents. Add "agent" to your account types first.');
    }
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.agentProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, businessName: dto.businessName, registrationNumber: dto.registrationNumber ?? null },
        update: {
          businessName: dto.businessName,
          registrationNumber: dto.registrationNumber ?? null,
          status: 'PENDING',
          reviewedAt: null,
        },
      });
      const open = await tx.reviewTask.findFirst({
        where: { type: 'AGENT_PROFILE_REVIEW', entityId: user.id, status: { in: ['OPEN', 'ASSIGNED'] } },
        select: { id: true },
      });
      if (!open) await this.sendForReview(tx, 'AGENT_PROFILE_REVIEW', user.countryCode, user.id, 'AgentProfile');
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'agent_profile.saved', entityType: 'AgentProfile', entityId: user.id },
      });
      return toAgentProfileView(profile);
    });
  }

  async getAgentProfile(userId: string) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { userId } });
    if (!profile) throw apiError(404, 'NOT_FOUND', 'No company details saved yet.');
    return toAgentProfileView(profile);
  }

  private async sendForReview(
    tx: Prisma.TransactionClient,
    type: 'IDENTITY_REVIEW' | 'DUPLICATE_RESOLUTION' | 'AGENT_PROFILE_REVIEW',
    countryCode: string,
    entityId: string,
    entityType = 'IdentityVerification',
  ): Promise<void> {
    await tx.reviewTask.create({ data: { type, countryCode, entityType, entityId } });
  }
}

function toAgentProfileView(p: { businessName: string | null; registrationNumber: string | null; status: CheckStatus }) {
  return { businessName: p.businessName, registrationNumber: p.registrationNumber, status: p.status };
}
