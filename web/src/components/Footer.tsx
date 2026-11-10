import Link from 'next/link';
import { homesUrl, links } from '@/lib/links';
import { Icon } from './Icon';

/**
 * The footer of every public page, as in the approved designs. App store links stay hidden until their addresses
 * are set, and "Homes around me" until the website can ask for the visitor's position.
 */
export function Footer({ shortLets, commercial, scouts }: { shortLets: boolean; commercial: boolean; scouts: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap footer__top">
        <div className="footer__about">
          <p className="logo logo--light">
            <span className="logo__mark">
              <Icon name="homeFilled" size={24} />
            </span>
            <span>FindHouseQuick</span>
          </p>
          <p>Houses, flats, shops and short lets to rent, from landlords and agents whose identity we have checked.</p>
        </div>
        <div className="footer__links">
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
          <nav aria-label="Help">
            <p className="footer__heading">Help</p>
            <Link href="/help">Help centre</Link>
            <Link href="/help#report">Report a listing</Link>
            <Link href="/terms">Terms of use</Link>
            <Link href="/privacy">Privacy policy</Link>
          </nav>
          {(links.playStore || links.appStore) && (
            <nav aria-label="Get the app">
              <p className="footer__heading">Get the app</p>
              {links.playStore && (
                <a className="footer__store" href={links.playStore}>
                  Google Play
                </a>
              )}
              {links.appStore && (
                <a className="footer__store" href={links.appStore}>
                  App Store
                </a>
              )}
            </nav>
          )}
        </div>
      </div>
      <div className="wrap">
        <div className="footer__bottom">
          <span>© {year} Projectiles Tech Hub Limited</span>
          <span className="footer__language">
            <Icon name="globe" size={18} />
            English
          </span>
        </div>
      </div>
    </footer>
  );
}
