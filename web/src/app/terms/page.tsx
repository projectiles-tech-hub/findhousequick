import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/LegalPage';
import { content } from '@/content';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const doc = content()?.terms;
  return { title: doc?.title ?? 'Not found', alternates: { canonical: '/terms' } };
}

export default function Page() {
  const doc = content()?.terms;
  if (!doc) notFound();
  return <LegalPage doc={doc} path="/terms" />;
}
