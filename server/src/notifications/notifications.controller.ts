import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../accounts/auth.js';
import type { RequestUser } from '../controls/request-context.js';
import { RegisterDeviceDto } from './dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('me')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('devices')
  @ApiOperation({ summary: 'Register this phone or computer for push notifications (decision 46)' })
  @ApiCreatedResponse({ description: 'Registered' })
  registerDevice(@CurrentUser() user: RequestUser, @Body() dto: RegisterDeviceDto) {
    return this.notifications.registerDevice(user, dto.platform, dto.pushToken, dto.voipPushToken);
  }

  @Delete('devices/:deviceId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Stop push notifications to a device (also done on sign-out)' })
  async removeDevice(@CurrentUser() user: RequestUser, @Param('deviceId', ParseUUIDPipe) deviceId: string) {
    await this.notifications.removeDevice(user, deviceId);
  }

  @Get('notification-settings')
  @ApiOperation({ summary: 'Which notifications the user receives, and by which channel (decision 46)' })
  @ApiOkResponse({ description: 'Settings' })
  settings(@CurrentUser() user: RequestUser) {
    return this.notifications.getSettings(user);
  }

  @Patch('notification-settings')
  @ApiOperation({ summary: 'Change notification settings', description: 'Security messages cannot be switched off. Incoming calls use push only.' })
  @ApiOkResponse({ description: 'Updated settings' })
  @ApiResponse({ status: 400, description: 'INVALID_SETTINGS' })
  changeSettings(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.notifications.changeSettings(user, body);
  }
}
