import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { LocalStorageAdapter, LocalStorageController } from './local-storage.adapter.js';
import { PRIVATE_STORAGE, type PrivateStorage } from './private-storage.js';

/**
 * Provides the private storage adapter named in STORAGE_PROVIDER. Real providers (for example Cloudflare R2) are added
 * here when the account is opened. The local provider's upload and view addresses answer only while it is in use.
 */
@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [
    {
      provide: LocalStorageAdapter,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new LocalStorageAdapter(config.get('STORAGE_LOCAL_DIR', { infer: true }), config.get('API_PUBLIC_URL', { infer: true })),
    },
    {
      provide: PRIVATE_STORAGE,
      inject: [ConfigService, LocalStorageAdapter],
      useFactory: (config: ConfigService<Env, true>, local: LocalStorageAdapter): PrivateStorage => {
        const provider = config.get('STORAGE_PROVIDER', { infer: true });
        switch (provider) {
          case 'local':
            return local;
          default:
            throw new Error(`Unknown storage provider: ${String(provider)}`);
        }
      },
    },
  ],
  exports: [PRIVATE_STORAGE],
})
export class StorageModule {}
