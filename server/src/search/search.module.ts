import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { SavedService } from './saved.service.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';
import { ViewLimitsService } from './view-limits.service.js';

/** Search, the property page, saved items and viewing limits (Release 1 step 5, part 2). */
@Module({
  imports: [MediaModule],
  controllers: [SearchController],
  providers: [SearchService, SavedService, ViewLimitsService],
  exports: [SearchService, ViewLimitsService],
})
export class SearchModule {}
