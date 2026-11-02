import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ControlsController } from './controls.controller.js';
import { ControlsService } from './controls.service.js';
import { CountriesAdminController } from './countries-admin.controller.js';
import { FeatureRulesController } from './feature-rules.controller.js';
import { PlatformSettingsController } from './platform-settings.controller.js';
import { RequireFeatureGuard } from './require-feature.guard.js';

@Global()
@Module({
  controllers: [ControlsController, FeatureRulesController, PlatformSettingsController, CountriesAdminController],
  providers: [ControlsService, { provide: APP_GUARD, useClass: RequireFeatureGuard }],
  exports: [ControlsService],
})
export class ControlsModule {}
