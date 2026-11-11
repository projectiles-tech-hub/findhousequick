/**
 * What the platform asks of a maps service (decision 81): finding places by name, the amenities near a point, and
 * travel distance and time. Google Maps and OpenStreetMap each have an adapter implementing this, so the rest of the
 * server never depends on which one is used. The map picture itself is drawn by the apps, not the server.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceQuery {
  text: string;
  /** ISO 3166 two-letter country code; results are kept to this country. */
  countryCode: string;
  /** Prefer places close to here, such as the centre of the user's city. */
  near?: LatLng;
  limit: number;
}

export interface Place {
  name: string;
  /** The rest of the address, to tell places with the same name apart. */
  description: string;
  location: LatLng;
}

/**
 * The kinds of amenity the platform knows. Each adapter translates them into its own service's categories; which of
 * them a country shows is a country setting, not decided here.
 */
export const AMENITY_KINDS = [
  'school',
  'hospital',
  'pharmacy',
  'market',
  'bank',
  'fuel_station',
  'bus_stop',
  'place_of_worship',
  'police',
] as const;
export type AmenityKind = (typeof AMENITY_KINDS)[number];

export interface AmenityQuery {
  at: LatLng;
  radiusMetres: number;
  kinds: AmenityKind[];
  limit: number;
}

export interface Amenity {
  kind: AmenityKind;
  name: string;
  location: LatLng;
  /** Straight-line distance from the point asked about, in metres. */
  distanceM: number;
}

export type TravelMode = 'DRIVE' | 'WALK';

export interface TravelQuery {
  from: LatLng;
  to: LatLng[];
  mode: TravelMode;
}

/** One answer per destination, in the order asked. Both are null when the service finds no route. */
export interface Travel {
  distanceM: number | null;
  minutes: number | null;
}

export interface PlaceSearch {
  readonly provider: string;
  searchPlaces(query: PlaceQuery): Promise<Place[]>;
}

export interface AmenitySearch {
  readonly provider: string;
  nearbyAmenities(query: AmenityQuery): Promise<Amenity[]>;
}

export interface TravelTimes {
  readonly provider: string;
  travel(query: TravelQuery): Promise<Travel[]>;
}

export interface MapsProvider extends PlaceSearch, AmenitySearch, TravelTimes {}

/**
 * The maps services in use, one per use, so each use can go to a different provider (for example OpenStreetMap for
 * place search and Google Maps for travel times).
 */
export interface Maps {
  places: PlaceSearch;
  amenities: AmenitySearch;
  travel: TravelTimes;
}

export const MAPS = Symbol('MAPS');

/** The maps service could not answer: it is down, too slow, or refused the request. Callers carry on without it. */
export class MapsUnavailableError extends Error {
  constructor(
    readonly provider: string,
    detail: string,
  ) {
    super(`Maps provider "${provider}" could not answer: ${detail}`);
    this.name = 'MapsUnavailableError';
  }
}

export type Fetch = typeof fetch;

/** Straight-line distance between two points on the earth, in whole metres. */
export function metresBetween(a: LatLng, b: LatLng): number {
  const rad = (d: number): number => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

/** Calls a maps service and reads its JSON answer, giving up after [timeoutMs] so a slow service never holds a page. */
export async function callJson(provider: string, doFetch: Fetch, url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  let res: Response;
  try {
    res = await doFetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new MapsUnavailableError(provider, e instanceof Error ? e.message : 'no answer');
  }
  if (!res.ok) throw new MapsUnavailableError(provider, `HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new MapsUnavailableError(provider, 'the answer was not JSON');
  }
}
