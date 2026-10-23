/*
 * The verification ladder (Product Specification, Section 3; decisions 6, 35 and 37).
 *
 *   Level 0 UNCONFIRMED    signed in, but phone and email are not both confirmed yet: browsing only
 *   Level 1 BASIC          phone confirmed by SMS code and email confirmed by email code
 *   Level 2 VERIFIED       identity check passed (NIN or national equivalent, selfie, liveness)
 *   Level 3 PAYMENT_READY  bank account verified in the user's own name
 *
 * Landlords additionally need ownership verified for each property, and agents need approved authority
 * for each property; those are per property, so they are checked on the property, not here.
 */

export type UserTypeName = 'TENANT' | 'LANDLORD' | 'AGENT';

export const LEVELS = { UNCONFIRMED: 0, BASIC: 1, VERIFIED: 2, PAYMENT_READY: 3 } as const;
export type VerificationLevel = (typeof LEVELS)[keyof typeof LEVELS];

/**
 * What each level adds, per user type, as codes the apps translate into the user's language.
 * Taken from the tables in Specification Sections 3.2 to 3.4. Starting the identity check is listed at
 * level 1 because any progress needs both contacts confirmed (decisions 35 and 37).
 */
const UNLOCKS: Record<1 | 2 | 3, Record<UserTypeName, string[]>> = {
  1: {
    TENANT: ['SAVE_FAVOURITES', 'SAVED_AREA_ALERTS', 'START_IDENTITY_CHECK'],
    LANDLORD: ['START_IDENTITY_CHECK'],
    AGENT: ['START_IDENTITY_CHECK'],
  },
  2: {
    TENANT: ['CONTACT_LISTERS', 'CHAT', 'BOOK_INSPECTIONS'],
    LANDLORD: ['ADD_PROPERTY_DRAFTS', 'APPROVE_AGENTS'],
    AGENT: ['REQUEST_PROPERTY_AUTHORITY'],
  },
  3: {
    TENANT: ['PAY_THROUGH_ESCROW', 'SIGN_TENANCY_AGREEMENTS', 'BOOK_SHORT_LETS'],
    LANDLORD: ['RECEIVE_PAYMENTS'],
    AGENT: ['RECEIVE_AGENCY_FEES'],
  },
};

export interface LadderFacts {
  phoneConfirmed: boolean;
  emailConfirmed: boolean;
  identityVerifiedAt: Date | null;
  /** True when the user has at least one bank account verified in their own name. */
  hasVerifiedBankAccount: boolean;
}

/** The user's level. Each level needs the ones below it, so a bank account alone does not skip identity. */
export function verificationLevel(f: LadderFacts): VerificationLevel {
  if (!f.phoneConfirmed || !f.emailConfirmed) return LEVELS.UNCONFIRMED;
  if (!f.identityVerifiedAt) return LEVELS.BASIC;
  return f.hasVerifiedBankAccount ? LEVELS.PAYMENT_READY : LEVELS.VERIFIED;
}

export type NextAction = 'CONFIRM_PHONE' | 'CONFIRM_EMAIL' | 'VERIFY_IDENTITY' | 'ADD_BANK_ACCOUNT';

export interface NextStep {
  level: 1 | 2 | 3;
  action: NextAction;
  unlocks: string[];
}

/**
 * What the user should do next and what it gives them, for the apps to guide them. Null at the top.
 * At level 0 the phone is asked for first, since nothing beyond browsing works without it (decision 35).
 */
export function nextStep(
  level: VerificationLevel,
  types: readonly UserTypeName[],
  contacts: { phoneConfirmed: boolean; emailConfirmed: boolean } = { phoneConfirmed: true, emailConfirmed: true },
): NextStep | null {
  if (level >= LEVELS.PAYMENT_READY) return null;
  const target = (level + 1) as 1 | 2 | 3;
  const unlocks = [...new Set(types.flatMap((t) => UNLOCKS[target][t] ?? []))];
  const action: NextAction =
    target === 1
      ? contacts.phoneConfirmed
        ? 'CONFIRM_EMAIL'
        : 'CONFIRM_PHONE'
      : target === 2
        ? 'VERIFY_IDENTITY'
        : 'ADD_BANK_ACCOUNT';
  return { level: target, action, unlocks };
}
