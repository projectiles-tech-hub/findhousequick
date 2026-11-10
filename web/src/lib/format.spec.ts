import { describe, expect, it } from 'vitest';
import { floor, label, money, plain, toMinor } from './format';

describe('formatting', () => {
  it('shows money from minor units without losing anything', () => {
    expect(money({ amountMinor: '180000000', currency: 'NGN' })).toBe('₦1,800,000');
    expect(money({ amountMinor: '180000050', currency: 'NGN' })).toBe('₦1,800,000.50');
    expect(money({ amountMinor: '0', currency: 'NGN' })).toBe('₦0');
    expect(money({ amountMinor: '5', currency: 'NGN' })).toBe('₦0.05');
    expect(money({ amountMinor: '1500', currency: 'JPY' })).toBe('¥1,500');
    expect(money({ amountMinor: '99999999999999900', currency: 'USD' })).toBe('$999,999,999,999,999');
  });

  it('turns a whole amount into minor units for the currency', () => {
    expect(toMinor('1500000', 'NGN')).toBe('150000000');
    expect(toMinor('1500', 'JPY')).toBe('1500');
    expect(toMinor('abc', 'NGN')).toBeUndefined();
    expect(toMinor(undefined, 'NGN')).toBeUndefined();
  });

  it('writes codes and keys in plain words', () => {
    expect(plain('SEMI_FURNISHED')).toBe('Semi furnished');
    expect(plain(['PREPAID_METER', 'INVERTER'])).toBe('Prepaid meter; Inverter');
    expect(plain('Space for 2 cars')).toBe('Space for 2 cars');
    expect(plain(true)).toBe('Yes');
    expect(label('roadCondition')).toBe('Road condition');
    expect(floor(1)).toBe('First floor');
    expect(floor(0)).toBe('Ground floor');
  });
});
