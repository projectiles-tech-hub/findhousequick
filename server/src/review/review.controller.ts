import { Body, Controller, Get, HttpCode, Ip, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../accounts/auth.js';
import type { RequestUser } from '../controls/request-context.js';
import { StaffOnly } from '../staff/staff.guard.js';
import { ListReviewTasksQuery, ReviewDecisionDto, ViewDocumentDto } from './dto.js';
import { ReviewService } from './review.service.js';

/** The verification team's queue (ADR 0007). Verifiers, country managers and super admins, in their own countries. */
@ApiTags('Admin')
@Controller('admin')
@StaffOnly('VERIFIER', 'COUNTRY_MANAGER', 'SUPER_ADMIN')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get('review-tasks')
  @ApiOperation({ summary: "Verification work queue, oldest first, limited to the staff member's countries" })
  @ApiOkResponse({ description: 'Tasks, with what is needed to decide each one' })
  list(@CurrentUser() user: RequestUser, @Query() q: ListReviewTasksQuery) {
    return this.review.list(user.staff!, q);
  }

  @Post('review-tasks/:taskId/decision')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Record the outcome of a review',
    description:
      'Identity reviews and duplicate IDs: APPROVE passes the identity check (level 2), REJECT fails it. Agent company ' +
      'details: APPROVE or REJECT. Other kinds of task are decided here once their parts are built.',
  })
  @ApiOkResponse({ description: 'Recorded' })
  @ApiResponse({ status: 403, description: 'OWN_CASE: staff cannot decide their own case' })
  @ApiResponse({ status: 409, description: 'TASK_CLOSED, CHECK_NOT_UNDER_REVIEW or ID_HELD_BY_ANOTHER_ACCOUNT' })
  decide(@CurrentUser() user: RequestUser, @Param('taskId', ParseUUIDPipe) taskId: string, @Body() dto: ReviewDecisionDto) {
    return this.review.decide(user, taskId, dto);
  }

  @Post('documents/:documentId/view')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get a short-lived link to view a private document (recorded in the audit log with the reason)' })
  @ApiOkResponse({ description: 'Link valid for 5 minutes' })
  @ApiResponse({ status: 410, description: 'DOCUMENT_GONE: not uploaded, or deleted after its retention period' })
  viewDocument(
    @CurrentUser() user: RequestUser,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: ViewDocumentDto,
    @Ip() ip: string,
  ) {
    return this.review.viewDocument(user, documentId, dto.reason, ip);
  }
}
