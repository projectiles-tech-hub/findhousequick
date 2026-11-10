import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HelpQuestions } from '@/components/HelpQuestions';
import { Icon } from '@/components/Icon';
import { Shell, switches } from '@/components/Shell';
import { content } from '@/content';
import { dial, site } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Help',
  description: 'Answers to common questions about renting and listing on FindHouseQuick, and how to reach us.',
  alternates: { canonical: '/help' },
};

/** Page 110, Help: search, the support lines and the common questions. */
export default async function HelpPage() {
  const c = content();
  if (!c) notFound();
  const on = await switches();
  return (
    <Shell on={on} backTo="/help">
      <h1 className="page-title help__title">Help</h1>
      <HelpQuestions questions={c.help}>
        {(site.whatsapp || site.phone) && (
          <div className="lines">
            {site.whatsapp && (
              <a className="card line" href={`https://wa.me/${dial(site.whatsapp).replace('+', '')}`}>
                <span className="line__icon">
                  <Icon name="chat" size={24} />
                </span>
                <span>
                  <strong>WhatsApp</strong>
                  {site.whatsapp}
                </span>
              </a>
            )}
            {site.phone && (
              <a className="card line" href={`tel:${dial(site.phone)}`}>
                <span className="line__icon">
                  <Icon name="phone" size={24} />
                </span>
                <span>
                  <strong>Phone</strong>
                  {site.phone}
                </span>
              </a>
            )}
          </div>
        )}
      </HelpQuestions>
    </Shell>
  );
}
