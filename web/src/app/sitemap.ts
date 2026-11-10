import type { MetadataRoute } from 'next';
import { popularAreas, searchListings } from '@/lib/api';
import { homesUrl, SITE } from '@/lib/links';

export const dynamic = 'force-dynamic';
/** How many pages of the newest listings (20 each) go into the sitemap. */
const PAGES = 25;

/** The list of pages for search engines: the search page, each popular area, and the newest live listings. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [{ url: `${SITE}/homes`, changeFrequency: 'hourly' }];
  try {
    for (const a of await popularAreas(undefined, 30)) entries.push({ url: `${SITE}${homesUrl({ city: a.city, area: a.area })}`.replaceAll('&', '&amp;'), changeFrequency: 'daily' });
    let cursor: string | undefined;
    for (let page = 0; page < PAGES; page++) {
      const res = await searchListings({ sort: 'NEWEST', cursor });
      for (const l of res.items) entries.push({ url: `${SITE}/homes/${l.id}`, lastModified: l.publishedAt ?? undefined, changeFrequency: 'daily' });
      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }
  } catch {
    // If the API cannot be reached, the sitemap still lists the search page.
  }
  return entries;
}
