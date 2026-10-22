import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { FieldEncryption } from './field-encryption.js';

const withKey = (fill: number) =>
  new FieldEncryption({ get: () => Buffer.alloc(32, fill).toString('base64') } as unknown as ConfigService<Env, true>);

describe('field encryption', () => {
  const enc = withKey(7);

  it('reads back what it stored, and never stores the plain value', () => {
    const stored = enc.encrypt('JBSWY3DPEHPK3PXP');
    expect(stored.startsWith('v1.')).toBe(true);
    expect(stored).not.toContain('JBSWY3DPEHPK3PXP');
    expect(enc.decrypt(stored)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('gives a different stored value each time for the same input', () => {
    expect(enc.encrypt('same')).not.toBe(enc.encrypt('same'));
  });

  it('refuses a value that was changed, or read with the wrong key', () => {
    const stored = enc.encrypt('secret value');
    const parts = stored.split('.');
    const flipped = Buffer.from(parts[3], 'base64url');
    flipped[0] ^= 1;
    expect(() => enc.decrypt([parts[0], parts[1], parts[2], flipped.toString('base64url')].join('.'))).toThrow();
    expect(() => withKey(8).decrypt(stored)).toThrow();
    expect(() => enc.decrypt('not-encrypted')).toThrow(/Unrecognised/);
  });
});
