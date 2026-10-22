import { base32Decode, base32Encode, codeAt, matchTotp, newTotpSecret, otpauthUrl, timeStep } from './totp.js';

// The test secret from RFC 6238 Appendix B ("12345678901234567890"), written in base32.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('authenticator codes (TOTP)', () => {
  it('matches the published test values of the standard (RFC 6238, SHA-1)', () => {
    const cases: [number, string][] = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
    ];
    for (const [seconds, expected] of cases) {
      expect(codeAt(RFC_SECRET, Math.floor(seconds / 30), 8)).toBe(expected);
    }
  });

  it('round-trips base32', () => {
    const raw = Buffer.from('any bytes \u0000ÿ here');
    expect(base32Decode(base32Encode(raw)).equals(raw)).toBe(true);
    expect(base32Encode(Buffer.from('12345678901234567890'))).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('accepts the current code and one period either side, and says which period matched', () => {
    const secret = newTotpSecret();
    const at = new Date('2026-10-22T12:00:10Z');
    const step = timeStep(at);
    expect(matchTotp(secret, codeAt(secret, step), at)).toBe(step);
    expect(matchTotp(secret, codeAt(secret, step - 1), at)).toBe(step - 1);
    expect(matchTotp(secret, codeAt(secret, step + 1), at)).toBe(step + 1);
    expect(matchTotp(secret, codeAt(secret, step - 2), at)).toBeNull();
    expect(matchTotp(secret, 'abcdef', at)).toBeNull();
  });

  it('makes 160-bit secrets and a standard set-up link', () => {
    const secret = newTotpSecret();
    expect(base32Decode(secret)).toHaveLength(20);
    const url = otpauthUrl(secret, '+2348031234567');
    expect(url.startsWith('otpauth://totp/FindHouseQuick%3A%2B2348031234567?')).toBe(true);
    expect(url).toContain(`secret=${secret}`);
    expect(url).toContain('issuer=FindHouseQuick');
  });
});
