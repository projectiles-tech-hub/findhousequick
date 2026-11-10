import { Global, Module } from '@nestjs/common';
import { LiveService } from './live.service.js';

/** The live connection for signed-in apps (decision 47). */
@Global()
@Module({ providers: [LiveService], exports: [LiveService] })
export class LiveModule {}
