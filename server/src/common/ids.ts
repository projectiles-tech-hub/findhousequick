import { randomBytes } from 'node:crypto';

/**
 * A UUID version 7 (time-ordered), the same kind Prisma makes for `@default(uuid(7))`. Used where a row has to be
 * written with raw SQL (tables with geography columns), so its id is made here instead of by Prisma.
 */
export function uuidv7(now: number = Date.now()): string {
  const b = randomBytes(16);
  b.writeUIntBE(now, 0, 6); // 48-bit Unix time in milliseconds
  b[6] = (b[6] & 0x0f) | 0x70; // version 7
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
