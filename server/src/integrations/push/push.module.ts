import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { LogPushAdapter } from './log-push.adapter.js';
import { PUSH_SENDER, type PushSender } from './push-sender.js';

/** Provides the push adapter named in PUSH_PROVIDER. Firebase Cloud Messaging is added when its account is opened. */
@Global()
@Module({
  providers: [
    {
      provide: PUSH_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): PushSender => {
        const provider = config.get('PUSH_PROVIDER', { infer: true });
        if (provider === 'log') return new LogPushAdapter();
        throw new Error(`Unknown push provider: ${String(provider)}`);
      },
    },
  ],
  exports: [PUSH_SENDER],
})
export class PushModule {}
