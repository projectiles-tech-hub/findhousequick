import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { LogSmsAdapter } from './log-sms.adapter.js';
import { SMS_SENDER, type SmsSender } from './sms-sender.js';

/** Provides the SMS adapter named in SMS_PROVIDER. Real providers are added here as they are contracted. */
@Global()
@Module({
  providers: [
    {
      provide: SMS_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): SmsSender => {
        const provider = config.get('SMS_PROVIDER', { infer: true });
        switch (provider) {
          case 'log':
            return new LogSmsAdapter();
          default:
            throw new Error(`Unknown SMS provider: ${String(provider)}`);
        }
      },
    },
  ],
  exports: [SMS_SENDER],
})
export class SmsModule {}
