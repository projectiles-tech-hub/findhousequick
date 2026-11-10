import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../accounts/auth.js';
import { RequireLevel } from '../accounts/verification.guard.js';
import { contextFromRequest, type RequestUser } from '../controls/request-context.js';
import { RequireFeature } from '../controls/require-feature.guard.js';
import { PropertiesService } from '../properties/properties.service.js';
import { SearchService } from '../search/search.service.js';
import { ViewLimitsService } from '../search/view-limits.service.js';
import { AuthoritiesService } from './authorities.service.js';
import { AuthorityDecisionDto, CreateListingDto, ListingFieldsDto, ListingStatusDto, MyListingsQuery, RequestAuthorityDto } from './dto.js';
import { ListingsService } from './listings.service.js';

@ApiTags('Listings')
@ApiBearerAuth()
@Controller()
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly authorities: AuthoritiesService,
    private readonly properties: PropertiesService,
    private readonly search: SearchService,
    private readonly viewLimits: ViewLimitsService,
  ) {}

  @Post('listings')
  @RequireFeature('platform.new_listings')
  @RequireLevel(2)
  @ApiOperation({
    summary: 'Create a draft listing for a unit',
    description: 'Only one open listing per unit. The rent and every fee must be entered (0 when there is none), in the country\'s currency.',
  })
  @ApiCreatedResponse({ description: 'The draft, as the lister sees it' })
  @ApiResponse({ status: 400, description: 'WRONG_KIND, WRONG_CURRENCY, SHORT_LETS_NOT_ALLOWED, INVALID_DETAILS or a missing field' })
  @ApiResponse({ status: 409, description: 'LISTING_EXISTS: the unit already has an open listing' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateListingDto) {
    return this.listings.create(user, dto);
  }

  @Get('me/listings')
  @ApiOperation({ summary: 'Listings the user created or may manage, newest first' })
  @ApiOkResponse({ description: 'A page of listings with nextCursor' })
  mine(@CurrentUser() user: RequestUser, @Query() q: MyListingsQuery) {
    return this.listings.mine(user, q);
  }

  @Get('listings/:listingId')
  @Public()
  @ApiOperation({
    summary: 'Property page',
    description:
      'Those who manage the listing get its full owner view, whatever its state. Everyone else gets the property page of a ' +
      'live listing: in full, but without the lister for signed-out visitors (decision 75). Opening property pages is ' +
      'limited per hour, per account or, without sign-in, per device and network address (decision 52).',
  })
  @ApiOkResponse({ description: 'Owner view, or the property page' })
  @ApiResponse({ status: 404, description: 'Not found, or not live' })
  @ApiResponse({ status: 429, description: 'VIEW_LIMIT, with retryAfterSeconds' })
  async get(@CurrentUser() user: RequestUser | undefined, @Param('listingId', ParseUUIDPipe) listingId: string, @Req() req: Request) {
    if (user && (await this.listings.mayManage(user, listingId))) return this.listings.get(user, listingId);
    const view = await this.search.publicView(listingId, user, contextFromRequest(req));
    const deviceId = typeof req.headers['x-device-id'] === 'string' ? req.headers['x-device-id'].slice(0, 100) : null;
    await this.viewLimits.countView({ userId: user?.id ?? null, ip: req.ip ?? null, deviceId });
    return view;
  }

  @Patch('listings/:listingId')
  @RequireLevel(2)
  @ApiOperation({ summary: 'Edit a draft, or the text and fees of a live listing (fee changes are recorded)' })
  @ApiOkResponse({ description: 'Updated' })
  @ApiResponse({ status: 409, description: 'LISTING_LOCKED (waiting for review), LISTING_CLOSED or FIELD_LOCKED' })
  update(@CurrentUser() user: RequestUser, @Param('listingId', ParseUUIDPipe) listingId: string, @Body() dto: ListingFieldsDto) {
    return this.listings.update(user, listingId, dto);
  }

  @Post('listings/:listingId/submit')
  @HttpCode(200)
  @RequireFeature('platform.new_listings')
  @RequireLevel(2)
  @ApiOperation({
    summary: 'Submit for review',
    description:
      'Refused with LISTING_INCOMPLETE, listing what is missing, until every required part has its photos, the walkthrough ' +
      'video is ready, and the landlord has an ownership document or the agent has approved authority. The verification team ' +
      'then reviews the listing before it goes live.',
  })
  @ApiOkResponse({ description: 'Submitted (IN_REVIEW)' })
  @ApiResponse({ status: 422, description: 'LISTING_INCOMPLETE with `missing`' })
  submit(@CurrentUser() user: RequestUser, @Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.listings.submit(user, listingId);
  }

  @Post('listings/:listingId/confirm-available')
  @HttpCode(200)
  @RequireLevel(1)
  @ApiOperation({ summary: 'Confirm the home is still available (restarts the expiry clock)' })
  @ApiOkResponse({ description: 'Confirmed' })
  confirm(@CurrentUser() user: RequestUser, @Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.listings.confirmAvailable(user, listingId);
  }

  @Post('listings/:listingId/status')
  @HttpCode(200)
  @RequireLevel(1)
  @ApiOperation({ summary: 'Pause, resume, mark as rented or close a listing' })
  @ApiOkResponse({ description: 'Updated' })
  @ApiResponse({ status: 409, description: 'WRONG_STATUS' })
  status(@CurrentUser() user: RequestUser, @Param('listingId', ParseUUIDPipe) listingId: string, @Body() dto: ListingStatusDto) {
    return this.listings.changeStatus(user, listingId, dto);
  }

  // Agent authority (Specification 3.5)

  @Post('buildings/:buildingId/authorities')
  @RequireLevel(2)
  @ApiTags('Authority')
  @ApiOperation({
    summary: 'Agent asks for authority over a building',
    description:
      'If the landlord is on FindHouseQuick, he approves in the app (IN_APP_APPROVAL). Otherwise send LETTER with the uploaded ' +
      "letter of authority and the landlord's identity document; the team calls the landlord before approving.",
  })
  @ApiCreatedResponse({ description: 'Request made' })
  @ApiResponse({ status: 400, description: 'WRONG_METHOD, DOCUMENTS_REQUIRED or OWN_BUILDING' })
  @ApiResponse({ status: 409, description: 'AUTHORITY_EXISTS' })
  requestAuthority(@CurrentUser() user: RequestUser, @Param('buildingId', ParseUUIDPipe) buildingId: string, @Body() dto: RequestAuthorityDto) {
    return this.authorities.request(user, buildingId, dto);
  }

  @Get('buildings/:buildingId/authorities')
  @ApiTags('Authority')
  @ApiOperation({ summary: "Authorities on a building: all of them for those who manage it, or the agent's own requests" })
  @ApiOkResponse({ description: 'Authorities' })
  async listAuthorities(@CurrentUser() user: RequestUser, @Param('buildingId', ParseUUIDPipe) buildingId: string) {
    const mayManage = await this.properties.assertMayManage(user, buildingId).then(
      () => true,
      () => false,
    );
    return this.authorities.list(user, buildingId, mayManage);
  }

  @Post('authorities/:authorityId/decision')
  @HttpCode(200)
  @RequireLevel(2)
  @ApiTags('Authority')
  @ApiOperation({ summary: "Landlord approves, rejects or withdraws an agent's authority (withdrawing takes effect at once)" })
  @ApiOkResponse({ description: 'Updated authority' })
  @ApiResponse({ status: 409, description: 'ALREADY_DECIDED or NOT_APPROVED' })
  decideAuthority(@CurrentUser() user: RequestUser, @Param('authorityId', ParseUUIDPipe) authorityId: string, @Body() dto: AuthorityDecisionDto) {
    return this.authorities.decide(user, authorityId, dto);
  }
}
