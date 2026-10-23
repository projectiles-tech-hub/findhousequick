import { createHmac } from 'node:crypto';

/*
 * Small rules for ID numbers and names on IDs (ADR 0007). Nothing here is specific to one country: the accepted ID
 * types and their number patterns come from country settings.
 */

/** Removes spaces, dashes and dots and makes letters capitals, so "1234 567-8901" and "12345678901" are the same. */
export function standardIdNumber(raw: string): string {
  return raw.replace(/[\s.-]/g, '').toUpperCase();
}

/** Used when a country gives no pattern for an ID type. */
const FALLBACK_PATTERN = /^[A-Z0-9]{4,30}$/;

/** True when a standard-form ID number fits the country's pattern for its type. */
export function idNumberFits(idNumber: string, pattern: string | undefined): boolean {
  if (!pattern) return FALLBACK_PATTERN.test(idNumber);
  try {
    return new RegExp(pattern).test(idNumber);
  } catch {
    return false; // A broken pattern in the settings refuses every number rather than accepting any.
  }
}

/**
 * A fingerprint of an ID number, used to spot one ID on several accounts without storing the number readably.
 * Keyed with LOOKUP_HASH_SECRET, so someone with a copy of the database cannot simply try every possible number.
 */
export function idLookupHash(secret: string, countryCode: string, idType: string, idNumber: string): string {
  return createHmac('sha256', secret).update(`id|${countryCode}|${idType}|${idNumber}`).digest('base64url');
}

/** The last four characters, the only part of an ID number ever shown again. */
export function last4(idNumber: string): string {
  return idNumber.slice(-4);
}

/** Lower-case words of a name, with accents and punctuation removed: "Adébáyọ̀ O'Neil" gives ["adebayo", "oneil"]. */
export function nameWords(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/**
 * Whether the name on the ID clearly belongs to the user: every word of their first name and of their last name
 * appears in it, in any order (IDs often add a middle name or put the surname first). Anything less clear goes to
 * the verification team rather than being refused, because spellings of the same name differ.
 */
export function namesMatch(firstName: string, lastName: string, nameOnId: string | null): boolean {
  if (!nameOnId) return false;
  const onId = new Set(nameWords(nameOnId));
  const needed = [...nameWords(firstName), ...nameWords(lastName)];
  return needed.length > 0 && needed.every((w) => onId.has(w));
}
