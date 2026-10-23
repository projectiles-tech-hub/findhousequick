import { Module } from '@nestjs/common';
import { FieldEncryption } from '../common/field-encryption.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';

/** Identity checks (NIN or national equivalent, selfie, liveness) and agent company details (ADR 0007). */
@Module({
  controllers: [IdentityController],
  providers: [IdentityService, FieldEncryption],
})
export class IdentityModule {}
