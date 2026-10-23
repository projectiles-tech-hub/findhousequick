import { Body, Controller, Get, HttpCode, Patch, Post, Req } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { contextFromRequest, type RequestUser } from '../controls/request-context.js';
import { AccountsService } from './accounts.service.js';
import { CurrentUser } from './auth.js';
import { ContactCodeDto, ContactConfirmDto, UpdateMeDto } from './dto.js';

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'The signed-in user, with verification level and what it unlocks' })
  @ApiOkResponse({ description: 'Current user' })
  me(@CurrentUser() user: RequestUser) {
    return this.accounts.me(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update profile details' })
  @ApiOkResponse({ description: 'Updated user' })
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateMeDto, @Req() req: Request) {
    return this.accounts.updateMe(user.id, dto, contextFromRequest(req));
  }

  @Post('contacts/code')
  @HttpCode(202)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send a code to confirm a phone number or email address (ADR 0006)',
    description:
      'The one already on the account, or a new one to replace it. Sent only if no other account has confirmed it; ' +
      'the answer is the same either way.',
  })
  @ApiAcceptedResponse({ description: 'Code sent if the contact is free to confirm' })
  @ApiResponse({ status: 409, description: 'Already confirmed on this account (ALREADY_CONFIRMED)' })
  async sendContactCode(@CurrentUser() user: RequestUser, @Body() dto: ContactCodeDto): Promise<void> {
    await this.accounts.sendContactCode(user.id, dto);
  }

  @Post('contacts/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Confirm a phone number or email address with its code',
    description:
      'Puts a new contact on the account once confirmed. Replacing a confirmed contact needs the current password, ' +
      'and the old contact is told. Reaching level 1 needs both phone and email confirmed (decision 37).',
  })
  @ApiOkResponse({ description: 'Updated user' })
  @ApiResponse({ status: 400, description: 'Wrong code (INVALID_CODE) or password missing (PASSWORD_REQUIRED)' })
  @ApiResponse({ status: 401, description: 'Wrong password (WRONG_PASSWORD)' })
  @ApiResponse({ status: 409, description: 'Confirmed by another account (PHONE_TAKEN, EMAIL_TAKEN) or already confirmed' })
  confirmContact(@CurrentUser() user: RequestUser, @Body() dto: ContactConfirmDto) {
    return this.accounts.confirmContact(user.id, dto);
  }
}
