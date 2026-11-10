import type { LegalDocument } from '@/content/types';
import { date } from '@/lib/format';
import { Blocks } from './Blocks';
import { ContactDetails } from './ContactDetails';
import { ContentsNav } from './ContentsNav';
import { Shell, switches } from './Shell';

/** Pages 111 and 112: a numbered list of sections on the left and the sections themselves on the right. */
export async function LegalPage({ doc, path, privacy = false }: { doc: LegalDocument; path: string; privacy?: boolean }) {
  const on = await switches();
  return (
    <Shell on={on} backTo={path}>
      <div className="legal__head">
        <h1 className="page-title">{doc.title}</h1>
        <p>Last updated: {date(doc.updated)}</p>
      </div>
      <div className="legal">
        <ContentsNav sections={doc.sections.map((s) => ({ id: s.id, title: s.title }))} />
        <div className="legal__sections">
          {doc.intro && <p className="legal__intro">{doc.intro}</p>}
          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="legal__section">
              <h2>
                {i + 1}. {s.title}
              </h2>
              <Blocks blocks={s.blocks} />
              {(s.id === 'contact' || (privacy && s.id === 'dpo')) && <ContactDetails privacy={privacy} />}
            </section>
          ))}
        </div>
      </div>
    </Shell>
  );
}
