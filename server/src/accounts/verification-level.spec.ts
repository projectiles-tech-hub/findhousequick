import { nextStep, verificationLevel } from './verification-level.js';

describe('verification ladder', () => {
  const now = new Date();

  it('starts every registered user at level 1', () => {
    expect(verificationLevel({ identityVerifiedAt: null, hasVerifiedBankAccount: false })).toBe(1);
  });

  it('reaches level 2 with a passed identity check, and level 3 with a verified bank account', () => {
    expect(verificationLevel({ identityVerifiedAt: now, hasVerifiedBankAccount: false })).toBe(2);
    expect(verificationLevel({ identityVerifiedAt: now, hasVerifiedBankAccount: true })).toBe(3);
  });

  it('does not let a bank account skip the identity check', () => {
    expect(verificationLevel({ identityVerifiedAt: null, hasVerifiedBankAccount: true })).toBe(1);
  });

  it('tells a tenant what identity verification unlocks', () => {
    expect(nextStep(1, ['TENANT'])).toEqual({
      level: 2,
      action: 'VERIFY_IDENTITY',
      unlocks: ['CONTACT_LISTERS', 'CHAT', 'BOOK_INSPECTIONS'],
    });
  });

  it('combines unlocks for users with more than one type', () => {
    expect(nextStep(2, ['LANDLORD', 'AGENT'])).toEqual({
      level: 3,
      action: 'ADD_BANK_ACCOUNT',
      unlocks: ['RECEIVE_PAYMENTS', 'RECEIVE_AGENCY_FEES'],
    });
  });

  it('has no next step at the top level', () => {
    expect(nextStep(3, ['TENANT'])).toBeNull();
  });
});
