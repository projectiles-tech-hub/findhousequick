import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../accounts/auth.js';
import type { StaffRole } from '../generated/prisma/client.js';
import { StaffOnly } from '../staff/staff.guard.js';
import { ControlsService } from './controls.service.js';
import type { RequestUser } from './request-context.js';

export class ChangeCountryDto {
  @ApiPropertyOptional({ description: 'Switch the country on or off for users.' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: ['en', 'pcm'], description: "Languages offered in the country; must include its default language." })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({
    example: { listings: { confirmAvailabilityDays: 10 } },
    description:
      'Only the settings to change. Groups such as fees or listings are merged key by key; lists and maps are ' +
      'replaced whole. Every value is checked against the country settings rules; unknown settings are refused.',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiProperty({ description: 'Why the change is being made; recorded with it.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/** Country settings (fees, time periods, accepted documents and so on). Super admins only, on a device that has passed two-step login. */
@ApiTags('Admin')
@Controller('admin/countries')
@StaffOnly('SUPER_ADMIN')
export class CountriesAdminController {
  constructor(private readonly controls: ControlsService) {}

  @Patch(':countryCode')
  @ApiOperation({
    summary: "Change a country's settings or switch it on or off (super admin; recorded)",
    description: 'Applies at once on every server. The change is recorded with the values before and after.',
  })
  @ApiOkResponse({ description: 'The country after the change, with all its settings' })
  @ApiResponse({ status: 400, description: 'A value outside its allowed range, an unknown setting or language (INVALID_SETTINGS), or nothing to change' })
  @ApiResponse({ status: 404, description: 'The country is not set up' })
  change(@CurrentUser() user: RequestUser, @Param('countryCode') countryCode: string, @Body() dto: ChangeCountryDto) {
    return this.controls.updateCountry(
      countryCode,
      { enabled: dto.enabled, languages: dto.languages, settings: dto.settings },
      dto.reason,
      { userId: user.id, roles: user.staff!.roles as StaffRole[], countryScopes: user.staff!.countryScopes },
    );
  }
}
