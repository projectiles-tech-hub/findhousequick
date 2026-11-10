import type { Money } from './types';

/** How many decimal places a currency has (2 for naira, 0 for yen), from the runtime's own currency tables. */
function decimals(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * An amount held in whole minor units (kobo, cents) as text, for example "₦1,800,000". Whole amounts drop the
 * decimals. Works on the text, never on floats, so large amounts stay exact.
 */
export function money(m: Money, locale = 'en'): string {
  const d = decimals(m.currency);
  const digits = m.amountMinor.padStart(d + 1, '0');
  const whole = digits.slice(0, digits.length - d);
  const fraction = d ? digits.slice(-d) : '';
  const showFraction = d > 0 && /[1-9]/.test(fraction);
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: m.currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 0 }).formatToParts(
    BigInt(whole),
  );
  const out = parts.map((p) => p.value).join('');
  if (!showFraction) return out;
  // Put the decimals straight after the last digit, wherever the currency sign sits.
  const lastDigit = out.search(/\d(?!.*\d)/);
  return `${out.slice(0, lastDigit + 1)}.${fraction}${out.slice(lastDigit + 1)}`;
}

/** Turns a whole amount typed in the address bar ("1500000") into minor units for the API. */
export function toMinor(major: string | undefined, currency: string): string | undefined {
  if (!major || !/^\d{1,13}$/.test(major)) return undefined;
  return `${BigInt(major)}${'0'.repeat(decimals(currency))}`;
}

const PERIODS: Record<string, { short: string; long: string }> = {
  YEAR: { short: '/year', long: 'per year' },
  MONTH: { short: '/month', long: 'per month' },
  WEEK: { short: '/week', long: 'per week' },
  NIGHT: { short: '/night', long: 'per night' },
};
export const period = (p: string, form: 'short' | 'long' = 'short') => PERIODS[p]?.[form] ?? '';

/** "SEMI_FURNISHED" becomes "Semi furnished"; lists are joined with semicolons. */
export function plain(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => plain(v)).filter(Boolean).join('; ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/^[A-Z0-9_]+$/.test(text)) return text;
  const lower = text.toLowerCase().replaceAll('_', ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** "roadCondition" becomes "Road condition". */
export function label(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function date(iso: string | null, locale = 'en-GB'): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
}

export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "First floor", "Ground floor". */
export function floor(level: number | null): string {
  if (level === null) return '';
  if (level === 0) return 'Ground floor';
  if (level < 0) return 'Basement';
  const words = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
  return `${words[level - 1] ?? `${level}th`} floor`;
}
