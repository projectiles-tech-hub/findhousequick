'use client';

import { useState } from 'react';

/** Shares the page through the phone's own share sheet, or copies its address where there is none. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // The visitor closed the share sheet: nothing to do.
    }
  }
  return (
    <button type="button" className="chip" onClick={share}>
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
