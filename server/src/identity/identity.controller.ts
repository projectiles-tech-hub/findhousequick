import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, Public } from '../accounts/auth.js';
import { RequireLevel } from '../accounts/verification.guard.js';
import type { RequestUser } from '../controls/request-context.js';
import { RequireFeature } from '../controls/require-feature.guard.js';
import { AgentProfileDto, StartIdentityCheckDto } from './dto.js';
import { IdentityService } from './identity.service.js';

@ApiTags('Identity')
@ApiBearerAuth()
@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('identity/checks')
  @RequireFeature('verification.identity_check')
  @RequireLevel(1)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Start an identity check (NIN or national equivalent, selfie, liveness)',
    description:
      "Returns the values for the identity provider's camera flow in the app. The ID number is encrypted on arrival; " +
      'only the last four characters are ever shown again. A PASSED result moves the user to level 2.',
  })
  @ApiCreatedResponse({ description: 'Check started' })
  @ApiResponse({ status: 400, description: 'ID type not accepted (ID_TYPE_NOT_ACCEPTED) or number in the wrong format (INVALID_ID_NUMBER)' })
  @ApiResponse({ status: 403, description: 'Not available (IDENTITY_CHECK_UNAVAILABLE, FEATURE_UNAVAILABLE) or level 1 needed (VERIFICATION_REQUIRED)' })
  @ApiResponse({ status: 409, description: 'ALREADY_VERIFIED, CHECK_UNDER_REVIEW, or ID_ALREADY_LINKED (sent for review)' })
  @ApiResponse({ status: 429, description: "Too many checks today (TOO_MANY_CHECKS)" })
  @ApiResponse({ status: 503, description: 'The identity provider cannot be reached (IDENTITY_PROVIDER_UNAVAILABLE)' })
  start(@CurrentUser() user: RequestUser, @Body() dto: StartIdentityCheckDto) {
    return this.identity.start(user, dto);
  }

  @Get('identity/checks')
  @ApiOperation({ summary: "The user's identity checks, newest first" })
  @ApiOkResponse({ description: 'Checks' })
  list(@CurrentUser() user: RequestUser) {
    return this.identity.list(user.id);
  }

  @Get('identity/checks/:checkId')
  @ApiOperation({ summary: 'Status of one identity check' })
  @ApiOkResponse({ description: 'Check' })
  get(@CurrentUser() user: RequestUser, @Param('checkId', ParseUUIDPipe) checkId: string) {
    return this.identity.get(user.id, checkId);
  }

  @Post('identity/provider-results/:provider')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Results address for identity providers (called by the provider, not the apps)',
    description:
      'Each provider signs its results; the adapter checks the signature before anything is recorded (ADR 0007). ' +
      'Results for checks that are no longer pending are ignored.',
  })
  @ApiOkResponse({ description: 'Received; `recorded` is false if the check was already decided' })
  @ApiResponse({ status: 401, description: 'The result could not be verified (UNTRUSTED_RESULT)' })
  receiveResult(@Param('provider') provider: string, @Req() req: Request, @Body() body: unknown) {
    return this.identity.receiveResult(provider, { headers: req.headers, body });
  }

  @Put('me/agent-profile')
  @RequireLevel(2)
  @ApiOperation({
    summary: 'Agent company details (decision 50)',
    description: 'Business name and registration number, for agents who work through a firm. Checked by the verification team.',
  })
  @ApiOkResponse({ description: 'Saved; status PENDING until checked' })
  @ApiResponse({ status: 403, description: 'Not an agent (NOT_AN_AGENT) or level 2 needed (VERIFICATION_REQUIRED)' })
  saveAgentProfile(@CurrentUser() user: RequestUser, @Body() dto: AgentProfileDto) {
    return this.identity.saveAgentProfile(user, dto);
  }

  @Get('me/agent-profile')
  @ApiOperation({ summary: "The agent's saved company details" })
  @ApiOkResponse({ description: 'Company details and their check status' })
  @ApiResponse({ status: 404, description: 'None saved yet' })
  getAgentProfile(@CurrentUser() user: RequestUser) {
    return this.identity.getAgentProfile(user.id);
  }
}
