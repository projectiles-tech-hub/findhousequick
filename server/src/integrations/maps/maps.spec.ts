import { describe, expect, it } from 'vitest';
import { validateEnv } from '../../config/env.js';
import { GoogleMapsAdapter } from './google-maps.adapter.js';
import { buildMaps } from './maps.module.js';
import { MapsUnavailableError, metresBetween, type Fetch } from './maps-provider.js';
import { NoneMapsAdapter } from './none-maps.adapter.js';
import { OpenStreetMapAdapter } from './openstreetmap.adapter.js';

const ugbowo = { lat: 6.4, lng: 5.61 };
const ringRoad = { lat: 6.335, lng: 5.622 };

/** Stands in for a maps service: answers with [body] and remembers what was asked. */
function fake(body: unknown, status = 200): { fetch: Fetch; calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  const doFetch = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  }) as Fetch;
  return { fetch: doFetch, calls };
}

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'j'.repeat(40),
  OTP_HASH_SECRET: 'o'.repeat(40),
  LOOKUP_HASH_SECRET: 'l'.repeat(40),
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};

describe('maps: shared', () => {
  it('measures straight-line distance in metres', () => {
    expect(metresBetween(ugbowo, ugbowo)).toBe(0);
    // About 7.3 km from Ugbowo to Ring Road.
    expect(metresBetween(ugbowo, ringRoad)).toBeGreaterThan(7200);
    expect(metresBetween(ugbowo, ringRoad)).toBeLessThan(7400);
  });

  it('with no provider, the features stay empty instead of failing', async () => {
    const none = new NoneMapsAdapter();
    expect(await none.searchPlaces()).toEqual([]);
    expect(await none.nearbyAmenities()).toEqual([]);
    expect(await none.travel({ from: ugbowo, to: [ringRoad, ugbowo], mode: 'DRIVE' })).toEqual([
      { distanceM: null, minutes: null },
      { distanceM: null, minutes: null },
    ]);
  });
});

