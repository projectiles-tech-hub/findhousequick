import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../common/api-error.js';
import type { RequestUser } from '../controls/request-context.js';
import type { ReportReason } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** One user may send this many reports in 24 hours. */
const MAX_REPORTS_PER_DAY = 10;

/**
 * "Report this listing" (Specification 7.3). Each report goes to the verification team's queue as a REPORT task; what
 * the team may do about it is in the review service (decision 51).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(user: RequestUser, listingId: string, reason: ReportReason, details?: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { status: true, createdById: true, unit: { select: { building: { select: { countryCode: true } } } } },
    });
    // Listings that were once public can still be reported, for example after a bad inspection.
    if (!listing || ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'REJECTED'].includes(listing.status)) throw new NotFoundException('Listing not found.');
    if (listing.createdById === user.id) throw apiError(400, 'OWN_LISTING', 'You cannot report your own listing.');
    if (await this.prisma.listingReport.count({ where: { listingId, reporterId: user.id, status: { in: ['OPEN', 'ASSIGNED'] } } })) {
      throw apiError(409, 'ALREADY_REPORTED', 'You have already reported this listing. The team is looking at it.');
    }
    const today = await this.prisma.listingReport.count({ where: { reporterId: user.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (today >= MAX_REPORTS_PER_DAY) throw apiError(429, 'TOO_MANY_REPORTS', 'You have sent many reports today. Please try again tomorrow.');
    return this.create(user.id, listingId, listing.unit.building.countryCode, reason, details?.trim() || null);
  }

  /** A tenant answered, after an inspection, that the property did not match the listing (Specification 6.4). */
  async fromInspection(tenantId: string, listingId: string, countryCode: string, inspectionId: string) {
    return this.create(tenantId, listingId, countryCode, 'DOES_NOT_MATCH', `Answered after inspection ${inspectionId}: the property did not match the listing.`);
  }

  private async create(reporterId: string, listingId: string, countryCode: string, reason: ReportReason, details: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.listingReport.create({ data: { listingId, reporterId, reason, details } });
      await tx.reviewTask.create({ data: { type: 'REPORT', countryCode, entityType: 'ListingReport', entityId: report.id, notes: `${reason}${details ? `: ${details}` : ''}`.slice(0, 1000) } });
      await tx.auditLog.create({ data: { actorId: reporterId, action: 'listing.reported', entityType: 'Listing', entityId: listingId, metadata: { reportId: report.id, reason } } });
      return { id: report.id, status: report.status };
    });
  }
}
