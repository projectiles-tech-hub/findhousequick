import {
  callJson,
  metresBetween,
  MapsUnavailableError,
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

/** Our amenity kinds as OpenStreetMap tags (key and value). */
const OSM_TAGS: Record<AmenityKind, [string, string][]> = {
  school: [['amenity', 'school'], ['amenity', 'university'], ['amenity', 'college']],
  hospital: [['amenity', 'hospital'], ['amenity', 'clinic']],
  pharmacy: [['amenity', 'pharmacy']],
  market: [['amenity', 'marketplace'], ['shop', 'supermarket']],
  bank: [['amenity', 'bank']],
  fuel_station: [['amenity', 'fuel']],
  bus_stop: [['highway', 'bus_stop'], ['amenity', 'bus_station']],
  place_of_worship: [['amenity', 'place_of_worship']],
  police: [['amenity', 'police']],
};

export interface OpenStreetMapServers {
  /** A Nominatim server (place search), e.g. https://nominatim.example.com */
  searchUrl?: string;
  /** An Overpass API address (amenities), e.g. https://overpass.example.com/api/interpreter */
  amenitiesUrl?: string;
  /** An OSRM server (travel times), e.g. https://osrm.example.com */
  routesUrl?: string;
  /** Sent with every request so the server's operator knows who is calling, as OpenStreetMap services ask. */
  userAgent: string;
}

/**
 * OpenStreetMap (decision 81). The map data is free, but something must serve it: Nominatim for place search,
 * Overpass for amenities and OSRM for travel times. Each address is a setting, so they can be a paid host or servers
 * the company runs itself. The public servers of the OpenStreetMap project are for light use only and must not carry
 * a live platform's traffic. A use whose address is not set cannot be given to this adapter (checked at start-up).
 */
export class OpenStreetMapAdapter implements MapsProvider {
  readonly provider = 'openstreetmap';

  constructor(
    private readonly servers: OpenStreetMapServers,
    private readonly timeoutMs: number,
    private readonly doFetch: Fetch = fetch,
  ) {}

  private url(base: string | undefined, use: string): string {
    if (!base) throw new MapsUnavailableError(this.provider, `no server address is set for ${use}`);
    return base.replace(/\/+$/, '');
  }

  private get headers(): Record<string, string> {
    return { 'User-Agent': this.servers.userAgent, Accept: 'application/json' };
  }

  async searchPlaces(query: PlaceQuery): Promise<Place[]> {
    const params = new URLSearchParams({
      q: query.text,
      format: 'jsonv2',
      limit: String(Math.min(query.limit, 40)),
      countrycodes: query.countryCode.toLowerCase(),
    });
    if (query.near) {
      // Prefer results inside a box of about 30 km around the point, without shutting out the rest of the country.
      const d = 0.27;
      params.set('viewbox', [query.near.lng - d, query.near.lat + d, query.near.lng + d, query.near.lat - d].join(','));
    }
    const answer = await callJson(this.provider, this.doFetch, `${this.url(this.servers.searchUrl, 'place search')}/search?${params}`, { headers: this.headers }, this.timeoutMs);
    const places: Place[] = [];
    for (const p of (Array.isArray(answer) ? answer : []) as { name?: string; display_name?: string; lat?: string; lon?: string }[]) {
      const lat = Number.parseFloat(p.lat ?? '');
      const lng = Number.parseFloat(p.lon ?? '');
      const full = p.display_name ?? '';
      const name = p.name || full.split(',')[0]?.trim();
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) continue;
      const rest = full.startsWith(`${name},`) ? full.slice(name.length + 1).trim() : full;
      places.push({ name, description: rest, location: { lat, lng } });
    }
    return places;
  }

  async nearbyAmenities(query: AmenityQuery): Promise<Amenity[]> {
    if (query.kinds.length === 0) return [];
    const around = `(around:${Math.round(query.radiusMetres)},${query.at.lat},${query.at.lng})`;
    const filters = query.kinds.flatMap((k) => OSM_TAGS[k].map(([key, value]) => `nwr${around}["${key}"="${value}"]["name"];`)).join('');
    const answer = (await callJson(
      this.provider,
      this.doFetch,
      this.url(this.servers.amenitiesUrl, 'amenities'),
      {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: `[out:json][timeout:${Math.max(1, Math.floor(this.timeoutMs / 1000))}];(${filters});out center;` }).toString(),
      },
      this.timeoutMs,
    )) as { elements?: { lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string> }[] };
    const found: Amenity[] = [];
    for (const e of answer.elements ?? []) {
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;
      const name = e.tags?.name;
      const kind = query.kinds.find((k) => OSM_TAGS[k].some(([key, value]) => e.tags?.[key] === value));
      if (typeof lat !== 'number' || typeof lng !== 'number' || !name || !kind) continue;
      found.push({ kind, name, location: { lat, lng }, distanceM: metresBetween(query.at, { lat, lng }) });
    }
    return found.sort((a, b) => a.distanceM - b.distanceM).slice(0, query.limit);
  }

  async travel(query: TravelQuery): Promise<Travel[]> {
    if (query.to.length === 0) return [];
    const points = [query.from, ...query.to].map((p) => `${p.lng},${p.lat}`).join(';');
    const profile = query.mode === 'WALK' ? 'foot' : 'driving';
    const answer = (await callJson(
      this.provider,
      this.doFetch,
      `${this.url(this.servers.routesUrl, 'travel times')}/table/v1/${profile}/${points}?sources=0&annotations=duration,distance`,
      { headers: this.headers },
      this.timeoutMs,
    )) as { code?: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
    if (answer.code !== 'Ok') throw new MapsUnavailableError(this.provider, `routing answered ${String(answer.code)}`);
    // The first entry of each row is the starting point to itself.
    return query.to.map((_, i) => {
      const seconds = answer.durations?.[0]?.[i + 1];
      const metres = answer.distances?.[0]?.[i + 1];
      if (typeof seconds !== 'number') return { distanceM: null, minutes: null };
      return { distanceM: typeof metres === 'number' ? Math.round(metres) : null, minutes: Math.max(1, Math.round(seconds / 60)) };
    });
  }
}
