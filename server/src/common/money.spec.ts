import { feeFromBps, percentToBps } from './money.js';

describe('feeFromBps', () => {
  it('matches the specification worked example (1.5% and 2% of N1,000,000)', () => {
    const rent = 1_000_000n * 100n; // kobo
    expect(feeFromBps(rent, 150)).toBe(1_500_000n); // N15,000
    expect(feeFromBps(rent, 200)).toBe(2_000_000n); // N20,000
  });

  it('rounds half up to the nearest minor unit', () => {
    expect(feeFromBps(1n, 5000)).toBe(1n); // 0.5 rounds up
    expect(feeFromBps(1n, 4999)).toBe(0n);
    expect(feeFromBps(333n, 150)).toBe(5n); // 4.995 rounds up
  });

  it('handles very large amounts exactly', () => {
    const big = 9_000_000_000_000_000n;
    expect(feeFromBps(big, 150)).toBe(135_000_000_000_000n);
  });

  it('rejects invalid input', () => {
    expect(() => feeFromBps(-1n, 150)).toThrow(RangeError);
    expect(() => feeFromBps(1n, 1.5)).toThrow(RangeError);
    expect(() => feeFromBps(1n, 10_001)).toThrow(RangeError);
  });
});

describe('percentToBps', () => {
  it('converts decimal percentages exactly', () => {
    expect(percentToBps('1.5')).toBe(150);
    expect(percentToBps('2')).toBe(200);
    expect(percentToBps('0.75')).toBe(75);
    expect(percentToBps('100')).toBe(10_000);
  });

  it('rejects bad values', () => {
    expect(() => percentToBps('abc')).toThrow();
    expect(() => percentToBps('1.555')).toThrow();
    expect(() => percentToBps('101')).toThrow();
  });
});
