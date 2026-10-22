import { createHmac, randomBytes } from 'node:crypto';

/*
 * Authenticator app codes (TOTP, the published standard RFC 6238 used by Google Authenticator, Microsoft
 * Authenticator and others). The app and the server share a secret; every 30 seconds both work out the same
 * six-digit code from the secret and the current time, so no message is sent.
 */

export const TOTP = {
  digits: 6,
  periodSeconds: 30,
  /** Codes from one period either side are accepted, to allow for phone clocks being slightly off. */
  window: 1,
  issuer: 'FindHouseQuick',
} as const;

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 is how authenticator apps expect the secret to be written. */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32 text');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random secret (160 bits, the size the standard recommends), in base32. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The time step (30-second period number) for a moment in time. */
export function timeStep(at: Date = new Date()): number {
  return Math.floor(at.getTime() / 1000 / TOTP.periodSeconds);
}

/** The code for a secret at one time step (RFC 4226 section 5.3). */
export function codeAt(secretBase32: string, step: number, digits: number = TOTP.digits): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(binary).padStart(digits, '0');
}

/**
 * Checks a code against the current period and one either side. Returns the time step it matched, so the
 * caller can refuse the same code a second time, or null if it does not match.
 */
export function matchTotp(secretBase32: string, code: string, at: Date = new Date()): number | null {
  if (!/^[0-9]{6}$/.test(code)) return null;
  const now = timeStep(at);
  for (let d = -TOTP.window; d <= TOTP.window; d++) {
    if (codeAt(secretBase32, now + d) === code) return now + d;
  }
  return null;
}

/** The link an authenticator app reads (usually shown as a QR code) to add the account. */
export function otpauthUrl(secretBase32: string, accountLabel: string): string {
  const label = encodeURIComponent(`${TOTP.issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer: TOTP.issuer,
    algorithm: 'SHA1',
    digits: String(TOTP.digits),
    period: String(TOTP.periodSeconds),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
