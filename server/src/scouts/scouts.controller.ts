import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../accounts/auth.js';
import { RequireLevel } from '../accounts/verification.guard.js';
import type { RequestUser } from '../controls/request-context.js';
import { RequireFeature } from '../controls/require-feature.guard.js';
import { StaffOnly } from '../staff/staff.guard.js';
import { LinkBuildingDto, ScoutCursorQuery, ScoutReferralsQuery, ScoutReportDto, ScoutStatusDto, StaffReasonDto } from './dto.js';
import { ScoutsService } from './scouts.service.js';

/** Scouts (decisions 70 to 72). Every route is refused while the switch growth.scouts is off. */
@ApiTags('Scouts')
@ApiBearerAuth()
@Controller()
@RequireFeature('growth.scouts')
export class ScoutsController {
  constructor(private readonly scouts: ScoutsService) {}

  @Post('me/scout')
  @HttpCode(200)
  @RequireLevel(1)
  @ApiOperation({ summary: 'Join as a scout', description: 'Any user at level 1 can join. Being a scout gives no rights over any property.' })
  @ApiOkResponse({ description: 'The scout profile' })
  optIn(@CurrentUser() user: RequestUser) {
    return this.scouts.optIn(user);
  }

  @Get('me/scout')
  @ApiOperation({ summary: "The user's scout profile" })
  @ApiResponse({ status: 404, description: 'NOT_A_SCOUT' })
  profile(@CurrentUser() user: RequestUser) {
    return this.scouts.profile(user);
  }

  @Post('scout/reports')
  @RequireLevel(1)
  @ApiOperation({
    summary: 'Report a vacant property',
    description: 'Checked at once against buildings already on the platform; a match is marked alreadyOnPlatform and can earn no reward.',
  })
  @ApiCreatedResponse({ description: 'The report' })
  @ApiResponse({ status: 403, description: 'NOT_A_SCOUT or SCOUT_SUSPENDED' })
  @ApiResponse({ status: 429, description: 'TOO_MANY_REPORTS' })
  report(@CurrentUser() user: RequestUser, @Body() dto: ScoutReportDto) {
    return this.scouts.report(user, dto);
  }

  @Get('scout/reports')
  @ApiOperation({ summary: "The scout's reports, newest first, each with its stage" })
  myReports(@CurrentUser() user: RequestUser, @Query() q: ScoutCursorQuery) {
    return this.scouts.myReports(user, q.cursor);
  }

  @Post('scout/reports/:reportId/invitations')
  @RequireLevel(1)
  @ApiOperation({
    summary: 'Make the invitation for the landlord of a reported property',
    description:
      'Returns a single-use code and a link to share, or to show as a QR code. Only a hash of the code is stored, so it is shown only now; asking again before it is used replaces it. Invitations do not expire (decision 71).',
  })
  @ApiCreatedResponse({ description: 'The code and the link' })
  @ApiResponse({ status: 409, description: 'ALREADY_ON_PLATFORM or INVITATION_USED' })
  invite(@CurrentUser() user: RequestUser, @Param('reportId', ParseUUIDPipe) reportId: string) {
    return this.scouts.invite(user, reportId);
  }

  @Get('invitations/:code')
  @Public()
  @ApiOperation({ summary: 'Who invited you (public; nothing private)', description: "Shown on the landlord's invitation page before he registers." })
  @ApiOkResponse({ description: 'valid, and the first name of the scout' })
  @ApiResponse({ status: 404, description: 'INVALID_INVITATION' })
  invitation(@Param('code') code: string) {
    return this.scouts.invitationInfo(code.slice(0, 40));
  }

  @Get('me/scout-invitation')
  @ApiOperation({ summary: 'The invitation the user registered with, and whether a building is linked to it yet' })
  myInvitation(@CurrentUser() user: RequestUser) {
    return this.scouts.myInvitation(user);
  }

  @Post('me/scout-invitation/link')
  @HttpCode(200)
  @RequireLevel(2)
  @ApiOperation({
    summary: 'The invited landlord confirms that his building is the property the scout reported',
    description: 'The building must be his own and near the reported pin. Each of its units then carries one reward for its first rental.',
  })
  @ApiOkResponse({ description: 'The referral' })
  @ApiResponse({ status: 409, description: 'ALREADY_LINKED, NOT_THE_REPORTED_PROPERTY or PROPERTY_ALREADY_REFERRED' })
  link(@CurrentUser() user: RequestUser, @Body() dto: LinkBuildingDto) {
    return this.scouts.linkBuilding(user, dto.buildingId);
  }

  @Get('me/scout/referrals')
  @ApiOperation({ summary: "The scout's referrals and the state of each reward", description: 'Shows the area of each property, never its address or the landlord.' })
  referrals(@CurrentUser() user: RequestUser) {
    return this.scouts.myReferrals(user);
  }

  @Get('admin/scout-referrals')
  @StaffOnly('VERIFIER', 'COUNTRY_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'All scout referrals in the staff member\'s countries' })
  list(@CurrentUser() user: RequestUser, @Query() q: ScoutReferralsQuery) {
    return this.scouts.listReferrals(user, q);
  }

  @Post('admin/scout-referrals/:referralId/void')
  @HttpCode(200)
  @StaffOnly('COUNTRY_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Void the open rewards of a referral, with a reason' })
  @ApiResponse({ status: 403, description: 'OWN_CASE' })
  void(@CurrentUser() user: RequestUser, @Param('referralId', ParseUUIDPipe) id: string, @Body() dto: StaffReasonDto) {
    return this.scouts.voidReferral(user, id, dto.reason);
  }

  @Post('admin/scouts/:userId/status')
  @HttpCode(200)
  @StaffOnly('COUNTRY_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Suspend a scout, or lift the suspension' })
  status(@CurrentUser() user: RequestUser, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: ScoutStatusDto) {
    return this.scouts.setScoutStatus(user, userId, dto.status, dto.reason);
  }
}
