import { normalizePhone } from './phone.js';

describe('phone numbers', () => {
  it('turns different ways of writing one Nigerian number into one standard form', () => {
    for (const written of ['+2348031234567', '+23408031234567', '+234 803 123 4567', '+234 (0) 803-123-4567', ' +234.803.123.4567 ']) {
      expect(normalizePhone(written)).toBe('+2348031234567');
    }
  });

  it('works for other countries too', () => {
    expect(normalizePhone('+44 07911 123456')).toBe('+447911123456');
    expect(normalizePhone('+1 202 555 0123')).toBe('+12025550123');
  });

  it('refuses numbers without a country code, the wrong length, or ones that cannot exist', () => {
    expect(normalizePhone('08031234567')).toBeNull();
    expect(normalizePhone('+234803123456')).toBeNull();
    expect(normalizePhone('+2349000000001')).toBeNull();
  });

  it('refuses extra text that the library would otherwise ignore', () => {
    expect(normalizePhone('+2348031234567x')).toBeNull();
    expect(normalizePhone('+2348031234567 ext 2')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone(2348031234567)).toBeNull();
  });
});
