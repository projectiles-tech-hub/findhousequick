import { NextResponse } from 'next/server';
import { links } from '@/lib/links';

/**
 * A scout's invitation link (decision 70). There is no designed invitation page, so the link takes the landlord
 * straight to creating his own account in the app, with the code carried along; he registers himself there.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  return NextResponse.redirect(links.acceptInvitation(clean), 307);
}
