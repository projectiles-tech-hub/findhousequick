import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../accounts/auth.js';
import { RequireLevel } from '../accounts/verification.guard.js';
import type { RequestUser } from '../controls/request-context.js';
import { RequireFeature } from '../controls/require-feature.guard.js';
import { ReportsService } from './reports.service.js';

const REASONS = ['FAKE_LISTING', 'ALREADY_TAKEN', 'INSPECTION_FEE_DEMANDED', 'EXTRA_FEES_DEMANDED', 'DOES_NOT_MATCH', 'OTHER'] as const;

export class ReportListingDto {
  @ApiProperty({ enum: REASONS })
  @IsIn(REASONS)
  reason!: (typeof REASONS)[number];

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('listings/:listingId/reports')
  @RequireFeature('trust.report_button')
  @RequireLevel(1)
  @ApiOperation({ summary: 'Report a listing (fake, already taken, inspection fee demanded, extra fees, does not match)' })
  @ApiCreatedResponse({ description: 'Report received and queued for review' })
  @ApiResponse({ status: 409, description: 'ALREADY_REPORTED' })
  @ApiResponse({ status: 429, description: 'TOO_MANY_REPORTS' })
  report(@CurrentUser() user: RequestUser, @Param('listingId', ParseUUIDPipe) listingId: string, @Body() dto: ReportListingDto) {
    return this.reports.report(user, listingId, dto.reason, dto.details);
  }
}
