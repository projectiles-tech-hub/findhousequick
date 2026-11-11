import { describe, expect, it } from 'vitest';
import { conflictsOf, contactHash, hashInvitationCode, newInvitationCode, onFeeReceived, onFirstRental, type Party } from './rules.js';

const scout = { id: 's', phone: '+2348030000001', email: 'scout@example.com', deviceIds: ['d1'] };
const landlord: Party = { id: 'l', role: 'LANDLORD', phone: '+2348030000002', email: 'landlord@example.com', deviceIds: ['d2'] };
const day = new Date('2026-12-01T10:00:00Z');

describe('scout rules', () => {
  it('makes codes that are easy to type and matches them however they are typed', () => {
    const code = newInvitationCode();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    expect(hashInvitationCode(`${code.slice(0, 5).toLowerCase()}-${code.slice(5)} `)).toBe(hashInvitationCode(code));
    expect(hashInvitationCode(newInvitationCode())).not.toBe(hashInvitationCode(code));
  });

  it('finds every conflict of interest, and none between strangers', () => {
    expect(conflictsOf(scout, [landlord])).toEqual([]);
    expect(conflictsOf(scout, [{ ...landlord, id: 's' }])).toEqual(['SCOUT_IS_LANDLORD']);
    expect(conflictsOf(scout, [landlord, { ...landlord, id: 's', role: 'AGENT' }])).toEqual(['SCOUT_IS_AGENT']);
    expect(conflictsOf(scout, [{ ...landlord, id: 's', role: 'TENANT' }])).toEqual(['SCOUT_IS_TENANT']);
    expect(conflictsOf(scout, [{ ...landlord, phone: scout.phone }])).toEqual(['SHARED_PHONE']);
    expect(conflictsOf(scout, [{ ...landlord, email: 'SCOUT@example.com' }])).toEqual(['SHARED_EMAIL']);
    expect(conflictsOf(scout, [{ ...landlord, deviceIds: ['d9', 'd1'] }])).toEqual(['SHARED_DEVICE']);
    // A number or address either account confirmed in the past counts too.
    const old = contactHash('secret', 'SMS', '+2348030000009');
    expect(conflictsOf({ ...scout, pastPhones: [old] }, [{ ...landlord, pastPhones: ['other', old] }])).toEqual(['SHARED_PHONE']);
    expect(conflictsOf({ ...scout, pastEmails: ['x'] }, [{ ...landlord, pastEmails: ['x'] }])).toEqual(['SHARED_EMAIL']);
    expect(conflictsOf({ ...scout, pastPhones: ['a'] }, [{ ...landlord, pastPhones: ['b'] }])).toEqual([]);
    expect(contactHash('secret', 'EMAIL', ' Ada@Example.com ')).toBe(contactHash('secret', 'EMAIL', 'ada@example.com'));
    expect(contactHash('secret', 'EMAIL', 'ada@example.com')).not.toBe(contactHash('other', 'EMAIL', 'ada@example.com'));
  });

  it('counts only the first rental, and a rental through escrow voids only that line', () => {
    const waiting = { status: 'WAITING_FOR_RENTAL' as const, rentedAt: null };
    expect(onFirstRental(waiting, true, day)).toEqual({ status: 'VOID', voidReason: 'RENTED_THROUGH_ESCROW', rentedAt: day });
    expect(onFirstRental(waiting, false, day)).toEqual({ status: 'WAITING_FOR_RENTAL', rentedAt: day });
    expect(onFirstRental({ ...waiting, rentedAt: day }, false, day)).toBeNull();
    expect(onFirstRental({ status: 'VOID', rentedAt: null }, false, day)).toBeNull();
  });

  it('makes a line eligible only after a rental and the fee, with the amount of that day, and only once set', () => {
    const rented = { status: 'WAITING_FOR_RENTAL' as const, rentedAt: day };
    expect(onFeeReceived(rented, '500000', day)).toEqual({ status: 'ELIGIBLE', amountMinor: 500000n, eligibleAt: day });
    expect(onFeeReceived(rented, null, day)).toBeNull();
    expect(onFeeReceived({ ...rented, rentedAt: null }, '500000', day)).toBeNull();
    expect(onFeeReceived({ status: 'ELIGIBLE', rentedAt: day }, '900000', day)).toBeNull();
  });
});
