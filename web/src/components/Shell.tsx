import { controls } from '@/lib/api';
import { Footer } from './Footer';
import { Header } from './Header';

/** What the server's feature switches allow, read once per page. If they cannot be read, the extras stay hidden. */
export async function switches() {
  const c = await controls().catch(() => null);
  const features = c?.features ?? {};
  return {
    /** The country's currency and furnishing choices, for the price and furnishing filters. */
    currency: c?.country?.currency ?? null,
    furnishing: c?.country?.settings.unitDetails?.furnishing ?? [],
    shortLets: !!features['listings.short_let'], commercial: !!features['listings.commercial'], scouts: !!features['growth.scouts'], alerts: !!features['search.saved_alerts'],
  };
}
export type Switches = Awaited<ReturnType<typeof switches>>;

export function Shell({ children, on, query, backTo }: { children: React.ReactNode; on: Switches; query?: string; backTo: string }) {
  return (
    <>
      <Header query={query} backTo={backTo} scouts={on.scouts} />
      <main className="wrap main">{children}</main>
      <Footer shortLets={on.shortLets} commercial={on.commercial} scouts={on.scouts} />
    </>
  );
}
