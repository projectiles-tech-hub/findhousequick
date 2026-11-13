import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, Public } from '../accounts/auth.js';
import { RequireLevel } from '../accounts/verification.guard.js';
import type { RequestUser } from '../controls/request-context.js';
import { contextFromRequest } from '../controls/request-context.js';
import { RequireFeature } from '../controls/require-feature.guard.js';
import { AreasQuery, PlacesQuery, RelatedQuery, SavedPlaceDto, SavedSearchDto, SearchListingsQuery } from './dto.js';
import { MAP_TILES } from '../integrations/maps/maps.module.js';
import type { MapTiles } from '../integrations/maps/map-tiles.js';
import { SavedService } from './saved.service.js';
import { SearchService } from './search.service.js';

@ApiTags('Search')
@Controller()
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly saved: SavedService,
    @Inject(MAP_TILES) private readonly tiles: MapTiles,
  ) {}

  @Get('maps/tiles')
  @Public()
  @ApiOperation({
    summary: 'Where the apps fetch the map picture from',
    description:
      'The tile address (with {z}, {x} and {y}), the credit to show on the map, the highest zoom, and until when the ' +
      'address works. `source` is null when no map provider is set; the apps then say the map is not available (decision 81).',
  })
  @ApiOkResponse({ description: '{ source }' })
  async mapTiles() {
    return { source: await this.tiles.source() };
  }

  @Get('search/listings')
  @Public()
  @ApiOperation({
    summary: 'Search live listings around a point, inside a map area, or by area name',
    description:
      'Send `near` (with `radiusM`; `source` says whether it is the phone\'s location or a landmark) or `bbox` for the map, ' +
      'or neither to list the newest. Positions are approximate and distances rounded until an inspection is confirmed. ' +
      'Below zoom 13 the map gets `clusters` instead of single listings. Open to signed-out visitors (decision 75).',
  })
  @ApiOkResponse({ description: 'items, clusters and nextCursor' })
  @ApiResponse({ status: 403, description: 'FEATURE_UNAVAILABLE (around me, map or landmark search switched off)' })
  searchListings(@Query() q: SearchListingsQuery, @Req() req: Request) {
    return this.search.search(q, contextFromRequest(req));
  }

  @Get('search/places')
  @Public()
  @ApiOperation({ summary: 'Areas and landmarks whose names start with the text, for landmark search' })
  @ApiOkResponse({ description: 'Up to 10 places' })
  places(@Query() q: PlacesQuery) {
    return this.search.places(q.q);
  }

  @Get('search/areas')
  @Public()
  @ApiOperation({ summary: 'The areas with the most live listings, with their counts, for "popular areas" (decisions 77 and 80)' })
  @ApiOkResponse({ description: 'Up to `limit` areas: area, city and count' })
  areas(@Query() q: AreasQuery, @Req() req: Request) {
    return this.search.areas(q.city, q.limit ?? 10, contextFromRequest(req));
  }

  @Get('listings/:listingId/related')
  @Public()
  @ApiOperation({ summary: 'Similar homes nearby and more homes in the same area, for the property page (decisions 77 and 80)' })
  @ApiOkResponse({ description: '`similar` and `nearby` listing cards' })
  related(@Param('listingId', ParseUUIDPipe) listingId: string, @Query() q: RelatedQuery, @Req() req: Request) {
    return this.search.related(listingId, q.limit ?? 6, contextFromRequest(req));
  }

  // Saved searches, places and favourites (signed in, level 1)

  @Get('me/saved-searches')
  @ApiTags('Saved')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Saved areas and their alert settings' })
  listSearches(@CurrentUser() user: RequestUser) {
    return this.saved.listSearches(user);
  }

  @Post('me/saved-searches')
  @ApiTags('Saved')
  @ApiBearerAuth()
  @RequireLevel(1)
  @RequireFeature('search.saved_alerts')
  @ApiOperation({ summary: 'Save an area (a drawn polygon or a circle) with filters; alerts arrive when a matching listing goes live' })
  @ApiCreatedResponse({ description: 'Saved' })
  @ApiResponse({ status: 409, description: 'TOO_MANY (20 at most)' })
  addSearch(@CurrentUser() user: RequestUser, @Body() dto: SavedSearchDto) {
    return this.saved.addSearch(user, dto);
  }

  @Delete('me/saved-searches/:id')
  @ApiTags('Saved')
  @ApiBearerAuth()
  @HttpCode(204)
  async deleteSearch(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.saved.deleteSearch(user, id);
  }

  @Get('me/saved-places')
  @ApiTags('Saved')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Places the tenant saved, such as an office or school (decision 48)' })
  listPlaces(@CurrentUser() user: RequestUser) {
    return this.saved.listPlaces(user);
  }

  @Post('me/saved-places')
  @ApiTags('Saved')
  @ApiBearerAuth()
  @RequireLevel(1)
  @ApiOperation({ summary: 'Save a place. A tenant\'s location is stored only when they choose to save a place (Specification 15.2)' })
  @ApiResponse({ status: 409, description: 'TOO_MANY (10 at most)' })
  addPlace(@CurrentUser() user: RequestUser, @Body() dto: SavedPlaceDto) {
    return this.saved.addPlace(user, dto);
  }

  @Delete('me/saved-places/:id')
  @ApiTags('Saved')
  @ApiBearerAuth()
  @HttpCode(204)
  async deletePlace(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.saved.deletePlace(user, id);
  }

  @Get('me/saved-listings')
  @ApiTags('Saved')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Favourite listings that are still live' })
  listSaved(@CurrentUser() user: RequestUser, @Req() req: Request) {
    return this.saved.listListings(user, contextFromRequest(req));
  }

  @Put('me/saved-listings/:listingId')
  @ApiTags('Saved')
  @ApiBearerAuth()
  @RequireLevel(1)
  @HttpCode(204)
  @ApiOperation({ summary: 'Add a favourite (saving twice is harmless)' })
  async save(@CurrentUser() user: RequestUser, @Param('listingId', ParseUUIDPipe) listingId: string): Promise<void> {
    await this.saved.saveListing(user, listingId);
  }

  @Delete('me/saved-listings/:listingId')
  @ApiTags('Saved')
  @ApiBearerAuth()
  @HttpCode(204)
  async unsave(@CurrentUser() user: RequestUser, @Param('listingId', ParseUUIDPipe) listingId: string): Promise<void> {
    await this.saved.unsaveListing(user, listingId);
  }
}
