import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccountsService } from './accounts.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.js';
import { MeController } from './me.controller.js';
import { OtpService } from './otp.service.js';
import { SessionsService } from './sessions.service.js';

/**
 * Accounts: one-time codes, registration, sign-in, sessions and the user's own profile.
 * The sign-in check itself is attached in bootstrap.ts so it runs before every guard.
 */
@Global()
@Module({
  controllers: [AuthController, MeController],
  providers: [AccountsService, OtpService, SessionsService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [SessionsService, OtpService],
})
export class AccountsModule {}
