import Link from 'next/link';
import { homesUrl, links } from '@/lib/links';

/**
 * The footer of every public page. Links to pages that are not built yet (help, terms, privacy) and to app stores
 * with no address set are left out rather than shown dead.
 */
export function Footer({ shortLets, commercial, scouts }: { shortLets: boolean; commercial: boolean; scouts: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap footer__top">
        <div className="footer__about">
          <p className="footer__name">FindHouseQuick</p>
          <p>Houses, flats, shops and short lets to rent, from landlords and agents whose identity we have checked.</p>
        </div>
        <nav aria-label="Find a place">
          <p className="footer__heading">Find a place</p>
          <Link href="/homes">Homes to rent</Link>
          {commercial && <Link href={homesUrl({ category: 'COMMERCIAL' })}>Shops and offices</Link>}
          {shortLets && <Link href={homesUrl({ category: 'SHORT_LET' })}>Short lets</Link>}
        </nav>
        <nav aria-label="List and earn">
          <p className="footer__heading">List and earn</p>
          <a href={links.listProperty()}>List a property</a>
          <a href={links.forAgents()}>For agents</a>
          {scouts && <a href={links.becomeScout()}>Become a scout</a>}
        </nav>
        {(links.playStore || links.appStore) && (
          <nav aria-label="Get the app">
            <p className="footer__heading">Get the app</p>
            {links.playStore && <a href={links.playStore}>Google Play</a>}
            {links.appStore && <a href={links.appStore}>App Store</a>}
          </nav>
        )}
      </div>
      <div className="wrap footer__bottom">
        <span>© {year} Projectiles Tech Hub Limited</span>
      </div>
    </footer>
  );
}
