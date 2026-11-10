'use client';

import { useEffect, useState } from 'react';

/** The numbered list of sections beside a legal page; the section being read is highlighted. */
export function ContentsNav({ sections }: { sections: { id: string; title: string }[] }) {
  const [current, setCurrent] = useState(sections[0]?.id);
  useEffect(() => {
    const seen = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.id);
      },
      { rootMargin: '0px 0px -60% 0px' },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) seen.observe(el);
    }
    return () => seen.disconnect();
  }, [sections]);
  return (
    <nav className="card contents" aria-label="On this page">
      {sections.map((s, i) => (
        <a key={s.id} href={`#${s.id}`} className={s.id === current ? 'contents__on' : undefined} aria-current={s.id === current ? 'true' : undefined}>
          {i + 1}. {s.title}
        </a>
      ))}
    </nav>
  );
}
