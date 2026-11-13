import { callJson, type Fetch } from './maps-provider.js';

/**
 * Where the apps fetch the map picture from (decision 81). The picture is made of square images ("tiles") at each
 * zoom level; the apps draw them with their pins on top. One kind of source serves both providers, so the apps have
 * one map, whichever provider the server names.
 */
export interface TileSource {
  provider: 'google' | 'openstreetmap';
  /** With {z}, {x} and {y} in it, as map libraries expect. */
  urlTemplate: string;
  /** The credit the provider requires on the map, e.g. "© OpenStreetMap contributors". */
  attribution: string;
  maxZoom: number;
  /** Until when the address works; the apps ask again after it. Null when it does not run out. */
  expiresAt: string | null;
}

export interface MapTiles {
  readonly provider: string;
  source(): Promise<TileSource | null>;
}

export class NoTiles implements MapTiles {
  readonly provider = 'none';
  source(): Promise<TileSource | null> {
    return Promise.resolve(null);
  }
}

/** A tile host serving OpenStreetMap data (a paid host, or the company's own server). */
export class OpenStreetMapTiles implements MapTiles {
  readonly provider = 'openstreetmap';
  constructor(
    private readonly urlTemplate: string,
    private readonly attribution: string,
  ) {}

  source(): Promise<TileSource | null> {
    return Promise.resolve({ provider: 'openstreetmap', urlTemplate: this.urlTemplate, attribution: this.attribution, maxZoom: 19, expiresAt: null });
  }
}

/**
 * Google's Map Tiles API. A "session" (Google's word for a set of map settings) is made by the server and lasts about
 * two weeks; the apps then fetch tiles with it. The key used here is a separate one, made only for map tiles and
 * limited in the Google Cloud console to the Map Tiles API and our app and website, because it is seen by the apps.
 */
export class GoogleTiles implements MapTiles {
  readonly provider = 'google';
  private cached: TileSource | null = null;

  constructor(
    private readonly key: string,
    private readonly language: string,
    private readonly region: string,
    private readonly timeoutMs: number,
    private readonly doFetch: Fetch = fetch,
  ) {}

  async source(): Promise<TileSource | null> {
    // Made again a day before it runs out.
    if (this.cached?.expiresAt && Date.parse(this.cached.expiresAt) - Date.now() > 24 * 3600 * 1000) return this.cached;
    const answer = (await callJson(
      this.provider,
      this.doFetch,
      `https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(this.key)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapType: 'roadmap', language: this.language, region: this.region }) },
      this.timeoutMs,
    )) as { session?: string; expiry?: string };
    if (!answer.session) return null;
    const expiresAt = answer.expiry ? new Date(Number(answer.expiry) * 1000).toISOString() : null;
    this.cached = {
      provider: 'google',
      urlTemplate: `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${encodeURIComponent(answer.session)}&key=${encodeURIComponent(this.key)}`,
      attribution: 'Map data © Google',
      maxZoom: 21,
      expiresAt,
    };
    return this.cached;
  }
}
