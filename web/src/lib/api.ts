import { cookies, headers } from 'next/headers';
import type { Controls, ListingPage, PopularArea, Related, SearchResult } from './types';

const API = (process.env.API_BASE_URL ?? 'http://localhost:3000/v1').replace(/\/$/, '');
export const SITE_COUNTRY = (process.env.SITE_COUNTRY ?? '').toUpperCase();
export const DEVICE_COOKIE = 'fhq_device';

/** An answer from the API that is not a success: its status and its machine-readable code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

/**
 * Reads from the API on the visitor's behalf. The visitor's network address and device id are passed on, so the
 * API's viewing limits (decision 52) count each visitor separately and not the web server as one very busy visitor.
 * Nothing is cached: photo links expire after 15 minutes and listings change.
 */
async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const incoming = await headers();
  const device = (await cookies()).get(DEVICE_COOKIE)?.value ?? incoming.get('x-fhq-device');
  const pass: Record<string, string> = { Accept: 'application/json' };
  const forwarded = incoming.get('x-forwarded-for');
  if (forwarded) pass['X-Forwarded-For'] = forwarded;
  if (device) pass['X-Device-Id'] = device;
  if (SITE_COUNTRY) pass['X-Country'] = SITE_COUNTRY;

  const res = await fetch(url, { headers: pass, cache: 'no-store' });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; retryAfterSeconds?: number };
    throw new ApiError(res.status, body.code ?? 'ERROR', body.message ?? res.statusText, body.retryAfterSeconds);
  }
  return (await res.json()) as T;
}

export interface SearchParams {
  city?: string;
  area?: string;
  category?: string;
  minRent?: string;
  maxRent?: string;
  minBedrooms?: string;
  furnished?: string;
  sort?: string;
  cursor?: string;
}

export const searchListings = (p: SearchParams) => get<SearchResult>('/search/listings', { ...p });
export const popularAreas = (city: string | undefined, limit = 10) => get<PopularArea[]>('/search/areas', { city, limit });
export const listing = (id: string) => get<ListingPage>(`/listings/${id}`);
export const related = (id: string) => get<Related>(`/listings/${id}/related`, { limit: 4 });
export const controls = () => get<Controls>('/controls');
