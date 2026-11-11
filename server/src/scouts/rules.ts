import { createHash, createHmac, randomInt } from 'node:crypto';

/** Letters and digits that are hard to mix up when read aloud or typed (no 0, O, 1, I, L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

/** A new invitation code, short enough to type: ten characters, about 49 bits. */
export function newInvitationCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Codes are compared without regard to case, spaces or dashes, so "abcd-efgh 23" matches "ABCDEFGH23". */
export function normaliseCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '');
}

/** Only this hash of a code is stored (ADR 0008, section 3). */
export function hashInvitationCode(code: string): string {
  return createHash('sha256').update(`scout-invitation:${normaliseCode(code)}`).digest('base64url');
}

export type Conflict = 'SCOUT_IS_LANDLORD' | 'SCOUT_IS_AGENT' | 'SCOUT_IS_TENANT' | 'SHARED_PHONE' | 'SHARED_EMAIL' | 'SHARED_DEVICE';

export interface Party {
  id: string;
  role: 'LANDLORD' | 'AGENT' | 'TENANT';
  phone: string | null;
  email: string | null;
  deviceIds: string[];
  /** Hashes of every phone number and of every email address the account has ever confirmed. */
  pastPhones?: string[];
  pastEmails?: string[];
}

/**
 * The keyed hash under which a confirmed phone number or email address is remembered. The contact itself is not kept
 * once the account moves to another, only this hash, which cannot be turned back into the number or address.
 */
export function contactHash(secret: string, channel: 'SMS' | 'EMAIL', value: string): string {
  return createHmac('sha256', secret).update(`contact|${channel}|${value.trim().toLowerCase()}`).digest('base64url');
}

/**
 * The conflict of interest checks (decision 70; ADR 0008, section 6): the scout must not be the landlord, an agent on
 * the property or the tenant of the first rental, nor share a phone number or an email address ever confirmed on
 * either account, or a device, with any of them. The bank account check joins these when bank accounts exist (Release 2).
 */
export function conflictsOf(scout: Omit<Party, 'role'>, others: Party[]): Conflict[] {
  const found = new Set<Conflict>();
  for (const o of others) {
    if (o.id === scout.id) {
      found.add(o.role === 'LANDLORD' ? 'SCOUT_IS_LANDLORD' : o.role === 'AGENT' ? 'SCOUT_IS_AGENT' : 'SCOUT_IS_TENANT');
      continue;
    }
    const overlap = (a: string[] | undefined, b: string[] | undefined) => !!a && !!b && a.some((x) => b.includes(x));
    if ((scout.phone && o.phone && scout.phone === o.phone) || overlap(scout.pastPhones, o.pastPhones)) found.add('SHARED_PHONE');
    if ((scout.email && o.email && scout.email.toLowerCase() === o.email.toLowerCase()) || overlap(scout.pastEmails, o.pastEmails)) found.add('SHARED_EMAIL');
    if (o.deviceIds.some((d) => scout.deviceIds.includes(d))) found.add('SHARED_DEVICE');
  }
  return [...found];
}

export type RewardStatus = 'WAITING_FOR_RENTAL' | 'ELIGIBLE' | 'APPROVED' | 'PAID' | 'VOID';

export interface RewardLine {
  status: RewardStatus;
  rentedAt: Date | null;
}

export type RentalChange = { status: 'VOID'; voidReason: 'RENTED_THROUGH_ESCROW'; rentedAt: Date } | { status: 'WAITING_FOR_RENTAL'; rentedAt: Date } | null;
export type FeeChange = { status: 'ELIGIBLE'; amountMinor: bigint; eligibleAt: Date } | null;

/**
 * What the first rental of a unit does to its reward line (ADR 0008, section 5). Only the first rental counts: a
 * line that already has a rental recorded, or is no longer waiting, is left alone. A rental through escrow earns no
 * reward for that unit, now or later.
 */
export function onFirstRental(line: RewardLine, throughEscrow: boolean, at: Date): RentalChange {
  if (line.status !== 'WAITING_FOR_RENTAL' || line.rentedAt) return null;
  return throughEscrow ? { status: 'VOID', voidReason: 'RENTED_THROUGH_ESCROW', rentedAt: at } : { status: 'WAITING_FOR_RENTAL', rentedAt: at };
}

/**
 * What receiving the full completed rental fee does: the line becomes eligible, with the reward amount of that day
 * saved on it. Without a rental recorded, or while the country's reward is not set, nothing changes.
 */
export function onFeeReceived(line: RewardLine, rewardMinor: string | null, at: Date): FeeChange {
  if (line.status !== 'WAITING_FOR_RENTAL' || !line.rentedAt || !rewardMinor) return null;
  return { status: 'ELIGIBLE', amountMinor: BigInt(rewardMinor), eligibleAt: at };
}
