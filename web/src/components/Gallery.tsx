'use client';

import { useState } from 'react';
import type { GalleryPart } from '@/lib/types';

/** "Photos by room": a chip for each part of the home, and the photos of the part chosen. */
export function Gallery({ parts }: { parts: GalleryPart[] }) {
  const [open, setOpen] = useState(parts[0]?.partCode);
  const current = parts.find((p) => p.partCode === open) ?? parts[0];
  if (!current) return null;
  return (
    <div id="photos">
      <div className="chips" role="tablist" aria-label="Parts of the home">
        {parts.map((p) => (
          <button key={p.partCode} type="button" role="tab" aria-selected={p.partCode === current.partCode} className={`chip${p.partCode === current.partCode ? ' chip--on' : ''}`} onClick={() => setOpen(p.partCode)}>
            {p.partLabel} ({p.media.length})
          </button>
        ))}
      </div>
      {current.note && <p className="muted">{current.note}</p>}
      <div className="gallery__strip" role="tabpanel">
        {current.media.map((m, i) => (
          <a key={m.id} href={m.display?.large ?? m.display?.medium ?? '#'} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.display?.medium ?? m.display?.small ?? ''} alt={`${current.partLabel}, photo ${i + 1}`} loading="lazy" />
          </a>
        ))}
      </div>
    </div>
  );
}
