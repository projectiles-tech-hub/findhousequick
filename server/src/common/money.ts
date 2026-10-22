/**
 * Money helpers. Amounts are whole minor units (kobo, cents) held as bigint; rates are basis points.
 * 1 basis point = 0.01%, so 150 bps = 1.5% and 10,000 bps = 100%.
 */

export const BPS_DENOMINATOR = 10_000n;

/**
 * Fee on an amount at a rate in basis points, rounded half up to the nearest minor unit.
 * Example: feeFromBps(100_000_000n, 150) = 1_500_000n (1.5% of N1,000,000 is N15,000).
 */
export function feeFromBps(amountMinor: bigint, bps: number): bigint {
  if (amountMinor < 0n) throw new RangeError('amountMinor must not be negative');
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new RangeError('bps must be an integer from 0 to 10000');
  return (amountMinor * BigInt(bps) + BPS_DENOMINATOR / 2n) / BPS_DENOMINATOR;
}

/** Converts a percentage written as a decimal string (e.g. "1.5") to basis points without float errors. */
export function percentToBps(percent: string): number {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(percent.trim());
  if (!match) throw new RangeError(`Invalid percentage: ${percent}`);
  const bps = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (bps > 10_000) throw new RangeError('Percentage cannot exceed 100');
  return bps;
}

/** Serialises bigint amounts as strings for JSON responses (JSON has no safe 64-bit integers). */
export function minorToString(amountMinor: bigint): string {
  return amountMinor.toString();
}