describe('maps: Google', () => {
  it('searches places in the country, near the point given, with the key in a header', async () => {
    const f = fake({
      places: [
        { displayName: { text: 'University of Benin' }, formattedAddress: 'Ugbowo, Benin City, Edo', location: { latitude: 6.4, longitude: 5.61 } },
        { displayName: { text: 'No position' } },
      ],
    });
    const google = new GoogleMapsAdapter('test-key-123456', 4000, f.fetch);
    const places = await google.searchPlaces({ text: 'uniben', countryCode: 'NG', near: ugbowo, limit: 5 });
    expect(places).toEqual([{ name: 'University of Benin', description: 'Ugbowo, Benin City, Edo', location: ugbowo }]);
    const call = f.calls[0];
    expect(call.url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(call.url).not.toContain('test-key');
    expect((call.init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('test-key-123456');
    const body = JSON.parse(String(call.init.body)) as { textQuery: string; regionCode: string; maxResultCount: number; locationBias: unknown };
    expect(body).toMatchObject({ textQuery: 'uniben', regionCode: 'NG', maxResultCount: 5 });
    expect(body.locationBias).toBeDefined();
  });

  it('lists nearby amenities under our own kinds, nearest first', async () => {
    const f = fake({
      places: [
        { displayName: { text: 'Zenith Bank' }, location: { latitude: 6.41, longitude: 5.61 }, types: ['bank', 'finance'] },
        { displayName: { text: 'Uniben Staff School' }, location: { latitude: 6.401, longitude: 5.61 }, types: ['primary_school', 'school'] },
        { displayName: { text: 'A cinema' }, location: { latitude: 6.4, longitude: 5.61 }, types: ['movie_theater'] },
      ],
    });
    const google = new GoogleMapsAdapter('test-key-123456', 4000, f.fetch);
    const found = await google.nearbyAmenities({ at: ugbowo, radiusMetres: 2000, kinds: ['school', 'bank'], limit: 10 });
    expect(found.map((a) => [a.kind, a.name])).toEqual([
      ['school', 'Uniben Staff School'],
      ['bank', 'Zenith Bank'],
    ]);
    expect(found[0].distanceM).toBeLessThan(found[1].distanceM);
    const body = JSON.parse(String(f.calls[0].init.body)) as { includedTypes: string[]; rankPreference: string };
    expect(body.includedTypes).toEqual(expect.arrayContaining(['school', 'bank']));
    expect(body.rankPreference).toBe('DISTANCE');
    expect(await google.nearbyAmenities({ at: ugbowo, radiusMetres: 2000, kinds: [], limit: 10 })).toEqual([]);
  });

  it('gives travel time and distance per destination, in the order asked, and nulls where there is no route', async () => {
    const f = fake([
      { originIndex: 0, destinationIndex: 1, condition: 'ROUTE_NOT_FOUND' },
      { originIndex: 0, destinationIndex: 0, duration: '754s', distanceMeters: 8120, condition: 'ROUTE_EXISTS' },
    ]);
    const google = new GoogleMapsAdapter('test-key-123456', 4000, f.fetch);
    expect(await google.travel({ from: ugbowo, to: [ringRoad, { lat: 0, lng: 0 }], mode: 'DRIVE' })).toEqual([
      { distanceM: 8120, minutes: 13 },
      { distanceM: null, minutes: null },
    ]);
    expect(f.calls[0].url).toBe('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix');
  });

  it('reports the service as unavailable when it refuses or cannot be reached', async () => {
    const refused = new GoogleMapsAdapter('test-key-123456', 4000, fake({ error: 'denied' }, 403).fetch);
    await expect(refused.searchPlaces({ text: 'x', countryCode: 'NG', limit: 5 })).rejects.toBeInstanceOf(MapsUnavailableError);
    const down = new GoogleMapsAdapter('test-key-123456', 4000, (() => Promise.reject(new Error('socket hang up'))) as Fetch);
    await expect(down.travel({ from: ugbowo, to: [ringRoad], mode: 'DRIVE' })).rejects.toThrow(/socket hang up/);
  });
});

describe('maps: OpenStreetMap', () => {
  const servers = {
    searchUrl: 'https://nominatim.test/',
    amenitiesUrl: 'https://overpass.test/api/interpreter',
    routesUrl: 'https://osrm.test',
    userAgent: 'FindHouseQuick tests',
  };

  it('searches places in the country and says who is calling', async () => {
    const f = fake([
      { name: 'University of Benin', display_name: 'University of Benin, Ugbowo, Benin City, Edo, Nigeria', lat: '6.4', lon: '5.61' },
      { display_name: 'Ring Road, Benin City, Edo, Nigeria', lat: '6.335', lon: '5.622' },
      { display_name: 'Broken', lat: 'x', lon: 'y' },
    ]);
    const osm = new OpenStreetMapAdapter(servers, 4000, f.fetch);
    const places = await osm.searchPlaces({ text: 'uniben', countryCode: 'NG', near: ugbowo, limit: 5 });
    expect(places).toEqual([
      { name: 'University of Benin', description: 'Ugbowo, Benin City, Edo, Nigeria', location: ugbowo },
      { name: 'Ring Road', description: 'Benin City, Edo, Nigeria', location: ringRoad },
    ]);
    const url = new URL(f.calls[0].url);
    expect(url.origin + url.pathname).toBe('https://nominatim.test/search');
    expect(url.searchParams.get('countrycodes')).toBe('ng');
    expect(url.searchParams.get('viewbox')).toBeTruthy();
    expect((f.calls[0].init.headers as Record<string, string>)['User-Agent']).toBe('FindHouseQuick tests');
  });

  it('lists named amenities near a point under our own kinds, nearest first', async () => {
    const f = fake({
      elements: [
        { type: 'way', center: { lat: 6.41, lon: 5.61 }, tags: { amenity: 'bank', name: 'Zenith Bank' } },
        { type: 'node', lat: 6.401, lon: 5.61, tags: { amenity: 'school', name: 'Uniben Staff School' } },
        { type: 'node', lat: 6.4, lon: 5.61, tags: { amenity: 'school' } },
      ],
    });
    const osm = new OpenStreetMapAdapter(servers, 4000, f.fetch);
    const found = await osm.nearbyAmenities({ at: ugbowo, radiusMetres: 2000, kinds: ['school', 'bank'], limit: 10 });
    expect(found.map((a) => [a.kind, a.name])).toEqual([
      ['school', 'Uniben Staff School'],
      ['bank', 'Zenith Bank'],
    ]);
    const query = new URLSearchParams(String(f.calls[0].init.body)).get('data') ?? '';
    expect(query).toContain('nwr(around:2000,6.4,5.61)["amenity"="school"]["name"];');
    expect(query).toContain('["amenity"="bank"]');
    expect(query).not.toContain('pharmacy');
  });

  it('gives travel time and distance per destination, and nulls where there is no route', async () => {
    const f = fake({ code: 'Ok', durations: [[0, 754.2, null]], distances: [[0, 8120.4, null]] });
    const osm = new OpenStreetMapAdapter(servers, 4000, f.fetch);
    expect(await osm.travel({ from: ugbowo, to: [ringRoad, { lat: 0, lng: 0 }], mode: 'WALK' })).toEqual([
      { distanceM: 8120, minutes: 13 },
      { distanceM: null, minutes: null },
    ]);
    // Longitude comes first in the address, and the walking profile is used.
    expect(f.calls[0].url).toContain('https://osrm.test/table/v1/foot/5.61,6.4;5.622,6.335;0,0?sources=0');
  });

  it('reports the service as unavailable when routing fails or an address is missing', async () => {
    const failing = new OpenStreetMapAdapter(servers, 4000, fake({ code: 'NoTable' }).fetch);
    await expect(failing.travel({ from: ugbowo, to: [ringRoad], mode: 'DRIVE' })).rejects.toBeInstanceOf(MapsUnavailableError);
    const unset = new OpenStreetMapAdapter({ userAgent: 'x' }, 4000, fake([]).fetch);
    await expect(unset.searchPlaces({ text: 'x', countryCode: 'NG', limit: 5 })).rejects.toThrow(/no server address/);
  });
});

describe('maps: choosing the provider', () => {
  it('uses no provider unless one is set', () => {
    const maps = buildMaps(validateEnv(base));
    expect([maps.places.provider, maps.amenities.provider, maps.travel.provider]).toEqual(['none', 'none', 'none']);
  });

  it('sends every use to the provider named, and one use elsewhere when asked', () => {
    const env = validateEnv({
      ...base,
      MAPS_PROVIDER: 'openstreetmap',
      MAPS_TRAVEL_PROVIDER: 'google',
      GOOGLE_MAPS_API_KEY: 'test-key-123456',
      OSM_SEARCH_URL: 'https://nominatim.test',
      OSM_AMENITIES_URL: 'https://overpass.test/api/interpreter',
    });
    const maps = buildMaps(env);
    expect([maps.places.provider, maps.amenities.provider, maps.travel.provider]).toEqual(['openstreetmap', 'openstreetmap', 'google']);
    expect(maps.places).toBe(maps.amenities);
  });

  it('refuses to start when a chosen provider is missing its key or address', () => {
    expect(() => validateEnv({ ...base, MAPS_PROVIDER: 'google' })).toThrow(/GOOGLE_MAPS_API_KEY/);
    expect(() => validateEnv({ ...base, MAPS_PROVIDER: 'openstreetmap', OSM_SEARCH_URL: 'https://nominatim.test' })).toThrow(/OSM_AMENITIES_URL/);
    expect(() => validateEnv({ ...base, MAPS_PLACES_PROVIDER: 'openstreetmap' })).toThrow(/OSM_SEARCH_URL/);
    expect(() => validateEnv({ ...base, MAPS_PROVIDER: 'mapbox' })).toThrow();
  });
});
