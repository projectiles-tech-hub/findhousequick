import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { PropertiesModule } from '../properties/properties.module.js';
import { SearchModule } from '../search/search.module.js';
import { AuthoritiesService } from './authorities.service.js';
import { ListingsController } from './listings.controller.js';
import { ListingChecksService } from './listing-checks.service.js';
import { ListingsService } from './listings.service.js';

/** Listings, submission and agent authority (Release 1 step 5, part 1; ADR 0009). */
@Module({
  imports: [PropertiesModule, MediaModule, SearchModule],
  controllers: [ListingsController],
  providers: [ListingsService, AuthoritiesService, ListingChecksService],
  exports: [ListingsService, ListingChecksService],
})
export class ListingsModule {}
