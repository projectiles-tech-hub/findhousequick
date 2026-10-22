import { validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'j'.repeat(40),
  OTP_HASH_SECRET: 'o'.repeat(40),
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};

describe('configuration', () => {
  it('accepts a valid configuration', () => {
    expect(validateEnv(base).OTP_HASH_SECRET).toBe('o'.repeat(40));
  });

  it('requires a separate secret for SMS codes', () => {
    const { OTP_HASH_SECRET: _omit, ...missing } = base;
    expect(() => validateEnv(missing)).toThrow(/OTP_HASH_SECRET/);
    expect(() => validateEnv({ ...base, OTP_HASH_SECRET: 'short' })).toThrow(/at least 32/);
    expect(() => validateEnv({ ...base, OTP_HASH_SECRET: base.JWT_SECRET })).toThrow(/different from JWT_SECRET/);
  });

  it('refuses the development SMS provider in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/cannot be used in production/);
  });
});
