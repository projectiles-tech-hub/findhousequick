import { site } from '@/lib/site';
import { ng } from './ng';
import type { CountryContent } from './types';

const BY_COUNTRY: Record<string, CountryContent> = { NG: ng };

/** The help and legal text for the country this website is shown for (SITE_COUNTRY), or null when none is written yet. */
export function content(): CountryContent | null {
  return BY_COUNTRY[site.country] ?? null;
}
