import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { InspectionsController } from './inspections.controller.js';
import { InspectionsService } from './inspections.service.js';

/** Inspection availability, booking, safety sharing and follow-up (Specification 7.2, decision 45). */
@Module({
  imports: [ListingsModule, ReportsModule],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
