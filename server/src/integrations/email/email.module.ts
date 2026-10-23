import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { EMAIL_SENDER, type EmailSender } from './email-sender.js';
import { LogEmailAdapter } from './log-email.adapter.js';

/** Provides the email adapter named in EMAIL_PROVIDER. Real providers are added here as they are contracted. */
@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): EmailSender => {
        const provider = config.get('EMAIL_PROVIDER', { infer: true });
        switch (provider) {
          case 'log':
            return new LogEmailAdapter(config.get('EMAIL_FROM', { infer: true }));
          default:
            throw new Error(`Unknown email provider: ${String(provider)}`);
        }
      },
    },
  ],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
