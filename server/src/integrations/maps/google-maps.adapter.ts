import {
  callJson,
  metresBetween,
  type Amenity,
  type AmenityKind,
  type AmenityQuery,
  type Fetch,
  type MapsProvider,
  type Place,
  type PlaceQuery,
  type Travel,
  type TravelQuery,
} from './maps-provider.js';

/** Our amenity kinds in Google's place types (Places API, "Table A"). */
const GOOGLE_TYPES: Record<AmenityKind, string[]> = {
  school: ['school', 'primary_school', 'secondary_school', 'university'],
  hospital: ['hospital'],
  pharmacy: ['pharmacy'],
  market: ['market', 'supermarket'],
  bank: ['bank'],
  fuel_station: ['gas_station'],
  bus_stop: ['bus_station', 'bus_stop'],
  place_of_worship: ['church', 'mosque'],
  police: ['police'],
};

interface GooglePlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
}

/**
 * Google Maps Platform (decision 81): the Places API (New) for place search and nearby amenities, and the Routes API
 * for travel times. It needs one API key from a Google Cloud project with those two services switched on. Google
 * charges per request, so callers keep answers rather than asking again for the same thing.
 */
export class GoogleMapsAdapter implements MapsProvider {
  readonly provider = 'google';

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    private readonly doFetch: Fetch = fetch,
  ) {}

  private post(url: string, fieldMask: string, body: unknown): Promise<unknown> {
    return callJson(
      this.provider,
      this.doFetch,
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.apiKey, 'X-Goog-FieldMask': fieldMask },
        body: JSON.stringify(body),
      },
      this.timeoutMs,
    );
  }

  async searchPlaces(query: PlaceQuery): Promise<Place[]> {
    const answer = (await this.post('https://places.googleapis.com/v1/places:searchText', 'places.displayName,places.formattedAddress,places.location', {
      textQuery: query.text,
      regionCode: query.countryCode,
      maxResultCount: Math.min(query.limit, 20),
      ...(query.near && {
        locationBias: { circle: { center: { latitude: query.near.lat, longitude: query.near.lng }, radius: 30_000 } },
      }),
    })) as { places?: GooglePlace[] };
    const places: Place[] = [];
    for (const p of answer.places ?? []) {
      const lat = p.location?.latitude;
      const lng = p.location?.longitude;
      const name = p.displayName?.text;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !name) continue;
      places.push({ name, description: p.formattedAddress ?? '', location: { lat, lng } });
    }
    return places;
  }

  async nearbyAmenities(query: AmenityQuery): Promise<Amenity[]> {
    if (query.kinds.length === 0) return [];
    const answer = (await this.post('https://places.googleapis.com/v1/places:searchNearby', 'places.displayName,places.location,places.types', {
      includedTypes: query.kinds.flatMap((k) => GOOGLE_TYPES[k]),
      maxResultCount: Math.min(query.limit, 20),
      rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: query.at.lat, longitude: query.at.lng }, radius: query.radiusMetres } },
    })) as { places?: GooglePlace[] };
    const found: Amenity[] = [];
    for (const p of answer.places ?? []) {
      const lat = p.location?.latitude;
      const lng = p.location?.longitude;
      const name = p.displayName?.text;
      const kind = query.kinds.find((k) => GOOGLE_TYPES[k].some((t) => p.types?.includes(t)));
      if (typeof lat !== 'number' || typeof lng !== 'number' || !name || !kind) continue;
      found.push({ kind, name, location: { lat, lng }, distanceM: metresBetween(query.at, { lat, lng }) });
    }
    return found.sort((a, b) => a.distanceM - b.distanceM);
  }

  async travel(query: TravelQuery): Promise<Travel[]> {
    if (query.to.length === 0) return [];
    const point = (p: { lat: number; lng: number }): unknown => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });
    const answer = (await this.post(
      'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
      'originIndex,destinationIndex,duration,distanceMeters,condition',
      { origins: [point(query.from)], destinations: query.to.map(point), travelMode: query.mode === 'WALK' ? 'WALK' : 'DRIVE' },
    )) as { destinationIndex?: number; duration?: string; distanceMeters?: number; condition?: string }[];
    const out: Travel[] = query.to.map(() => ({ distanceM: null, minutes: null }));
    for (const row of Array.isArray(answer) ? answer : []) {
      const i = row.destinationIndex ?? 0;
      if (i < 0 || i >= out.length || row.condition !== 'ROUTE_EXISTS') continue;
      // The time comes as seconds with an "s" at the end, for example "754s".
      const seconds = Number.parseFloat(row.duration ?? '');
      out[i] = {
        distanceM: typeof row.distanceMeters === 'number' ? row.distanceMeters : 0,
        minutes: Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null,
      };
    }
    return out;
  }
}
