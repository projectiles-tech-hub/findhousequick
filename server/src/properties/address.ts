/**
 * The normalised address used to spot the same building listed twice: lower case, punctuation and repeated spaces
 * removed, and common street words shortened, so "No. 12, Ekosodin Road" and "12 ekosodin rd" match.
 */
const SHORT: Record<string, string> = { road: 'rd', street: 'st', avenue: 'ave', close: 'cl', crescent: 'cres', drive: 'dr', lane: 'ln', way: 'wy' };

function norm(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\bno\.?\s*/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SHORT[w] ?? w)
    .join(' ');
}

export function addressKey(parts: { cityId: string; area: string; street: string; houseNumber?: string | null }): string {
  return [parts.cityId, norm(parts.area), norm(parts.street), norm(parts.houseNumber)].join('|');
}
