import {
  DUMMY_PASSWORD_HASH,
  generateNumericCode,
  generateToken,
  hashCode,
  hashPassword,
  hashToken,
  verifyPassword,
} from './secrets.js';
import { maskPhone } from './otp.service.js';

describe('passwords', () => {
  it('accepts the right password and refuses a wrong one', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored.startsWith('scrypt$32768$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('correct horse batterY', stored)).toBe(false);
  });

  it('gives different hashes for the same password (random salt)', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('refuses malformed hashes and the dummy hash', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$1$2$3$$')).toBe(false);
    expect(await verifyPassword('anything', DUMMY_PASSWORD_HASH)).toBe(false);
  });
});

describe('one-time codes and tokens', () => {
  it('makes six-digit codes, keeping leading zeros', () => {
    for (let i = 0; i < 200; i++) expect(generateNumericCode(6)).toMatch(/^[0-9]{6}$/);
  });

  it('ties a code hash to the phone, purpose and server key', () => {
    const h = hashCode('key-1', '+2348031234567', 'LOGIN', '123456');
    expect(hashCode('key-1', '+2348031234567', 'LOGIN', '123456')).toBe(h);
    expect(hashCode('key-2', '+2348031234567', 'LOGIN', '123456')).not.toBe(h);
    expect(hashCode('key-1', '+2348031234567', 'REGISTER', '123456')).not.toBe(h);
    expect(hashCode('key-1', '+2348031234568', 'LOGIN', '123456')).not.toBe(h);
  });

  it('makes long random tokens with stable hashes', () => {
    const t = generateToken();
    expect(t.length).toBeGreaterThanOrEqual(43);
    expect(generateToken()).not.toBe(t);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
  });

  it('masks phone numbers for logs', () => {
    expect(maskPhone('+2348031234567')).toBe('+234*******567');
    expect(maskPhone('+12')).toBe('***');
  });
});
