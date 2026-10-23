import { nextStep, verificationLevel } from './verification-level.js';

const both = { phoneConfirmed: true, emailConfirmed: true };

describe('verification ladder', () => {
  const now = new Date();

  it('is level 0 (browse only) until both phone and email are confirmed (decisions 35 and 37)', () => {
    const base = { identityVerifiedAt: null, hasVerifiedBankAccount: false };
    expect(verificationLevel({ ...base, phoneConfirmed: false, emailConfirmed: false })).toBe(0);
    expect(verificationLevel({ ...base, phoneConfirmed: true, emailConfirmed: false })).toBe(0);
    expect(verificationLevel({ ...base, phoneConfirmed: false, emailConfirmed: true })).toBe(0);
    expect(verificationLevel({ ...base, ...both })).toBe(1);
  });

  it('reaches level 2 with a passed identity check, and level 3 with a verified bank account', () => {
    expect(verificationLevel({ ...both, identityVerifiedAt: now, hasVerifiedBankAccount: false })).toBe(2);
    expect(verificationLevel({ ...both, identityVerifiedAt: now, hasVerifiedBankAccount: true })).toBe(3);
  });

  it('does not let a later step skip an earlier one', () => {
    expect(verificationLevel({ ...both, identityVerifiedAt: null, hasVerifiedBankAccount: true })).toBe(1);
    expect(verificationLevel({ phoneConfirmed: false, emailConfirmed: true, identityVerifiedAt: now, hasVerifiedBankAccount: true })).toBe(0);
  });

  it('asks for the phone first at level 0, then the email', () => {
    expect(nextStep(0, ['TENANT'], { phoneConfirmed: false, emailConfirmed: true })).toEqual({
      level: 1,
      action: 'CONFIRM_PHONE',
      unlocks: ['SAVE_FAVOURITES', 'SAVED_AREA_ALERTS', 'START_IDENTITY_CHECK'],
    });
    expect(nextStep(0, ['LANDLORD'], { phoneConfirmed: true, emailConfirmed: false })).toEqual({
      level: 1,
      action: 'CONFIRM_EMAIL',
      unlocks: ['START_IDENTITY_CHECK'],
    });
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
