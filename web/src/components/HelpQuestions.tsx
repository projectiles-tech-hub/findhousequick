'use client';

import { useEffect, useState } from 'react';
import type { HelpQuestion } from '@/content/types';
import { Blocks } from './Blocks';
import { Icon } from './Icon';

const text = (q: HelpQuestion) => [q.question, ...q.answer.flatMap((b) => (typeof b === 'string' ? [b] : b.list))].join(' ').toLowerCase();

/** "Search for help" and the common questions; each question opens to show its answer. */
export function HelpQuestions({ questions, children }: { questions: HelpQuestion[]; children?: React.ReactNode }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  // A link such as /help#report opens that question.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (questions.some((q) => q.id === id)) setOpen(id);
  }, [questions]);
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = questions.filter((q) => words.every((w) => text(q).includes(w)));
  return (
    <>
      <label className="helpsearch">
        <Icon name="search" size={24} />
        <span className="visually-hidden">Search for help</span>
        <input type="search" placeholder="Search for help" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {children}
      <h2 className="help__heading">Common questions</h2>
      {shown.length ? (
        <div className="card questions">
          {shown.map((q) => (
            <details key={q.id} id={q.id} open={open === q.id || (words.length > 0 && shown.length === 1)} onToggle={(e) => e.currentTarget.open && setOpen(q.id)}>
              <summary>
                {q.question}
                <Icon name="forward" size={18} />
              </summary>
              <div className="questions__answer">
                <Blocks blocks={q.answer} />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="muted">No question matches your search. Try other words, or contact us.</p>
      )}
    </>
  );
}
