import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DataExportService } from './data-export.service.js';
import { PrivacyController } from './privacy.controller.js';

/** The user's own data: copies on request (Specification 15.2). */
@Module({
  imports: [NotificationsModule],
  controllers: [PrivacyController],
  providers: [DataExportService],
  exports: [DataExportService],
})
export class PrivacyModule {}
