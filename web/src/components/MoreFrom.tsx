import { links } from '@/lib/links';
import { Icon, type IconName } from './Icon';

/** "More from FindHouseQuick": the platform's own services, shown on the search and listing pages (decision 77). */
export function MoreFrom({ scouts, third }: { scouts: boolean; third: 'MANAGE' | 'LIST' }) {
  const tiles: { icon: IconName; title: string; text: string; link?: { label: string; href: string } }[] = [
    { icon: 'shieldCheck', title: 'Identity-checked listers', text: "Every landlord and agent proves who they are, and agents prove the landlord's authority, before a home goes live." },
    { icon: 'calendar', title: 'Free inspections', text: 'Book a time in the app. Nobody may charge you to see a home; report it in one tap if they try.' },
    third === 'MANAGE'
      ? { icon: 'money', title: 'Manage your rentals', text: 'Landlords and agents track tenants, rent, receipts and repairs in one place, free.', link: { label: 'For landlords', href: links.listProperty() } }
      : { icon: 'home', title: 'List your property free', text: 'Landlords and agents list for free and manage tenants, rent and receipts in one place.', link: { label: 'List your property', href: links.listProperty() } },
  ];
  if (scouts) tiles.push({ icon: 'people', title: 'Become a scout', text: 'Spot a vacant property, invite the landlord, and earn a reward when it is rented.', link: { label: 'Start scouting', href: links.becomeScout() } });
  return (
    <section className="section">
      <h2 className="section__title">More from FindHouseQuick</h2>
      <div className={`grid grid--${tiles.length}`}>
        {tiles.map((t) => (
          <div className="card tile" key={t.title}>
            <span className="tile__icon">
              <Icon name={t.icon} />
            </span>
            <h3 className="tile__title">{t.title}</h3>
            <p>{t.text}</p>
            {t.link && (
              <a className="link" href={t.link.href}>
                {t.link.label}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
