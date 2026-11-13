import { describe, expect, it, vi } from 'vitest';
import { buildMapTiles, type MapsSettings } from './maps.module.js';
import { GoogleTiles } from './map-tiles.js';

const aud = { language: 'en', region: 'NG' };
const base = { MAPS_PROVIDER: 'none', MAPS_TIMEOUT_MS: 5000, OSM_TILES_ATTRIBUTION: '© OpenStreetMap contributors' } as MapsSettings;

describe('map tiles', () => {
  it('gives no source when no provider is set', async () => {
    expect(await buildMapTiles(base).source(aud)).toBeNull();
  });

  it('follows MAPS_PROVIDER, and MAPS_TILES_PROVIDER overrides it', async () => {
    const osm = buildMapTiles({ ...base, MAPS_PROVIDER: 'openstreetmap', OSM_TILES_URL: 'https://t.example.com/{z}/{x}/{y}.png' });
    expect(await osm.source(aud)).toMatchObject({ provider: 'openstreetmap', urlTemplate: 'https://t.example.com/{z}/{x}/{y}.png', expiresAt: null });
    const none = buildMapTiles({ ...base, MAPS_PROVIDER: 'openstreetmap', MAPS_TILES_PROVIDER: 'none' });
    expect(await none.source(aud)).toBeNull();
    const noUrl = buildMapTiles({ ...base, MAPS_PROVIDER: 'openstreetmap' });
    expect(await noUrl.source(aud)).toBeNull();
  });

  it('makes one Google session and reuses it until a day before it runs out', async () => {
    const expiry = String(Math.floor(Date.now() / 1000) + 14 * 24 * 3600);
    const doFetch = vi.fn(async () => new Response(JSON.stringify({ session: 'abc', expiry }), { status: 200 }));
    const tiles = new GoogleTiles('key-1234567890', 5000, doFetch as unknown as typeof fetch);
    const first = await tiles.source(aud);
    await tiles.source(aud);
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(first?.urlTemplate).toContain('/v1/2dtiles/{z}/{x}/{y}?session=abc');
    expect(first?.provider).toBe('google');
  });
});
