import { Module } from '@nestjs/common';
import { FieldEncryption } from '../common/field-encryption.js';
import { StaffController } from './staff.controller.js';
import { StaffGuard } from './staff.guard.js';
import { StaffService } from './staff.service.js';
import { TwoStepController } from './two-step.controller.js';
import { TwoStepService } from './two-step.service.js';

/** Staff accounts, roles and two-step login (ADR 0005). */
@Module({
  controllers: [StaffController, TwoStepController],
  providers: [StaffService, TwoStepService, StaffGuard, FieldEncryption],
  exports: [StaffGuard],
})
export class StaffModule {}
