import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { CALL_PROVIDER, type CallProvider } from './call-provider.js';
import { TestCallAdapter } from './test-call.adapter.js';

/** Provides the calling service adapter named in CALL_PROVIDER. A real service is added when it is chosen. */
@Global()
@Module({
  providers: [
    {
      provide: CALL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): CallProvider => {
        const provider = config.get('CALL_PROVIDER', { infer: true });
        if (provider === 'test') return new TestCallAdapter();
        throw new Error(`Unknown calling service: ${String(provider)}`);
      },
    },
  ],
  exports: [CALL_PROVIDER],
})
export class CallsProviderModule {}
