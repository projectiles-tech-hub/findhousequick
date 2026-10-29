import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../accounts/auth.js';
import { RequireLevel } from '../accounts/verification.guard.js';
import type { RequestUser } from '../controls/request-context.js';
import { RequireFeature } from '../controls/require-feature.guard.js';
import { CreateBuildingDto, CreateUnitDto, PartNoteDto, UpdateUnitDto } from './dto.js';
import { PropertiesService } from './properties.service.js';

@ApiTags('Properties')
@ApiBearerAuth()
@Controller()
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Post('buildings')
  @RequireFeature('platform.new_listings')
  @RequireLevel(2)
  @ApiOperation({
    summary: 'Register a building while standing at it',
    description:
      "Landlords and agents, at verification level 2. The location is the phone's live GPS reading taken in the app. " +
      "If another building is within the country's duplicate radius, or at the same address, the answer lists it in " +
      '`possibleDuplicates` and the building is sent to the verification team to check.',
  })
  @ApiCreatedResponse({ description: 'The building, with possibleDuplicates' })
  @ApiResponse({ status: 400, description: 'The city is not open yet (CITY_NOT_AVAILABLE) or the request is invalid' })
  @ApiResponse({ status: 403, description: 'Not a landlord or agent (NOT_A_LISTER), level 2 needed (VERIFICATION_REQUIRED) or switched off (FEATURE_UNAVAILABLE)' })
  createBuilding(@CurrentUser() user: RequestUser, @Body() dto: CreateBuildingDto) {
    return this.properties.createBuilding(user, dto);
  }

  @Get('buildings/:buildingId')
  @ApiOperation({ summary: 'A building the user owns, registered, or has approved authority for, with its units' })
  @ApiOkResponse({ description: 'The building with its units and their checklists' })
  @ApiResponse({ status: 404, description: 'Not found, or not one of the user\'s buildings' })
  getBuilding(@CurrentUser() user: RequestUser, @Param('buildingId', ParseUUIDPipe) buildingId: string) {
    return this.properties.getBuilding(user, buildingId);
  }

  @Post('buildings/:buildingId/units')
  @RequireFeature('platform.new_listings')
  @RequireLevel(2)
  @ApiOperation({
    summary: 'Add a unit (e.g. Flat 3) and make its photo checklist',
    description: 'The checklist comes from the property type and the room counts: one part per bedroom, bathroom and toilet.',
  })
  @ApiCreatedResponse({ description: 'The unit with its checklist' })
  @ApiResponse({ status: 400, description: 'Property type not offered (PROPERTY_TYPE_NOT_AVAILABLE) or details not valid (INVALID_DETAILS)' })
  @ApiResponse({ status: 409, description: 'The building already has a unit with this name (UNIT_LABEL_TAKEN)' })
  addUnit(@CurrentUser() user: RequestUser, @Param('buildingId', ParseUUIDPipe) buildingId: string, @Body() dto: CreateUnitDto) {
    return this.properties.addUnit(user, buildingId, dto);
  }

  @Get('units/:unitId')
  @ApiOperation({ summary: 'A unit with its checklist and how many photos or videos each part has' })
  @ApiOkResponse({ description: 'The unit' })
  getUnit(@CurrentUser() user: RequestUser, @Param('unitId', ParseUUIDPipe) unitId: string) {
    return this.properties.getUnit(user, unitId);
  }

  @Patch('units/:unitId')
  @RequireLevel(2)
  @ApiOperation({
    summary: 'Change room counts or details',
    description:
      'New room counts rebuild the checklist. Parts that remain keep their notes and photos; parts no longer needed are ' +
      'removed, unless photos were already taken for them, in which case they stay as optional.',
  })
  @ApiOkResponse({ description: 'The unit' })
  @ApiResponse({ status: 400, description: 'Details not valid (INVALID_DETAILS)' })
  updateUnit(@CurrentUser() user: RequestUser, @Param('unitId', ParseUUIDPipe) unitId: string, @Body() dto: UpdateUnitDto) {
    return this.properties.updateUnit(user, unitId, dto);
  }

  @Patch('units/:unitId/parts/:partCode')
  @RequireLevel(2)
  @ApiOperation({ summary: 'Add, change or remove the note on one part, e.g. "newly tiled" (decision 56)' })
  @ApiOkResponse({ description: 'The unit' })
  setPartNote(
    @CurrentUser() user: RequestUser,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Param('partCode') partCode: string,
    @Body() dto: PartNoteDto,
  ) {
    return this.properties.setPartNote(user, unitId, partCode, dto.note);
  }
}
