import { Global, Module } from '@nestjs/common';
import { AlertsService } from './alerts.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

/** Notifications and saved-area alerts. Global, so any part of the server can notify a user. */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, AlertsService],
  exports: [NotificationsService, AlertsService],
})
export class NotificationsModule {}
