import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../accounts/auth.js';
import type { RequestUser } from '../controls/request-context.js';
import { DataExportService } from './data-export.service.js';

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('me/data-export')
export class PrivacyController {
  constructor(private readonly exports: DataExportService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Request a copy of all personal data held about the user',
    description:
      'The copy is made in the background; the user is told by push and email when it is ready, and can download it ' +
      "for the country's dataExportLinkDays. One at a time, and no more often than dataExportEveryHours.",
  })
  @ApiAcceptedResponse({ description: 'The copy being prepared' })
  @ApiResponse({ status: 409, description: 'A copy is already being prepared (EXPORT_IN_PROGRESS)' })
  @ApiResponse({ status: 429, description: 'Asked too recently (EXPORT_TOO_SOON), with nextAllowedAt' })
  request(@CurrentUser() user: RequestUser) {
    return this.exports.request(user.id);
  }

  @Get()
  @ApiOperation({ summary: "The user's copies, newest first, with a download link (15 minutes) for one that is ready" })
  @ApiOkResponse({ description: '{ items }' })
  list(@CurrentUser() user: RequestUser) {
    return this.exports.list(user.id);
  }
}
