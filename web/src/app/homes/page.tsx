import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ListingCardView } from '@/components/ListingCardView';
import { MoreFrom } from '@/components/MoreFrom';
import { Shell, switches } from '@/components/Shell';
import { popularAreas, searchListings } from '@/lib/api';
import { plain, toMinor } from '@/lib/format';
import { homesUrl, links, type Query } from '@/lib/links';

/** Page 107, search results: built for each request, since listings and their photo links change. */
export const dynamic = 'force-dynamic';

const SORTS = { NEWEST: 'Newest first', PRICE_ASC: 'Lowest rent first', PRICE_DESC: 'Highest rent first' } as const;
const CATEGORIES = { LONG_TERM_RESIDENTIAL: 'Homes', COMMERCIAL: 'Shops and offices', SHORT_LET: 'Short lets' } as const;
const WEEK_MS = 7 * 86_400_000;

type Params = Promise<Record<string, string | string[] | undefined>>;

/** The filters in the address, each as one piece of text. */
async function read(searchParams: Params): Promise<Query> {
  const raw = await searchParams;
  const one = (k: string) => {
    const v = raw[k];
    return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 80) || undefined;
  };
  return {
    city: one('city'),
    area: one('area'),
    category: one('category') && one('category')! in CATEGORIES ? one('category') : undefined,
    min: /^\d{1,13}$/.test(one('min') ?? '') ? one('min') : undefined,
    max: /^\d{1,13}$/.test(one('max') ?? '') ? one('max') : undefined,
    beds: /^\d{1,2}$/.test(one('beds') ?? '') ? one('beds') : undefined,
    furnished: /^[A-Z_]{1,40}$/.test(one('furnished') ?? '') ? one('furnished') : undefined,
    sort: one('sort') && one('sort')! in SORTS ? one('sort') : undefined,
    cursor: one('cursor'),
  };
}

const place = (q: Query) => [q.area, q.city].filter(Boolean).join(', ');
const heading = (q: Query) => {
  const what = q.category === 'COMMERCIAL' ? 'Shops and offices to rent' : q.category === 'SHORT_LET' ? 'Short lets' : 'Homes to rent';
  return place(q) ? `${what} in ${place(q)}` : what;
};

export async function generateMetadata({ searchParams }: { searchParams: Params }): Promise<Metadata> {
  const q = await read(searchParams);
  const { cursor: _cursor, sort: _sort, ...canonical } = q;
  return {
    title: heading(q),
    description: `${heading(q)}, from landlords and agents whose identity we have checked. See the rent and every fee before you call. Inspections are always free.`,
    alternates: { canonical: homesUrl(canonical) },
    // Filtered and later pages are for visitors; search engines keep the plain page of each place.
    robots: q.cursor || q.min || q.max || q.beds || q.furnished ? { index: false, follow: true } : undefined,
  };
}

