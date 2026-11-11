/**
 * Where the website's links lead. Signing in, creating an account and everything after it happen in the signed-in
 * web app, at NEXT_PUBLIC_APP_URL; the website itself only shows what a signed-out visitor may see (decision 75).
 */
const APP = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
export const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

/** A page of the signed-in app, returning to a page of this website afterwards where that makes sense. */
function app(path: string, backTo?: string): string {
  const next = backTo ? `?next=${encodeURIComponent(`${SITE}${backTo}`)}` : '';
  return `${APP}${path}${next}`;
}

export const links = {
  signIn: (backTo?: string) => app('/sign-in', backTo),
  createAccount: (backTo?: string) => app('/sign-up', backTo),
  listProperty: () => app('/sign-up?as=landlord'),
  forAgents: () => app('/sign-up?as=agent'),
  becomeScout: () => app('/sign-up?as=scout'),
  acceptInvitation: (code: string) => app(`/sign-up?as=landlord&invitation=${encodeURIComponent(code)}`),
  playStore: process.env.NEXT_PUBLIC_PLAY_STORE_URL || null,
  appStore: process.env.NEXT_PUBLIC_APP_STORE_URL || null,
};

export type Query = Record<string, string | undefined>;

/** The search page address for a set of filters, leaving out the empty ones. */
export function homesUrl(q: Query): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) params.set(k, v);
  const text = params.toString();
  return text ? `/homes?${text}` : '/homes';
}
