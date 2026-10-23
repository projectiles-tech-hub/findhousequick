import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { contextFromRequest, type RequestUser } from '../controls/request-context.js';
import { AccountsService } from './accounts.service.js';
import { CurrentUser, Public } from './auth.js';
import { LoginDto, RefreshDto, RegisterDto, RequestOtpDto, ResetPasswordDto } from './dto.js';

// Per-address limits on top of the per-number and per-account limits inside the services.
const PER_MINUTE = (limit: number) => Throttle({ default: { limit, ttl: 60_000 } });

@ApiTags('Accounts')
@Controller('auth')
export class AuthController {
  constructor(private readonly accounts: AccountsService) {}

  @Public()
  @Post('otp')
  @HttpCode(202)
  @PER_MINUTE(10)
  @ApiOperation({
    summary: 'Send a one-time code by SMS or email',
    description:
      'Give either phone (code by SMS) or email (code by email). Used for registration, sign-in without a password ' +
      'and password reset. Sign-in and reset codes go only to a confirmed contact. Limited per phone number or email ' +
      'address. The response never reveals whether it is registered.',
  })
  @ApiAcceptedResponse({ description: 'Code sent if the request is allowed' })
  @ApiResponse({ status: 429, description: 'Too many codes requested' })
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request): Promise<void> {
    await this.accounts.requestOtp(dto, contextFromRequest(req));
  }

  @Public()
  @Post('register')
  @PER_MINUTE(10)
  @ApiOperation({
    summary: 'Register (free) with phone and email, confirming one of them now (decision 35)',
    description: 'The other contact is confirmed afterwards; level 1 needs both (decision 37).',
  })
  @ApiCreatedResponse({ description: 'Registered and signed in' })
  @ApiResponse({ status: 409, description: 'Phone or email already registered' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.accounts.register(dto, contextFromRequest(req));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @PER_MINUTE(20)
  @ApiOperation({ summary: 'Sign in with phone or email, and a password or a code sent to it (decision 35)' })
  @ApiOkResponse({ description: 'Signed in' })
  @ApiResponse({ status: 401, description: 'Wrong credentials' })
  @ApiResponse({ status: 403, description: 'Account suspended (code ACCOUNT_SUSPENDED)' })
  @ApiResponse({ status: 429, description: 'Too many attempts (code PASSWORD_LOCKED or TOO_MANY_REQUESTS)' })
  login(@Body() dto: LoginDto) {
    return this.accounts.login(dto);
  }

  @Public()
  @Post('password-reset')
  @HttpCode(204)
  @PER_MINUTE(10)
  @ApiOperation({
    summary: 'Set a new password with a code sent by SMS or email, as the user chooses (decision 36)',
    description:
      'Needs a code sent for purpose RESET_PASSWORD to a confirmed phone number or email address. Signs the user out ' +
      'of every device; they then sign in with the new password. Also lifts any pause on password sign-in.',
  })
  @ApiNoContentResponse({ description: 'Password changed and every device signed out' })
  @ApiResponse({ status: 400, description: 'Wrong or expired code (code INVALID_CODE)' })
  @ApiResponse({ status: 403, description: 'Account suspended (code ACCOUNT_SUSPENDED)' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.accounts.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @PER_MINUTE(30)
  @ApiOperation({
    summary: 'Exchange a refresh token for new tokens',
    description: 'Refresh tokens work once; each call returns a new one. Reusing an old one signs that device out.',
  })
  @ApiOkResponse({ description: 'New tokens' })
  @ApiResponse({ status: 401, description: 'Token expired, revoked or already used' })
  refresh(@Body() dto: RefreshDto) {
    return this.accounts.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out this device' })
  @ApiNoContentResponse({ description: 'Signed out' })
  async logout(@CurrentUser() user: RequestUser): Promise<void> {
    await this.accounts.logout(user.sessionId);
  }
}
