import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../accounts/auth.js';
import type { RequestUser } from '../controls/request-context.js';
import { AuthenticatorConfirmDto, TwoStepVerifyDto } from './dto.js';
import { StaffOnly } from './staff.guard.js';
import { TwoStepService } from './two-step.service.js';

const PER_MINUTE = (limit: number) => Throttle({ default: { limit, ttl: 60_000 } });

/** Two-step login for staff (ADR 0005). */
@ApiTags('Staff two-step login')
@Controller()
export class TwoStepController {
  constructor(private readonly twoStep: TwoStepService) {}

  @Post('auth/two-step/sms')
  @HttpCode(202)
  @PER_MINUTE(10)
  @StaffOnly({ twoStep: false })
  @ApiOperation({
    summary: 'Send a second-step code by SMS to the signed-in staff member',
    description: 'Only on a device that signed in with a password (decision 34); otherwise DIFFERENT_FACTOR_REQUIRED.',
  })
  @ApiAcceptedResponse({ description: 'Code sent' })
  @ApiResponse({ status: 403, description: 'Device signed in with an SMS code (DIFFERENT_FACTOR_REQUIRED)' })
  @ApiResponse({ status: 429, description: 'Too many codes requested' })
  async sendSms(@CurrentUser() user: RequestUser): Promise<void> {
    await this.twoStep.sendSms(user);
  }

  @Post('auth/two-step/verify')
  @HttpCode(204)
  @PER_MINUTE(20)
  @StaffOnly({ twoStep: false })
  @ApiOperation({
    summary: 'Complete two-step login on this device with an SMS code or an authenticator app code',
    description:
      'The second step lasts for the period in the platform settings (3 hours by default), then must be done ' +
      'again. A device that signed in with an SMS code must use AUTHENTICATOR (decision 34). After 5 wrong ' +
      'codes the second step pauses for 15 minutes (code TWO_STEP_LOCKED).',
  })
  @ApiResponse({ status: 403, description: 'SMS chosen on a device that signed in with an SMS code (DIFFERENT_FACTOR_REQUIRED)' })
  @ApiNoContentResponse({ description: 'This device has passed the second step' })
  @ApiResponse({ status: 400, description: 'Wrong code (INVALID_CODE) or no authenticator set up (NO_AUTHENTICATOR)' })
  @ApiResponse({ status: 429, description: 'Second step paused (TWO_STEP_LOCKED)' })
  async verify(@CurrentUser() user: RequestUser, @Body() dto: TwoStepVerifyDto): Promise<void> {
    await this.twoStep.verify(user, dto.method, dto.code);
  }

  @Post('me/two-step/authenticator')
  @HttpCode(200)
  @StaffOnly()
  @ApiOperation({
    summary: 'Start adding an authenticator app',
    description:
      'Needs a device that has already passed the second step. Returns the secret and a set-up link for the app ' +
      '(usually shown as a QR code). Nothing changes until a first code confirms it.',
  })
  @ApiOkResponse({ description: 'Secret and set-up link' })
  startAuthenticator(@CurrentUser() user: RequestUser) {
    return this.twoStep.startAuthenticator(user);
  }

  @Post('me/two-step/authenticator/confirm')
  @HttpCode(204)
  @PER_MINUTE(20)
  @StaffOnly()
  @ApiOperation({ summary: 'Confirm the authenticator app with a first code from it' })
  @ApiNoContentResponse({ description: 'Authenticator app added' })
  @ApiResponse({ status: 400, description: 'Wrong code (INVALID_CODE) or set-up not started (NO_SETUP_IN_PROGRESS)' })
  async confirmAuthenticator(@CurrentUser() user: RequestUser, @Body() dto: AuthenticatorConfirmDto): Promise<void> {
    await this.twoStep.confirmAuthenticator(user, dto.code);
  }

  @Delete('me/two-step/authenticator')
  @HttpCode(204)
  @StaffOnly()
  @ApiOperation({ summary: 'Remove the authenticator app (SMS codes remain available)' })
  @ApiNoContentResponse({ description: 'Authenticator app removed' })
  async removeAuthenticator(@CurrentUser() user: RequestUser): Promise<void> {
    await this.twoStep.removeAuthenticator(user);
  }
}
