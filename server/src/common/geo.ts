import { Prisma } from '../generated/prisma/client.js';

/** A point on the earth in WGS 84 (the system phone GPS uses). */
export interface LatLng {
  lat: number;
  lng: number;
}

export function assertValidLatLng({ lat, lng }: LatLng): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new RangeError(`Invalid latitude: ${lat}`);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new RangeError(`Invalid longitude: ${lng}`);
}

/**
 * SQL fragment for a PostGIS geography point. Prisma cannot write geography columns directly,
 * so location values are written with raw SQL using this helper. Values are bound as parameters.
 */
export function geographyPoint(point: LatLng): Prisma.Sql {
  assertValidLatLng(point);
  return Prisma.sql`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography`;
}
