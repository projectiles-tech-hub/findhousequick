import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../accounts/auth.js';
import type { StaffRole } from '../generated/prisma/client.js';
import { StaffOnly } from '../staff/staff.guard.js';
import { ControlsService } from './controls.service.js';
import type { RequestUser } from './request-context.js';

export class ChangePlatformSettingsDto {
  @ApiProperty({
    example: { staffTwoStepMinutes: 180 },
    description: 'Only the settings to change. staffTwoStepMinutes: how long the staff second step lasts (15 to 1440).',
  })
  @IsObject()
  settings!: Record<string, unknown>;

  @ApiProperty({ description: 'Why the change is being made; recorded with it.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/** Platform-wide settings (decision 32). Super admins only, on a device that has passed two-step login. */
@ApiTags('Admin')
@Controller('admin/platform-settings')
@StaffOnly('SUPER_ADMIN')
export class PlatformSettingsController {
  constructor(private readonly controls: ControlsService) {}

  @Get()
  @ApiOperation({ summary: 'Current platform-wide settings' })
  @ApiOkResponse({ description: 'Settings, e.g. { "staffTwoStepMinutes": 180 }' })
  get() {
    return this.controls.getPlatformSettings();
  }

  @Patch()
  @ApiOperation({
    summary: 'Change platform-wide settings (recorded)',
    description: 'Applies at once on this server and within 30 seconds on every other server.',
  })
  @ApiOkResponse({ description: 'The settings after the change' })
  @ApiResponse({ status: 400, description: 'A value outside its allowed range or an unknown setting (INVALID_SETTINGS)' })
  change(@CurrentUser() user: RequestUser, @Body() dto: ChangePlatformSettingsDto) {
    return this.controls.updatePlatformSettings(dto.settings, dto.reason, {
      userId: user.id,
      roles: user.staff!.roles as StaffRole[],
      countryScopes: user.staff!.countryScopes,
    });
  }
}
