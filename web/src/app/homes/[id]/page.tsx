import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Gallery } from '@/components/Gallery';
import { Icon } from '@/components/Icon';
import { ListingCardView } from '@/components/ListingCardView';
import { MoreFrom } from '@/components/MoreFrom';
import { ShareButton } from '@/components/ShareButton';
import { Shell, switches } from '@/components/Shell';
import { ApiError, listing, related } from '@/lib/api';
import { count, date, floor, label, money, period, plain } from '@/lib/format';
import { homesUrl, links } from '@/lib/links';
import type { FeeLine, ListingPage } from '@/lib/types';

/** Page 108, the listing page: built for each request, since photo links expire and viewing is counted. */
export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEE_NAMES: Record<FeeLine['type'], string> = {
  AGENCY_FEE: 'Agency fee',
  LEGAL_FEE: 'Legal or agreement fee',
  CAUTION_DEPOSIT: 'Caution deposit',
  SERVICE_CHARGE: 'Service charge',
};

type Loaded = { home: ListingPage } | { limit: true } | null;

/** The listing, once per request for both the page and its title. Counts as one view at the API (decision 52). */
const load = cache(async (id: string): Promise<Loaded> => {
  if (!ID.test(id)) return null;
  try {
    return { home: await listing(id) };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    if (e instanceof ApiError && e.status === 429) return { limit: true };
    throw e;
  }
});

const headline = (h: ListingPage) => `${h.title} in ${h.area}, ${h.city}`;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = await load(id);
  if (!found || !('home' in found)) return { title: 'Home to rent', robots: { index: false } };
  const h = found.home;
  const description = `${h.title} to rent in ${h.area}, ${h.city}: ${money(h.rent)} ${period(h.rentPeriod, 'long')}. ${h.description}`.slice(0, 300);
  return {
    title: headline(h),
    description,
    alternates: { canonical: `/homes/${h.id}` },
    // The photo is not offered to other sites: its link expires, and photos stay on their own listing (decision 76).
    openGraph: { title: headline(h), description, url: `/homes/${h.id}` },
  };
}

