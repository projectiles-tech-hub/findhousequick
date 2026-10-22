import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { contextFromRequest, type RequestUser } from '../controls/request-context.js';
import { AccountsService } from './accounts.service.js';
import { CurrentUser } from './auth.js';
import { UpdateMeDto } from './dto.js';

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
  @ApiResponse({ status: 409, description: 'Email already used by another account' })
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateMeDto, @Req() req: Request) {
    return this.accounts.updateMe(user.id, dto, contextFromRequest(req));
  }
}
