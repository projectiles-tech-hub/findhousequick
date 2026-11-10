import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../accounts/auth.js';
import { RequireLevel } from '../accounts/verification.guard.js';
import type { RequestUser } from '../controls/request-context.js';
import { RequireFeature } from '../controls/require-feature.guard.js';
import { BookInspectionDto, FollowUpDto, InspectionsQuery, InspectionStatusDto, SafetyShareDto, SlotsQuery } from './dto.js';
import { InspectionsService } from './inspections.service.js';

@ApiTags('Inspections')
@ApiBearerAuth()
@Controller()
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Put('listings/:listingId/inspection-availability')
  @RequireFeature('contact.inspection_booking')
  @RequireLevel(2)
  @ApiOperation({ summary: 'Set the times the lister is available for inspections (decision 45)', description: 'Those who manage the listing only. Weekly windows in the country\'s time zone, with the slot length; dates can be blocked.' })
  @ApiOkResponse({ description: 'Saved' })
  @ApiResponse({ status: 400, description: 'INVALID_AVAILABILITY' })
  setAvailability(@CurrentUser() user: RequestUser, @Param('listingId', ParseUUIDPipe) listingId: string, @Body() body: unknown) {
    return this.inspections.setAvailability(user, listingId, body);
  }

  @Get('listings/:listingId/inspection-availability')
  @ApiOperation({ summary: 'The times set for inspections of a listing (those who manage it only)' })
  getAvailability(@CurrentUser() user: RequestUser, @Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.inspections.getAvailability(user, listingId);
  }

  @Get('listings/:listingId/inspection-slots')
  @ApiOperation({ summary: 'Free inspection time slots for a live listing (decision 45)' })
  @ApiOkResponse({ description: 'Free slots as UTC start and end times' })
  slots(@Param('listingId', ParseUUIDPipe) listingId: string, @Query() q: SlotsQuery) {
    return this.inspections.slots(listingId, q.from, q.to);
  }

  @Post('listings/:listingId/inspections')
  @RequireFeature('contact.inspection_booking')
  @RequireLevel(2)
  @ApiOperation({ summary: 'Book an inspection (always free)', description: 'The time must be one of the free slots.' })
  @ApiCreatedResponse({ description: 'Requested' })
  @ApiResponse({ status: 409, description: 'SLOT_NOT_FREE or ALREADY_BOOKED' })
  book(@CurrentUser() user: RequestUser, @Param('listingId', ParseUUIDPipe) listingId: string, @Body() dto: BookInspectionDto) {
    return this.inspections.book(user, listingId, dto.scheduledAt, dto.note);
  }

  @Get('me/inspections')
  @ApiOperation({ summary: 'Inspections the user booked or hosts, newest first' })
  mine(@CurrentUser() user: RequestUser, @Query() q: InspectionsQuery) {
    return this.inspections.mine(user, q.cursor);
  }

  @Post('inspections/:inspectionId/status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm, reschedule, cancel, complete or mark no-show',
    description: 'The side that did not propose the time confirms it. Rescheduling proposes another free slot for the other side to confirm. Confirming releases the exact location and directions to the tenant.',
  })
  @ApiOkResponse({ description: 'Updated' })
  @ApiResponse({ status: 409, description: 'WRONG_STATUS, NOT_YOURS_TO_CONFIRM, SLOT_NOT_FREE, TIME_PASSED or TOO_EARLY' })
  status(@CurrentUser() user: RequestUser, @Param('inspectionId', ParseUUIDPipe) id: string, @Body() dto: InspectionStatusDto) {
    return this.inspections.changeStatus(user, id, dto.action, dto.scheduledAt, dto.reason);
  }

  @Post('inspections/:inspectionId/safety-share')
  @HttpCode(202)
  @RequireFeature('contact.inspection_safety_share')
  @ApiOperation({ summary: 'Send inspection details to a trusted contact by SMS (tenant, once confirmed)' })
  @ApiResponse({ status: 202, description: 'Details sent' })
  @ApiResponse({ status: 429, description: 'TOO_MANY_SHARES' })
  async safetyShare(@CurrentUser() user: RequestUser, @Param('inspectionId', ParseUUIDPipe) id: string, @Body() dto: SafetyShareDto) {
    await this.inspections.safetyShare(user, id, dto.contactName, dto.contactPhone);
  }

  @Post('inspections/:inspectionId/follow-up')
  @HttpCode(200)
  @ApiOperation({ summary: 'Answer the follow-up questions after a completed inspection' })
  @ApiOkResponse({ description: 'Recorded' })
  followUp(@CurrentUser() user: RequestUser, @Param('inspectionId', ParseUUIDPipe) id: string, @Body() dto: FollowUpDto) {
    return this.inspections.followUp(user, id, dto);
  }
}
