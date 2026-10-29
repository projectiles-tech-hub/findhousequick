import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../accounts/auth.js';
import { ReferenceService } from './reference.service.js';

/** Lists the apps need to build their forms. Open to everyone, signed in or not. */
@ApiTags('Reference')
@Public()
@Controller('reference/countries/:countryCode')
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Get('property-types')
  @ApiOperation({ summary: 'Property categories and types for a country, with their photo checklists' })
  @ApiOkResponse({ description: 'Property types in display order' })
  @ApiResponse({ status: 404, description: 'The country is not set up or not switched on' })
  propertyTypes(@Param('countryCode') countryCode: string) {
    return this.reference.propertyTypes(countryCode);
  }

  @Get('document-types')
  @ApiOperation({ summary: 'Accepted identity, ownership and authority documents for a country' })
  @ApiOkResponse({ description: 'Document types' })
  @ApiResponse({ status: 404, description: 'The country is not set up or not switched on' })
  documentTypes(@Param('countryCode') countryCode: string) {
    return this.reference.documentTypes(countryCode);
  }

  @Get('regions')
  @ApiOperation({
    summary: 'States or regions of a country, with their cities',
    description: 'Every region and city is listed with whether it is switched on, so the apps can show "coming soon".',
  })
  @ApiOkResponse({ description: 'Regions, each with its cities' })
  @ApiResponse({ status: 404, description: 'The country is not set up or not switched on' })
  regions(@Param('countryCode') countryCode: string) {
    return this.reference.regions(countryCode);
  }
}
