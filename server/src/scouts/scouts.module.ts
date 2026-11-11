import { Module } from '@nestjs/common';
import { ScoutsController } from './scouts.controller.js';
import { ScoutsService } from './scouts.service.js';

/** Scouts and the referral record (decisions 70 to 72; ADR 0008). */
@Module({ controllers: [ScoutsController], providers: [ScoutsService], exports: [ScoutsService] })
export class ScoutsModule {}
