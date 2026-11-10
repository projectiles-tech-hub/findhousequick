import { NextResponse, type NextRequest } from 'next/server';

const DEVICE_COOKIE = 'fhq_device';

/**
 * Gives each browser a random device id, kept in a cookie. It is passed to the API with every request so the viewing
 * limits count each visitor's device separately (decision 52). It identifies a browser, not a person.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(DEVICE_COOKIE)) return NextResponse.next();
  const id = crypto.randomUUID();
  // Also on the request itself, so the very first page already counts under this id.
  const headers = new Headers(request.headers);
  headers.set('x-fhq-device', id);
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(DEVICE_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', maxAge: 60 * 60 * 24 * 365, path: '/' });
  return response;
}

export const config = { matcher: ['/homes/:path*'] };
