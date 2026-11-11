import Link from 'next/link';
import { count, money, period } from '@/lib/format';
import { links } from '@/lib/links';
import type { ListingCard } from '@/lib/types';
import { Icon } from './Icon';

/** One home in a grid: photo, rent, type, area, rooms and the verified badge. The heart leads to sign-in (decision 75). */
export function ListingCardView({ card }: { card: ListingCard }) {
  const href = `/homes/${card.id}`;
  const verified = card.badges.includes('OWNER_VERIFIED') || card.badges.includes('AUTHORITY_VERIFIED');
  return (
    <article className="card listing">
      <Link href={href} className="listing__photo" aria-label={card.title}>
        {/* Photo links expire after 15 minutes, so the photo is shown as it comes, with no image cache in between. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {card.coverImage ? <img src={card.coverImage} alt="" loading="lazy" /> : <Icon name="image" size={28} />}
      </Link>
      <a className="listing__save" href={links.signIn(href)} aria-label="Sign in to save this home">
        <Icon name="heart" size={18} />
      </a>
      <div className="listing__body">
        <p className="price">
          {money(card.rent)} <span className="price__period">{period(card.rentPeriod)}</span>
        </p>
        <h3 className="listing__title">
          <Link href={href}>{card.title}</Link>
        </h3>
        <p className="listing__line">
          <Icon name="location" size={16} />
          {card.area}, {card.city}
        </p>
        <p className="listing__line">
          <Icon name="bed" size={16} />
          {card.bedrooms > 0 ? count(card.bedrooms, 'bed', 'beds') : card.propertyTypeLabel}
          <Icon name="bath" size={16} />
          {count(card.bathrooms, 'bath', 'baths')}
        </p>
        {verified && (
          <p className="badge badge--verified">
            <Icon name="shieldCheck" size={16} />
            Verified lister
          </p>
        )}
      </div>
    </article>
  );
}
