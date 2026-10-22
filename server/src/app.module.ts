import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountsModule } from './accounts/accounts.module.js';
import { validateEnv } from './config/env.js';
import { ControlsModule } from './controls/controls.module.js';
import { HealthController } from './health/health.controller.js';
import { SmsModule } from './integrations/sms/sms.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    // Basic protection against abuse; tighter limits are set per route where needed.
    // Off in the API tests, which send many requests from one address; the per-number and
    // per-account limits inside the services still apply and are tested.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    ControlsModule,
    SmsModule,
    AccountsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
