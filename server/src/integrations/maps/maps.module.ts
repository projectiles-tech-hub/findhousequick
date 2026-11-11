import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { GoogleMapsAdapter } from './google-maps.adapter.js';
import { MAPS, type Fetch, type Maps, type MapsProvider } from './maps-provider.js';
import { NoneMapsAdapter } from './none-maps.adapter.js';
import { OpenStreetMapAdapter } from './openstreetmap.adapter.js';

export type MapsSettings = Pick<
  Env,
  | 'MAPS_PROVIDER'
  | 'MAPS_PLACES_PROVIDER'
  | 'MAPS_AMENITIES_PROVIDER'
  | 'MAPS_TRAVEL_PROVIDER'
  | 'MAPS_TIMEOUT_MS'
  | 'GOOGLE_MAPS_API_KEY'
  | 'OSM_SEARCH_URL'
  | 'OSM_AMENITIES_URL'
  | 'OSM_ROUTES_URL'
  | 'OSM_USER_AGENT'
>;

/**
 * Picks the maps service for each use (decision 81). MAPS_PROVIDER is the choice for every use; a use with its own
 * setting (for example MAPS_TRAVEL_PROVIDER) goes to the provider named there instead.
 */
export function buildMaps(env: MapsSettings, doFetch: Fetch = fetch): Maps {
  const made = new Map<string, MapsProvider>();
  const adapter = (name: 'none' | 'google' | 'openstreetmap'): MapsProvider => {
    let a = made.get(name);
    if (!a) {
      if (name === 'google') a = new GoogleMapsAdapter(env.GOOGLE_MAPS_API_KEY ?? '', env.MAPS_TIMEOUT_MS, doFetch);
      else if (name === 'openstreetmap') {
        a = new OpenStreetMapAdapter(
          { searchUrl: env.OSM_SEARCH_URL, amenitiesUrl: env.OSM_AMENITIES_URL, routesUrl: env.OSM_ROUTES_URL, userAgent: env.OSM_USER_AGENT },
          env.MAPS_TIMEOUT_MS,
          doFetch,
        );
      } else a = new NoneMapsAdapter();
      made.set(name, a);
    }
    return a;
  };
  return {
    places: adapter(env.MAPS_PLACES_PROVIDER ?? env.MAPS_PROVIDER),
    amenities: adapter(env.MAPS_AMENITIES_PROVIDER ?? env.MAPS_PROVIDER),
    travel: adapter(env.MAPS_TRAVEL_PROVIDER ?? env.MAPS_PROVIDER),
  };
}

/** Provides the maps services named in the server settings. */
@Global()
@Module({
  providers: [
    {
      provide: MAPS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Maps =>
        buildMaps({
          MAPS_PROVIDER: config.get('MAPS_PROVIDER', { infer: true }),
          MAPS_PLACES_PROVIDER: config.get('MAPS_PLACES_PROVIDER', { infer: true }),
          MAPS_AMENITIES_PROVIDER: config.get('MAPS_AMENITIES_PROVIDER', { infer: true }),
          MAPS_TRAVEL_PROVIDER: config.get('MAPS_TRAVEL_PROVIDER', { infer: true }),
          MAPS_TIMEOUT_MS: config.get('MAPS_TIMEOUT_MS', { infer: true }),
          GOOGLE_MAPS_API_KEY: config.get('GOOGLE_MAPS_API_KEY', { infer: true }),
          OSM_SEARCH_URL: config.get('OSM_SEARCH_URL', { infer: true }),
          OSM_AMENITIES_URL: config.get('OSM_AMENITIES_URL', { infer: true }),
          OSM_ROUTES_URL: config.get('OSM_ROUTES_URL', { infer: true }),
          OSM_USER_AGENT: config.get('OSM_USER_AGENT', { infer: true }),
        }),
    },
  ],
  exports: [MAPS],
})
export class MapsModule {}