export default async function HomesPage({ searchParams }: { searchParams: Params }) {
  const q = await read(searchParams);
  const on = await switches();
  const here = homesUrl(q);
  const filters = {
    city: q.city,
    area: q.area,
    category: q.category,
    minRent: on.currency ? toMinor(q.min, on.currency) : undefined,
    maxRent: on.currency ? toMinor(q.max, on.currency) : undefined,
    minBedrooms: q.beds,
    furnished: q.furnished,
  };
  const firstPage = !q.cursor;
  const [results, newest, areas] = await Promise.all([
    searchListings({ ...filters, sort: q.sort, cursor: q.cursor }),
    firstPage ? searchListings({ city: q.city, sort: 'NEWEST' }).catch(() => null) : null,
    firstPage ? popularAreas(q.city).catch(() => []) : [],
  ]);
  // "Newly listed": homes added in the last 7 days, wherever they are in the city.
  const fresh = (newest?.items ?? []).filter((c) => c.publishedAt && Date.now() - Date.parse(c.publishedAt) < WEEK_MS).slice(0, 4);
  const where = q.city ?? 'your area';
  /** The same search with some filters changed; changing a filter goes back to the first page. */
  const withFilter = (change: Query) => homesUrl({ ...q, cursor: undefined, ...change });

  return (
    <Shell on={on} query={q.area} backTo={here}>
      <nav aria-label="You are here">
        <ol className="crumbs">
          <li>
            <Link href="/homes">Home</Link>
          </li>
          {results.items[0] && q.city && <li>{results.items[0].region}</li>}
          {q.city && (
            <li>
              <Link href={homesUrl({ city: q.city })}>{q.city}</Link>
            </li>
          )}
          {q.area && <li>{q.area}</li>}
          <li aria-current="page">{q.category ? CATEGORIES[q.category as keyof typeof CATEGORIES] : 'Homes to rent'}</li>
        </ol>
      </nav>

      <div className="page-head">
        <div>
          <h1 className="page-title">{heading(q)}</h1>
          <p>
            {results.total === 1 ? '1 home' : `${results.total.toLocaleString('en')} homes`}, every lister identity-checked. Inspections are always free.
          </p>
        </div>
        <details className="menu">
          <summary className="chip">Sort: {SORTS[(q.sort ?? 'NEWEST') as keyof typeof SORTS]}</summary>
          <div className="card menu__list" style={{ left: 'auto', right: 0 }}>
            {Object.entries(SORTS).map(([key, text]) => (
              <Link key={key} href={withFilter({ sort: key === 'NEWEST' ? undefined : key })} aria-current={(q.sort ?? 'NEWEST') === key}>
                {text}
              </Link>
            ))}
          </div>
        </details>
      </div>

      <div className="filters chips">
        {(Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[])
          .filter((c) => c === 'LONG_TERM_RESIDENTIAL' || (c === 'COMMERCIAL' ? on.commercial : on.shortLets))
          .map((c) => (
            <Link key={c} className={`chip${q.category === c ? ' chip--on' : ''}`} href={withFilter({ category: q.category === c ? undefined : c })}>
              {CATEGORIES[c]}
            </Link>
          ))}
        {on.currency && (
          <details className="menu">
            <summary className={`chip${q.min || q.max ? ' chip--on' : ''}`}>{q.min || q.max ? 'Price set' : 'Any price'}</summary>
            <form className="card menu__list" action="/homes" style={{ minWidth: 260, gap: 12, padding: 16 }}>
              {Object.entries({ ...q, cursor: undefined, min: undefined, max: undefined }).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
              <label className="muted">
                Lowest rent ({on.currency})
                <input className="field" name="min" inputMode="numeric" pattern="\d*" defaultValue={q.min} />
              </label>
              <label className="muted">
                Highest rent ({on.currency})
                <input className="field" name="max" inputMode="numeric" pattern="\d*" defaultValue={q.max} />
              </label>
              <button className="button button--primary" type="submit">
                Show homes
              </button>
            </form>
          </details>
        )}
        <details className="menu">
          <summary className={`chip${q.beds ? ' chip--on' : ''}`}>{q.beds ? `${q.beds}+ bedrooms` : 'Bedrooms'}</summary>
          <div className="card menu__list">
            <Link href={withFilter({ beds: undefined })} aria-current={!q.beds}>
              Any
            </Link>
            {['1', '2', '3', '4', '5'].map((n) => (
              <Link key={n} href={withFilter({ beds: n })} aria-current={q.beds === n}>
                {n} or more
              </Link>
            ))}
          </div>
        </details>
        {on.furnishing.length > 0 && (
          <details className="menu">
            <summary className={`chip${q.furnished ? ' chip--on' : ''}`}>{q.furnished ? plain(q.furnished) : 'Furnished'}</summary>
            <div className="card menu__list">
              <Link href={withFilter({ furnished: undefined })} aria-current={!q.furnished}>
                Any
              </Link>
              {on.furnishing.map((f) => (
                <Link key={f} href={withFilter({ furnished: f })} aria-current={q.furnished === f}>
                  {plain(f)}
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="results">
        <div>
          {results.items.length ? (
            <div className="grid grid--3">
              {results.items.map((card) => (
                <ListingCardView key={card.id} card={card} />
              ))}
            </div>
          ) : (
            <div className="card empty">
              <h2>No homes match this search yet</h2>
              <p className="muted">Try a wider area or fewer filters. New homes are added every day.</p>
            </div>
          )}
          {results.nextCursor && (
            <p className="more">
              <span>
                Showing {results.items.length} of {results.total.toLocaleString('en')} homes
              </span>
              <Link className="button button--outline" href={homesUrl({ ...q, cursor: results.nextCursor })}>
                Show more homes
              </Link>
            </p>
          )}
        </div>

        <aside className="side">
          {on.alerts && (
            <div className="card panel">
              <h2 className="panel__title">
                <Icon name="bell" />
                Get alerts for this search
              </h2>
              <p>We tell you the moment a new home in {where} matches this search.</p>
              <a className="button button--primary button--wide" href={links.createAccount(here)}>
                Create a free account
              </a>
              <a className="link" href={links.signIn(here)}>
                Already have an account? Sign in
              </a>
            </div>
          )}
          <div className="card panel">
            <h2 className="panel__title">Why rent on FindHouseQuick</h2>
            <ul className="reasons">
              <li>
                <Icon name="shield" />
                Every landlord and agent has proved who they are
              </li>
              <li>
                <Icon name="home" />
                Inspections are always free. Report anyone who asks you to pay
              </li>
              <li>
                <Icon name="cash" />
                Rent and every fee are shown before you call
              </li>
              <li>
                <Icon name="image" />
                Photos taken on site, room by room
              </li>
            </ul>
          </div>
          <div className="card panel panel--tint">
            <h2 className="panel__title">{q.city ? `Own a property in ${q.city}?` : 'Own a property?'}</h2>
            <p>List it for free. Tenants who have proved who they are contact you directly, with no middlemen.</p>
            <a className="button button--primary button--wide" href={links.listProperty()}>
              List your property
            </a>
            {on.scouts && (
              <a className="link" href={links.becomeScout()}>
                Know a vacant property? Become a scout and earn a reward when it is rented.
              </a>
            )}
          </div>
        </aside>
      </div>

      {fresh.length > 0 && (
        <section className="section">
          <div className="section__head">
            <div>
              <h2 className="section__title">{q.city ? `Newly listed in ${q.city}` : 'Newly listed'}</h2>
              <p>Added in the last 7 days</p>
            </div>
            <Link className="link" href={homesUrl({ city: q.city })}>
              See all new homes
            </Link>
          </div>
          <div className="grid grid--4">
            {fresh.map((card) => (
              <ListingCardView key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {areas.length > 0 && (
        <section className="section">
          <div className="section__head">
            <div>
              <h2 className="section__title">{q.city ? `Popular areas in ${q.city}` : 'Popular areas'}</h2>
              <p>Homes to rent by area</p>
            </div>
          </div>
          <div className="chips">
            {areas.map((a) => (
              <Link key={`${a.city}/${a.area}`} className="chip" href={homesUrl({ city: a.city, area: a.area })}>
                {a.area} ({a.count})
              </Link>
            ))}
          </div>
        </section>
      )}

      <MoreFrom scouts={on.scouts} third="MANAGE" />
    </Shell>
  );
}