export default async function ListingPageView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [found, on] = await Promise.all([load(id), switches()]);
  if (!found) notFound();
  const here = `/homes/${id}`;

  if ('limit' in found) {
    return (
      <Shell on={on} backTo={here}>
        <div className="card empty">
          <h2>Sign in to keep viewing homes</h2>
          <p className="muted">You have opened a great many homes this hour. Create a free account or sign in to carry on.</p>
          <p style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="button button--primary" href={links.createAccount(here)}>
              Create a free account
            </a>
            <a className="button button--outline" href={links.signIn(here)}>
              Sign in
            </a>
          </p>
        </div>
      </Shell>
    );
  }

  const h = found.home;
  const more = await related(id).catch(() => ({ similar: [], nearby: [] }));
  const photos = h.gallery.flatMap((g) => g.media.map((m) => ({ ...m, partLabel: g.partLabel }))).filter((m) => m.display);
  const mosaic = photos.slice(0, 5);
  const verified = h.badges.length > 0;
  const details = Object.entries(h.unit.details ?? {}).filter(([, v]) => plain(v));
  const allowed = plain(h.occupancyRules?.allowed);
  const facts: [string, string][] = [
    ['Bedrooms', String(h.bedrooms)],
    ['Bathrooms', String(h.bathrooms)],
    ['Toilets', String(h.unit.toilets)],
    ['Floor', floor(h.unit.floorLevel)],
    ['Floor area', h.unit.floorArea ? `${h.unit.floorArea} ${h.unit.areaUnit === 'SQFT' ? 'sq ft' : 'm²'}` : ''],
    ['Available from', date(h.availableFrom)],
    ['Photos taken', date(h.photosTakenAt)],
  ];
  // What search engines read about the home; no address or position beyond the area (Specification 4.3).
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'Accommodation',
    name: headline(h),
    description: h.description,
    numberOfBedrooms: h.bedrooms,
    numberOfBathroomsTotal: h.bathrooms,
    address: { '@type': 'PostalAddress', addressLocality: h.city, addressRegion: h.region },
  };

  return (
    <Shell on={on} backTo={here}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replaceAll('<', '\\u003c') }} />
      <nav aria-label="You are here">
        <ol className="crumbs">
          <li>
            <Link href="/homes">Home</Link>
          </li>
          <li>
            <Link href={homesUrl({ city: h.city })}>{h.city}</Link>
          </li>
          <li>
            <Link href={homesUrl({ city: h.city, area: h.area })}>{h.area}</Link>
          </li>
          <li aria-current="page">{h.title}</li>
        </ol>
      </nav>

      <div className="page-head">
        <div>
          <h1 className="page-title">{headline(h)}</h1>
          <p className="where">
            <Icon name="pin" />
            {h.area}, {h.city} (approximate area)
          </p>
        </div>
        <div className="page-head__actions">
          <a className="chip" href={links.signIn(here)}>
            Save
          </a>
          <ShareButton title={headline(h)} />
          <a className="chip" href={links.signIn(here)}>
            Compare
          </a>
          <a className="chip" href={links.signIn(here)}>
            Report
          </a>
        </div>
      </div>

      {mosaic.length > 0 && (
        <div className="mosaic">
          {mosaic.map((m, i) => {
            const last = i === 4 && photos.length > 5;
            return (
              <a key={m.id} href="#photos" className={last ? 'mosaic__all' : undefined} aria-label={last ? `See all ${photos.length} photos` : m.partLabel}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={(i === 0 ? m.display?.large : m.display?.medium) ?? m.display?.small ?? ''} alt={last ? '' : m.partLabel} />
                {last && <span>See all {photos.length} photos</span>}
              </a>
            );
          })}
        </div>
      )}

      <div className="detail">
        <div className="detail__main">
          <div className="card box">
            <div className="chips">
              {verified && (
                <span className="badge badge--verified">
                  <Icon name="shield" size={16} />
                  Verified lister
                </span>
              )}
              <span className="badge badge--free">
                <Icon name="home" size={16} />
                Inspections are free
              </span>
            </div>
            <dl className="facts">
              {facts
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
          </div>

          {h.gallery.length > 0 && (
            <div className="card box">
              <h2 className="box__title">Photos by room</h2>
              <p className="muted">Every part of the home, photographed on site through the FindHouseQuick app.</p>
              <Gallery parts={h.gallery} />
            </div>
          )}

          {(details.length > 0 || allowed) && (
            <div className="card box">
              <h2 className="box__title">Key details</h2>
              <dl className="details">
                {details.map(([k, v]) => (
                  <div key={k}>
                    <dt>{label(k)}</dt>
                    <dd>{plain(v)}</dd>
                  </div>
                ))}
                {allowed && (
                  <div>
                    <dt>Who can rent</dt>
                    <dd>{[allowed, h.occupancyRules?.notes].filter(Boolean).join('; ')}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="card box">
            <h2 className="box__title">About this home</h2>
            <p className="prose">{h.description}</p>
          </div>

          <div className="card box">
            <h2 className="box__title">Location</h2>
            <div className="map">
              <div>
                <span className="map__circle" />
                Approximate area: {h.area}, {h.city}
              </div>
            </div>
            <p className="muted">The exact address and directions are shared once an inspection is confirmed.</p>
            {h.nearbyAmenities.length > 0 && (
              <>
                <h3 className="tile__title">Nearby</h3>
                <div className="chips">
                  {h.nearbyAmenities.map((a) => (
                    <span key={a.name} className="chip chip--static">
                      {a.name}
                      {a.distanceM ? `, ${a.distanceM >= 1000 ? `${(a.distanceM / 1000).toFixed(1)} km` : `${a.distanceM} m`}` : ''}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="detail__side">
          <div className="card box">
            <p className="rent">
              {money(h.rent)} <span className="price__period">{period(h.rentPeriod, 'long')}</span>
            </p>
            <h2 className="tile__title">{h.kind === 'SHORT_LET' ? 'What you pay' : 'Total to move in'}</h2>
            <dl className="cost">
              <div>
                <dt>Rent ({period(h.rentPeriod, 'long').replace('per ', '1 ')})</dt>
                <dd>{money(h.moveInCost.rent)}</dd>
              </div>
              {h.moveInCost.fees.map((f) => (
                <div key={f.type}>
                  <dt>
                    {FEE_NAMES[f.type]}
                    {f.type === 'SERVICE_CHARGE' && h.serviceChargeCovers ? ` (${h.serviceChargeCovers})` : ''}
                  </dt>
                  <dd>{money(f.amount)}</dd>
                </div>
              ))}
              <div className="cost__total">
                <dt>{h.kind === 'SHORT_LET' ? 'Total' : 'Total to move in'}</dt>
                <dd>{money(h.moveInCost.total)}</dd>
              </div>
            </dl>
            <p className="note note--free">
              <Icon name="home" />
              Inspections are free. No fee may be charged that is not shown here.
            </p>
          </div>

          <div className="card box">
            <a className="button button--primary button--wide" href={links.signIn(here)}>
              Book a free inspection
            </a>
            <a className="button button--outline button--wide" href={links.signIn(here)}>
              Chat with the lister
            </a>
            <p className="note note--locked">
              <Icon name="lock" />
              <span>
                <strong>{verified ? 'Verified lister' : 'Lister'}</strong>
                Sign in or create a free account to see who is letting this home and to contact them.
              </span>
            </p>
          </div>

          {on.alerts && (
            <div className="card panel panel--tint">
              <h2 className="panel__title">
                <Icon name="bell" />
                Homes like this go quickly
              </h2>
              <p>Get an alert when a similar home is listed in {h.area}.</p>
              <a className="button button--outline button--wide" href={links.createAccount(homesUrl({ city: h.city, area: h.area }))}>
                Get alerts for {h.area}
              </a>
            </div>
          )}
        </aside>
      </div>

      {more.similar.length > 0 && (
        <section className="section">
          <div className="section__head">
            <div>
              <h2 className="section__title">Similar homes nearby</h2>
              <p>
                {h.bedrooms > 0 ? `${count(h.bedrooms, 'bedroom', 'bedroom')} homes` : h.propertyTypeLabel} at a similar rent
              </p>
            </div>
            <Link className="link" href={homesUrl({ city: h.city, beds: h.bedrooms > 0 ? String(h.bedrooms) : undefined })}>
              See all similar homes
            </Link>
          </div>
          <div className="grid grid--4">
            {more.similar.map((card) => (
              <ListingCardView key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {more.nearby.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">More homes in {h.area}</h2>
            <Link className="link" href={homesUrl({ city: h.city, area: h.area })}>
              See all homes in {h.area}
            </Link>
          </div>
          <div className="grid grid--4">
            {more.nearby.map((card) => (
              <ListingCardView key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      <MoreFrom scouts={on.scouts} third="LIST" />
    </Shell>
  );
}
