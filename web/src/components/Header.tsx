import Link from 'next/link';
import { links } from '@/lib/links';
import { Icon } from './Icon';

/**
 * The strip and the bar at the top of every public page, as in the approved public website designs (Penpot pages 32
 * and 33). `scouts` follows the feature switch growth.scouts.
 */
export function Header({ query, backTo, scouts }: { query?: string; backTo: string; scouts: boolean }) {
  return (
    <header>
      <div className="strip">
        <div className="wrap strip__row">
          <span className="strip__promise">
            <Icon name="shieldCheck" size={18} />
            Every landlord and agent proves who they are before they can list
          </span>
          <nav aria-label="For landlords and scouts">
            <a href={links.listProperty()}>List your property</a>
            {scouts && <a href={links.becomeScout()}>Become a scout</a>}
            <Link href="/help">Help</Link>
          </nav>
        </div>
      </div>
      <div className="bar">
        <div className="wrap bar__row">
          <details className="navmenu">
            <summary aria-label="Menu">
              <Icon name="menu" size={24} />
            </summary>
            <nav className="card navmenu__list" aria-label="Menu">
              <Link href="/homes">Homes to rent</Link>
              <a href={links.listProperty()}>List your property</a>
              {scouts && <a href={links.becomeScout()}>Become a scout</a>}
              <Link href="/help">Help</Link>
              <a href={links.createAccount(backTo)}>Create an account</a>
            </nav>
          </details>
          <Link href="/homes" className="logo" aria-label="FindHouseQuick, homes to rent">
            <span className="logo__mark">
              <Icon name="homeFilled" size={24} />
            </span>
            <span>FindHouseQuick</span>
          </Link>
          <form className="searchbox" action="/homes" role="search">
            <Icon name="search" size={24} />
            <label className="searchbox__field">
              <span className="visually-hidden">Search by area</span>
              <input name="area" defaultValue={query} placeholder="Search area, street or landmark" autoComplete="off" />
            </label>
            <Link href="/homes" className="searchbox__link">
              Homes to rent
            </Link>
            <button className="searchbox__button" type="submit">
              Search
            </button>
          </form>
          <nav className="bar__nav" aria-label="Account">
            <a href={links.signIn(backTo)} className="pill pill--plain">
              Sign in
            </a>
            <a href={links.createAccount(backTo)} className="pill pill--primary">
              Create an account
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
