import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

/*
 * Small helpers for anything secret in sign-in: passwords, one-time codes and refresh tokens.
 * None of these values is ever stored as typed; only a one-way hash is kept, so a copy of the
 * database does not reveal them.
 */

// scrypt settings. N=2^15 takes roughly 50 ms per check: slow enough to make guessing expensive,
// fast enough not to hold up sign-in. maxmem is raised because Node's default is too small for N=2^15.
const SCRYPT = { N: 1 << 15, r: 8, p: 1, keyLength: 64, maxmem: 64 * 1024 * 1024 };

function scryptAsync(password: string, salt: Buffer, N: number, r: number, p: number, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, keyLength, { N, r, p, maxmem: SCRYPT.maxmem }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

/** Hashes a password. The result records its own settings, so they can be raised later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keyLength);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/** Checks a password against a stored hash. Returns false for anything malformed. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltText, keyText] = parts;
  const expected = Buffer.from(keyText, 'base64url');
  if (expected.length === 0) return false;
  try {
    const actual = await scryptAsync(password, Buffer.from(saltText, 'base64url'), Number(n), Number(r), Number(p), expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** A hash used when no user exists, so a wrong phone number takes as long to reject as a wrong password. */
export const DUMMY_PASSWORD_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + Buffer.alloc(64).toString('base64url');

/** A random numeric code of the given length, e.g. "042917". */
export function generateNumericCode(length: number): string {
  return String(randomInt(0, 10 ** length)).padStart(length, '0');
}

/**
 * Hash of a one-time code, keyed with a server secret. Codes are only six digits, so a plain hash could be
 * reversed by trying all million values; the secret key prevents that for anyone without the server's key.
 */
export function hashCode(secret: string, phone: string, purpose: string, code: string): string {
  return createHmac('sha256', secret).update(`${phone}|${purpose}|${code}`).digest('base64url');
}

/** Compares two hashes without leaking, through timing, how many characters matched. */
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A long random token (256 bits), safe to put in URLs and headers. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash of a refresh token. Tokens are random and long, so a plain SHA-256 is enough. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}
