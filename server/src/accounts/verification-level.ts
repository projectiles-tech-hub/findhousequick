/*
 * The verification ladder (Product Specification, Section 3; Decision 6).
 *
 *   Level 1 BASIC          phone confirmed by SMS code
 *   Level 2 VERIFIED       identity check passed (NIN or national equivalent, selfie, liveness)
 *   Level 3 PAYMENT_READY  bank account verified in the user's own name
 *
 * Landlords additionally need ownership verified for each property, and agents need approved authority
 * for each property; those are per property, so they are checked on the property, not here.
 */

export type UserTypeName = 'TENANT' | 'LANDLORD' | 'AGENT';

export const LEVELS = { BASIC: 1, VERIFIED: 2, PAYMENT_READY: 3 } as const;
export type VerificationLevel = (typeof LEVELS)[keyof typeof LEVELS];

/**
 * What each level adds, per user type, as codes the apps translate into the user's language.
 * Taken from the tables in Specification Sections 3.2 to 3.4.
 */
const UNLOCKS: Record<2 | 3, Record<UserTypeName, string[]>> = {
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

/** Every account reaches level 1 at registration, because registering needs an SMS code. */
export interface LadderFacts {
  identityVerifiedAt: Date | null;
  /** True when the user has at least one bank account verified in their own name. */
  hasVerifiedBankAccount: boolean;
}

/** The user's level. Each level needs the ones below it, so a bank account alone does not skip identity. */
export function verificationLevel(f: LadderFacts): VerificationLevel {
  if (!f.identityVerifiedAt) return LEVELS.BASIC;
  return f.hasVerifiedBankAccount ? LEVELS.PAYMENT_READY : LEVELS.VERIFIED;
}

export interface NextStep {
  level: 2 | 3;
  action: 'VERIFY_IDENTITY' | 'ADD_BANK_ACCOUNT';
  unlocks: string[];
}

/** What the user should do next and what it gives them, for the apps to guide them. Null at the top. */
export function nextStep(level: VerificationLevel, types: readonly UserTypeName[]): NextStep | null {
  if (level >= LEVELS.PAYMENT_READY) return null;
  const target = (level + 1) as 2 | 3;
  const unlocks = [...new Set(types.flatMap((t) => UNLOCKS[target][t] ?? []))];
  return { level: target, action: target === 2 ? 'VERIFY_IDENTITY' : 'ADD_BANK_ACCOUNT', unlocks };
}
