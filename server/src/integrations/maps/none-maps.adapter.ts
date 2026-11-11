import type { Amenity, MapsProvider, Place, Travel, TravelQuery } from './maps-provider.js';

/**
 * No maps service. Place search finds nothing, no amenities are listed and travel times are unknown, which is how the
 * platform behaved before any maps provider was connected. Safe on a live server: those features simply stay empty.
 */
export class NoneMapsAdapter implements MapsProvider {
  readonly provider = 'none';

  searchPlaces(): Promise<Place[]> {
    return Promise.resolve([]);
  }

  nearbyAmenities(): Promise<Amenity[]> {
    return Promise.resolve([]);
  }

  travel(query: TravelQuery): Promise<Travel[]> {
    return Promise.resolve(query.to.map(() => ({ distanceM: null, minutes: null })));
  }
}
