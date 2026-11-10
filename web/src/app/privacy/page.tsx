import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/LegalPage';
import { content } from '@/content';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const doc = content()?.privacy;
  return { title: doc?.title ?? 'Not found', alternates: { canonical: '/privacy' } };
}

export default function Page() {
  const doc = content()?.privacy;
  if (!doc) notFound();
  return <LegalPage doc={doc} path="/privacy" privacy />;
}
