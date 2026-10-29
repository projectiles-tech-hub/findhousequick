import { Module } from '@nestjs/common';
import { ReferenceController } from './reference.controller.js';
import { ReferenceService } from './reference.service.js';

/** Reference lists for the apps: property types, document types, regions and cities (step 4). */
@Module({ controllers: [ReferenceController], providers: [ReferenceService] })
export class ReferenceModule {}
