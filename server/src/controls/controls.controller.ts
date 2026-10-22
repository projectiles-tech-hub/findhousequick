import { Controller, Get, Req } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ControlsService } from './controls.service.js';
import { publicCountrySettings } from './country-settings.schema.js';
import { Public } from '../accounts/auth.js';
import { contextFromRequest } from './request-context.js';

@ApiTags('Controls')
@Public()
@Controller('controls')
export class ControlsController {
  constructor(private readonly controls: ControlsService) {}

  @Get()
  @ApiOperation({
    summary: 'Feature switches and country settings for the caller',
    description:
      'The apps call this when they open and every few minutes after, then show or hide features accordingly. ' +
      'The server still enforces every switch on its own.',
  })
  @ApiHeader({ name: 'X-Country', required: false, description: 'ISO country code, e.g. NG' })
  @ApiHeader({ name: 'X-Region', required: false })
  @ApiHeader({ name: 'X-City', required: false })
  @ApiOkResponse({ description: 'Feature switches, and the country settings when X-Country is given' })
  async get(@Req() req: Request) {
    const ctx = contextFromRequest(req);
    const features = await this.controls.evaluateAll(ctx);
    let country = null;
    if (ctx.countryCode) {
      const c = await this.controls.findCountry(ctx.countryCode);
      if (c?.enabled) {
        country = {
          code: c.code,
          name: c.name,
          currency: c.currency,
          languages: c.languages.filter((l) => features[`language.${l}`] !== false),
          defaultLanguage: c.defaultLanguage,
          timezone: c.timezone,
          settings: publicCountrySettings(c.settings),
        };
      }
    }
    return { features, country, refreshAfterSeconds: 300 };
  }
}
