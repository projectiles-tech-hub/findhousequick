import { createHash } from 'node:crypto';
import type { LatLng } from '../common/geo.js';

/**
 * The position shown for a listing before an inspection is confirmed (Specification 4.3): the building's position
 * moved by between 40% and 100% of `metres`, in a direction and distance taken from the listing's id. The same listing
 * always lands in the same place, so the true spot cannot be worked out by averaging many requests.
 */
export function approximateLocation(listingId: string, actual: LatLng, metres: number): LatLng {
  const h = createHash('sha256').update(`fhq-approx:${listingId}`).digest();
  const angle = (h.readUInt32BE(0) / 0xffffffff) * 2 * Math.PI;
  const distance = metres * (0.4 + 0.6 * (h.readUInt32BE(4) / 0xffffffff));
  const dLat = (distance * Math.cos(angle)) / 111_320;
  const dLng = (distance * Math.sin(angle)) / (111_320 * Math.cos((actual.lat * Math.PI) / 180));
  return { lat: round6(actual.lat + dLat), lng: round6(actual.lng + dLng) };
}

/** Distances are shown to the nearest 100 metres, so they do not give away the exact spot either. */
export function roundedDistance(metres: number): number {
  return Math.max(100, Math.round(metres / 100) * 100);
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
