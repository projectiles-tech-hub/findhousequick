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
    // Ownership and authority documents need buildings, which arrive in a later step.
    if (dto.purpose !== 'IDENTITY') {
      throw apiError(400, 'PURPOSE_NOT_AVAILABLE', 'Only identity documents can be uploaded at the moment.');
    }
    if (idempotencyKey) {
      const earlier = await this.prisma.document.findUnique({
        where: { ownerId_idempotencyKey: { ownerId: user.id, idempotencyKey } },
      });
      if (earlier) return this.ticketFor(earlier);
    }

    const settings = await this.controls.getCountrySettings(user.countryCode);
    const type = await this.prisma.documentType.findUnique({
      where: { countryCode_code: { countryCode: user.countryCode, code: dto.documentTypeCode } },
    });
    if (!type || !type.enabled || type.purpose !== dto.purpose || !settings.verification.idDocumentTypes.includes(type.code)) {
      throw apiError(400, 'DOCUMENT_TYPE_NOT_ACCEPTED', 'This type of document is not accepted here.', {
        acceptedDocumentTypes: settings.verification.idDocumentTypes,
      });
    }

    try {
      const doc = await this.prisma.document.create({
        data: {
          ownerId: user.id,
          documentTypeId: type.id,
          purpose: dto.purpose,
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
