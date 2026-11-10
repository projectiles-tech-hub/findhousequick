import type { CountrySettings } from '../controls/country-settings.schema.js';

/**
 * The fixed fees of Release 1 and where each is stored (decision 55). Which of them a country shows on listings is the
 * country setting listings.feeTypes; a fee type that is not shown cannot be charged.
 */
export const FEE_TYPES = {
  AGENCY_FEE: { field: 'agencyFee', column: 'agencyFeeMinor' },
  LEGAL_FEE: { field: 'legalFee', column: 'legalFeeMinor' },
  CAUTION_DEPOSIT: { field: 'cautionDeposit', column: 'cautionDepositMinor' },
  SERVICE_CHARGE: { field: 'serviceCharge', column: 'serviceChargeMinor' },
} as const;
export type FeeType = keyof typeof FEE_TYPES;
export type FeeField = (typeof FEE_TYPES)[FeeType]['field'];

/** The fee fields shown in a country, in the order of the cost box. */
export function shownFees(settings: CountrySettings): { type: FeeType; field: FeeField; column: (typeof FEE_TYPES)[FeeType]['column'] }[] {
  return settings.listings.feeTypes.map((type) => ({ type, ...FEE_TYPES[type] }));
}
