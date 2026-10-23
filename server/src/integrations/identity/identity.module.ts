import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { IDENTITY_PROVIDERS, type IdentityProvider, type IdentityProviders } from './identity-provider.js';
import { TestIdentityAdapter } from './test-identity.adapter.js';

/**
 * Provides the identity adapters this server can use, by name. Each country picks one in its settings
 * (verification.identityProvider). Real providers are added here as they are contracted, with their keys in the
 * environment (see docs/DEPLOYMENT.md).
 */
@Global()
@Module({
  providers: [
    {
      provide: IDENTITY_PROVIDERS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): IdentityProviders => {
        const adapters: IdentityProvider[] = [];
        // The test provider accepts results from anyone, so it never runs in production.
        if (config.get('NODE_ENV', { infer: true }) !== 'production') adapters.push(new TestIdentityAdapter());
        return new Map(adapters.map((a) => [a.name, a]));
      },
    },
  ],
  exports: [IDENTITY_PROVIDERS],
})
export class IdentityProviderModule {}
