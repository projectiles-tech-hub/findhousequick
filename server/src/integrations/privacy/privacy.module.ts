import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { NoRegionFinder, PRIVATE_REGION_FINDER, type PrivateRegionFinder } from './private-regions.js';

/** Provides the detection service named in PRIVATE_REGIONS_PROVIDER (automatic blurring, Specification 15.3). */
@Global()
@Module({
  providers: [
    {
      provide: PRIVATE_REGION_FINDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): PrivateRegionFinder => {
        const provider = config.get('PRIVATE_REGIONS_PROVIDER', { infer: true });
        switch (provider) {
          case 'none':
            return new NoRegionFinder();
          default:
            throw new Error(`Unknown private regions provider: ${String(provider)}`);
        }
      },
    },
  ],
  exports: [PRIVATE_REGION_FINDER],
})
export class PrivacyIntegrationModule {}
