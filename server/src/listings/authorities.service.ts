import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import type { RequestUser } from '../controls/request-context.js';
import type { PropertyAuthority } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthorityDecisionDto, RequestAuthorityDto } from './dto.js';

type AuthorityWithAgent = PropertyAuthority & { agent: { firstName: string; lastName: string } };

export function toAuthorityView(a: AuthorityWithAgent) {
  return {
    id: a.id,
    buildingId: a.buildingId,
    agentId: a.agentId,
    agentName: `${a.agent.firstName} ${a.agent.lastName}`.trim(),
    method: a.method,
    status: a.status,
    validUntil: a.validUntil,
    decidedAt: a.decidedAt,
    createdAt: a.createdAt,
  };
}

/** Approved authority that has not run out. */
export const ACTIVE_AUTHORITY = () => ({ status: 'APPROVED' as const, OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] });

/**
 * An agent's authority over a building (Specification 3.5; ADR 0009). The landlord approves in the app when he is on
 * the platform; otherwise the agent sends a signed letter with the landlord's identity document, and the team calls
 * the landlord before approving.
 */
@Injectable()
export class AuthoritiesService {
  constructor(private readonly prisma: PrismaService) {}

  async request(user: RequestUser, buildingId: string, dto: RequestAuthorityDto) {
    if (!user.types.includes('AGENT')) throw apiError(403, 'NOT_AN_AGENT', 'Only agents can ask for authority over a property.');
    const building = await this.prisma.building.findUnique({ where: { id: buildingId }, select: { id: true, ownerId: true, countryCode: true, createdById: true } });
    if (!building) throw new NotFoundException('Building not found.');
    if (building.ownerId === user.id) throw apiError(400, 'OWN_BUILDING', 'This is your own building; you do not need authority for it.');
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (validUntil && validUntil.getTime() <= Date.now()) throw apiError(400, 'BAD_REQUEST', 'validUntil must be in the future.');

    const open = await this.prisma.propertyAuthority.findFirst({
      where: { buildingId, agentId: user.id, OR: [{ status: 'REQUESTED' }, ACTIVE_AUTHORITY()] },
    });
    if (open) throw apiError(409, 'AUTHORITY_EXISTS', 'You already have a request or approved authority for this building.', { authorityId: open.id });

    if (building.ownerId) {
      // The landlord is on the platform: he approves in the app.
      if (dto.method !== 'IN_APP_APPROVAL') {
        throw apiError(400, 'WRONG_METHOD', 'The landlord is on FindHouseQuick, so he approves your request in the app.');
      }
      const created = await this.prisma.propertyAuthority.create({
        data: { buildingId, agentId: user.id, landlordId: building.ownerId, method: 'IN_APP_APPROVAL', validUntil },
        include: { agent: true },
      });
      return toAuthorityView(created);
    }

    // The landlord is not on the platform: a signed letter and his identity document, checked by the team.
    if (dto.method !== 'LETTER') {
      throw apiError(400, 'WRONG_METHOD', 'The landlord is not on FindHouseQuick. Upload his signed letter of authority and his identity document.');
    }
    if (!dto.letterDocumentId || !dto.landlordIdDocumentId) {
      throw apiError(400, 'DOCUMENTS_REQUIRED', "The signed letter of authority and the landlord's identity document are both needed.");
    }
    const docs = await this.prisma.document.findMany({
      where: { id: { in: [dto.letterDocumentId, dto.landlordIdDocumentId] }, ownerId: user.id, buildingId, purpose: 'AUTHORITY_LETTER', uploadedAt: { not: null } },
      include: { documentType: true },
    });
    const letter = docs.find((d) => d.id === dto.letterDocumentId && d.documentType?.purpose === 'AUTHORITY_LETTER');
    const landlordId = docs.find((d) => d.id === dto.landlordIdDocumentId && d.documentType?.purpose === 'IDENTITY');
    if (!letter || !landlordId) {
      throw apiError(400, 'DOCUMENTS_REQUIRED', 'Upload the letter of authority and the landlord\'s identity document for this building first.');
    }
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.propertyAuthority.create({
        data: { buildingId, agentId: user.id, method: 'LETTER', letterDocumentId: letter.id, validUntil },
        include: { agent: true },
      });
      await tx.reviewTask.create({
        data: {
          type: 'AUTHORITY_CONFIRMATION',
          countryCode: building.countryCode,
          entityType: 'PropertyAuthority',
          entityId: created.id,
          notes: `Call the landlord to confirm before approving. Letter document ${letter.id}; landlord's identity document ${landlordId.id}.`,
        },
      });
      return toAuthorityView(created);
    });
  }

  /** The landlord approves, rejects or withdraws an agent's authority over his building. */
  async decide(user: RequestUser, authorityId: string, dto: AuthorityDecisionDto) {
    const authority = await this.prisma.propertyAuthority.findUnique({ where: { id: authorityId }, include: { building: { select: { ownerId: true } } } });
    if (!authority || authority.building.ownerId !== user.id) throw new NotFoundException('Authority not found.');
    const now = new Date();
    let data: Partial<PropertyAuthority>;
    if (dto.decision === 'REVOKE') {
      if (authority.status !== 'APPROVED') throw apiError(409, 'NOT_APPROVED', 'Only approved authority can be withdrawn.');
      data = { status: 'REVOKED', decidedAt: now };
    } else {
      if (authority.status !== 'REQUESTED') throw apiError(409, 'ALREADY_DECIDED', 'This request has already been decided.');
      const validUntil = dto.validUntil ? new Date(dto.validUntil) : authority.validUntil;
      if (dto.decision === 'APPROVE' && validUntil && validUntil.getTime() <= now.getTime()) {
        throw apiError(400, 'BAD_REQUEST', 'validUntil must be in the future.');
      }
      data = dto.decision === 'APPROVE' ? { status: 'APPROVED', decidedAt: now, validUntil, landlordId: user.id } : { status: 'REJECTED', decidedAt: now };
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.propertyAuthority.update({ where: { id: authority.id }, data, include: { agent: true } });
      await tx.auditLog.create({
        data: { actorId: user.id, action: `authority.${dto.decision.toLowerCase()}`, entityType: 'PropertyAuthority', entityId: authority.id, metadata: { buildingId: authority.buildingId, agentId: authority.agentId } },
      });
      return saved;
    });
    return toAuthorityView(updated);
  }

  /** Authorities on a building: all of them for those who manage it, or the agent's own requests. */
  async list(user: RequestUser, buildingId: string, mayManage: boolean) {
    const rows = await this.prisma.propertyAuthority.findMany({
      where: { buildingId, ...(mayManage ? {} : { agentId: user.id }) },
      include: { agent: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!mayManage && rows.length === 0) throw new NotFoundException('Building not found.');
    return rows.map(toAuthorityView);
  }
}
