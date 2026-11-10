/**
 * Contact details shown on the help and legal pages. They are settings, not text in the code, so each server and
 * each country shows its own; a detail that is not set is simply not shown.
 */
export const site = {
  country: (process.env.SITE_COUNTRY ?? '').toUpperCase(),
  whatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || null,
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || null,
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || null,
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || null,
  companyAddress: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || null,
};

/** Digits only, for wa.me and tel: links. */
export const dial = (number: string) => number.replace(/[^\d+]/g, '');
