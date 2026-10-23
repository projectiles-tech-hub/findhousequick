import { Module } from '@nestjs/common';
import { StaffModule } from '../staff/staff.module.js';
import { ReviewController } from './review.controller.js';
import { ReviewService } from './review.service.js';

/** The verification team's work queue and decisions (ADR 0007). */
@Module({
  imports: [StaffModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
