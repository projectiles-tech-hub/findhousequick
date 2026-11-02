import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { apiError } from '../common/api-error.js';
import { ControlsService } from '../controls/controls.service.js';
import type { RequestUser } from '../controls/request-context.js';
import { Prisma, type Document, type DocumentType } from '../generated/prisma/client.js';
import { PRIVATE_STORAGE, type PrivateStorage } from '../integrations/storage/private-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StartDocumentUploadDto } from './dto.js';

/** Minutes an upload link stays valid. */
const UPLOAD_LINK_MINUTES = 15;

export function toDocumentView(d: Document & { documentType: DocumentType | null }) {
  return {
    id: d.id,
    documentTypeCode: d.documentType?.code ?? null,
    purpose: d.purpose,
    status: d.status,
    uploaded: d.uploadedAt !== null,
    createdAt: d.createdAt,
  };
}

/**
 * Private documents (ADR 0007): the app asks for an upload link, sends the file straight to private storage, then
 * confirms. The server checks the stored file's size and SHA-256 against what the app declared before accepting it.
 * Files are never publicly reachable.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controls: ControlsService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
  ) {}

  async startUpload(user: RequestUser, dto: StartDocumentUploadDto, idempotencyKey: string | undefined) {
    if (dto.purpose === 'DISPUTE_EVIDENCE' || dto.purpose === 'OTHER') {
      throw apiError(400, 'PURPOSE_NOT_AVAILABLE', 'This kind of document cannot be uploaded yet.');
    }
    if (idempotencyKey) {
      const earlier = await this.prisma.document.findUnique({
        where: { ownerId_idempotencyKey: { ownerId: user.id, idempotencyKey } },
      });
      if (earlier) return this.ticketFor(earlier);
    }

    // Identity documents belong to the user's own country; ownership and authority documents to the building's.
    let countryCode = user.countryCode;
    let buildingId: string | null = null;
    if (dto.purpose !== 'IDENTITY') {
      if (!dto.buildingId) throw apiError(400, 'BAD_REQUEST', 'buildingId is needed for ownership and authority documents.');
      const building = await this.buildingFor(user, dto.purpose, dto.buildingId);
      countryCode = building.countryCode;
      buildingId = building.id;
    } else if (dto.buildingId) {
      throw apiError(400, 'BAD_REQUEST', 'Identity documents are not tied to a building.');
    }

    const settings = await this.controls.getCountrySettings(countryCode);
    const type = await this.prisma.documentType.findUnique({
      where: { countryCode_code: { countryCode, code: dto.documentTypeCode } },
    });
    const accepted = await this.acceptedTypes(dto.purpose, countryCode, settings.verification.idDocumentTypes);
    if (!type || !type.enabled || !accepted.includes(type.code)) {
      throw apiError(400, 'DOCUMENT_TYPE_NOT_ACCEPTED', 'This type of document is not accepted here.', { acceptedDocumentTypes: accepted });
    }

    try {
      const doc = await this.prisma.document.create({
        data: {
          ownerId: user.id,
          documentTypeId: type.id,
          purpose: dto.purpose,
          buildingId,
          storageKey: `documents/${user.id}/${randomUUID()}`,
          sha256: dto.sha256,
          contentType: dto.contentType,
          sizeBytes: dto.sizeBytes,
          idempotencyKey: idempotencyKey ?? null,
        },
      });
      return this.ticketFor(doc);
    } catch (err) {
      // The same Idempotency-Key sent twice at the same moment: return the one that was saved.
      if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const saved = await this.prisma.document.findUniqueOrThrow({
          where: { ownerId_idempotencyKey: { ownerId: user.id, idempotencyKey } },
        });
        return this.ticketFor(saved);
      }
      throw err;
    }
  }

  /**
   * Confirms an upload. The file must be in storage with the declared size and SHA-256; otherwise it is removed and
   * the upload must be started again. Confirming twice is harmless.
   */
  async complete(userId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, ownerId: userId }, include: { documentType: true } });
    if (!doc) throw apiError(404, 'NOT_FOUND', 'Document not found.');
    if (doc.uploadedAt) return toDocumentView(doc);

    const stored = await this.storage.inspect(doc.storageKey);
    if (!stored) throw apiError(409, 'UPLOAD_NOT_FOUND', 'The file has not arrived yet. Please upload it, then try again.');
    if (stored.sizeBytes !== doc.sizeBytes || stored.sha256 !== doc.sha256) {
      await this.storage.delete(doc.storageKey);
      throw apiError(400, 'UPLOAD_MISMATCH', 'The file received is not the one described. Please start the upload again.');
    }
    const saved = await this.prisma.document.update({
      where: { id: doc.id },
      data: { uploadedAt: new Date() },
      include: { documentType: true },
    });
    return toDocumentView(saved);
  }

  /**
   * Document types accepted for each purpose (ADR 0009): identity documents from the country setting; ownership
   * documents from the country's ownership types; for an authority letter, the letter itself and the landlord's
   * identity document (Specification 3.5).
   */
  private async acceptedTypes(purpose: string, countryCode: string, idDocumentTypes: string[]): Promise<string[]> {
    if (purpose === 'IDENTITY') return idDocumentTypes;
    const purposes = purpose === 'AUTHORITY_LETTER' ? ['AUTHORITY_LETTER', 'IDENTITY'] : ['OWNERSHIP'];
    const types = await this.prisma.documentType.findMany({
      where: { countryCode, enabled: true, purpose: { in: purposes as ('AUTHORITY_LETTER' | 'IDENTITY' | 'OWNERSHIP')[] } },
      orderBy: { code: 'asc' },
    });
    return types.map((t) => t.code);
  }

  /**
   * The building a document is for. Ownership documents come from the landlord who owns the building on the platform;
   * authority letters from an agent. Anyone else is told the building is not found.
   */
  private async buildingFor(user: RequestUser, purpose: string, buildingId: string) {
    const building = await this.prisma.building.findUnique({ where: { id: buildingId }, select: { id: true, countryCode: true, ownerId: true } });
    const allowed =
      !!building &&
      (purpose === 'OWNERSHIP' ? building.ownerId === user.id : purpose === 'AUTHORITY_LETTER' && user.types.includes('AGENT'));
    if (!building || !allowed) throw apiError(404, 'NOT_FOUND', 'Building not found.');
    return building;
  }

  private async ticketFor(doc: Document) {
    if (doc.uploadedAt) {
      throw apiError(409, 'DOCUMENT_ALREADY_UPLOADED', 'This document has already been uploaded.', { documentId: doc.id });
    }
    const expiresAt = new Date(Date.now() + UPLOAD_LINK_MINUTES * 60_000);
    const link = await this.storage.createUploadLink(
      doc.storageKey,
      { contentType: doc.contentType, sizeBytes: doc.sizeBytes, sha256: doc.sha256 },
      expiresAt,
    );
    return { documentId: doc.id, uploadUrl: link.url, uploadHeaders: link.headers, expiresAt };
  }
}
