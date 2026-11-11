import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller.js';
import { ScoutsModule } from '../scouts/scouts.module.js';
import { PropertiesService } from './properties.service.js';

/** Buildings, units and the parts checklist (Release 1 step 4). */
@Module({ imports: [ScoutsModule], controllers: [PropertiesController], providers: [PropertiesService], exports: [PropertiesService] })
export class PropertiesModule {}
