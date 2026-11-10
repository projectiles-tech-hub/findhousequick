import Link from 'next/link';
import { links } from '@/lib/links';
import { Icon } from './Icon';

/** The strip and the bar at the top of every public page. `scouts` follows the feature switch growth.scouts. */
export function Header({ query, backTo, scouts }: { query?: string; backTo: string; scouts: boolean }) {
  return (
    <header>
      <div className="strip">
        <div className="wrap strip__row">
          <span>Every landlord and agent proves who they are before they can list</span>
          <nav aria-label="For landlords and scouts">
            <a href={links.listProperty()}>List your property</a>
            {scouts && <a href={links.becomeScout()}>Become a scout</a>}
          </nav>
        </div>
      </div>
      <div className="bar">
        <div className="wrap bar__row">
          <Link href="/homes" className="logo" aria-label="FindHouseQuick, homes to rent">
            <span className="logo__mark">F</span>
            <span>FindHouseQuick</span>
          </Link>
          <form className="searchbox" action="/homes" role="search">
            <label className="searchbox__field">
              <Icon name="search" />
              <span className="visually-hidden">Search by area</span>
              <input name="area" defaultValue={query} placeholder="Search area, street or landmark" autoComplete="off" />
            </label>
            <button className="button button--primary" type="submit">
              Search
            </button>
          </form>
          <nav className="bar__nav" aria-label="Account">
            <Link href="/homes" className="bar__link">
              Homes to rent
            </Link>
            <a href={links.signIn(backTo)} className="bar__signin">
              Sign in
            </a>
            <a href={links.createAccount(backTo)} className="button button--outline">
              Create an account
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
