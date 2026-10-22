import { z } from 'zod';

/**
 * Settings held per country in Country.settings. Every rule that can differ between countries reads
 * its value from here, never from code.
 *
 * A value of null means "not yet decided" (see the Decisions Log open points). Features that depend on
 * an undecided value must stay switched off until it is set.
 */

const bps = z.number().int().min(0).max(10_000);
const minorAmount = z.string().regex(/^\d+$/, 'Amounts are whole minor units written as a string');

export const countrySettingsSchema = z.object({
  fees: z
    .object({
      /** Decision 13: 1.5% paid by the tenant and 1.5% paid by the landlord. */
      escrowTenantBps: bps.default(150),
      escrowLandlordBps: bps.default(150),
      /** Decision 14: 2% paid by the tenant and 2% paid by the landlord. */
      completedRentalTenantBps: bps.default(200),
      completedRentalLandlordBps: bps.default(200),
      /** Tax charged on platform fees, in basis points. Null until set for the country. */
      feeTaxBps: bps.nullable().default(null),
    })
    .prefault({}),

  escrow: z
    .object({
      /** Hours a tenant has to pay once terms are agreed. */
      paymentWindowHours: z.number().int().positive().default(72),
      /** Open point 1: days after key handover before automatic release. */
      autoReleaseDays: z.number().int().positive().nullable().default(null),
      /** Open point 2: days a landlord has to hand over keys after funding. */
      keyHandoverDays: z.number().int().positive().nullable().default(null),
      /** Open point 3: refund the tenant's fee when the landlord is at fault. */
      refundTenantFeeWhenLandlordAtFault: z.boolean().nullable().default(null),
      /** Open point 5: whether rent renewals paid through the platform attract a fee. */
      renewalFeeApplies: z.boolean().nullable().default(null),
      /** Manual releases, refunds and payouts at or above this amount need two approvals. */
      twoPersonApprovalFromMinor: minorAmount.default('50000000'),
    })
    .prefault({}),

  shortLet: z
    .object({
      allowed: z.boolean().default(true),
      releaseHoursAfterCheckIn: z.number().int().positive().default(24),
      damageClaimHours: z.number().int().positive().default(48),
    })
    .prefault({}),

  listings: z
    .object({
      /** Listings expire unless the lister confirms availability within this many days. */
      confirmAvailabilityDays: z.number().int().min(7).max(14).default(14),
      /** Photos must be retaken when a property is relisted after this many months. */
      mediaRefreshMonths: z.number().int().positive().default(6),
      /** Minimum photos for each part of a property. */
      defaultMinPhotosPerPart: z.number().int().min(1).default(2),
      /** Distance in metres within which a new listing is flagged as a possible duplicate. */
      duplicateRadiusMetres: z.number().int().positive().default(15),
    })
    .prefault({}),

  verification: z
    .object({
      identityProvider: z.string().nullable().default(null),
      acceptedIdTypes: z.array(z.string()).default([]),
      /** Percentage of green listings picked for a random site visit. */
      randomAuditPercent: z.number().min(0).max(100).default(2),
      riskBands: z
        .object({ amberFrom: z.number().int().default(30), redFrom: z.number().int().default(60) })
        .prefault({}),
    })
    .prefault({}),

  payments: z
    .object({
      provider: z.string().nullable().default(null),
      /** Hours before a new or changed payout account can receive money. */
      newPayoutAccountWaitHours: z.number().int().min(0).default(48),
    })
    .prefault({}),

  formats: z
    .object({
      areaUnit: z.enum(['SQM', 'SQFT']).default('SQM'),
      dateFormat: z.string().default('dd/MM/yyyy'),
    })
    .prefault({}),
});

export type CountrySettings = z.infer<typeof countrySettingsSchema>;

export function parseCountrySettings(raw: unknown): CountrySettings {
  return countrySettingsSchema.parse(raw ?? {});
}

/** The subset of settings the apps are allowed to see. */
export function publicCountrySettings(s: CountrySettings) {
  return {
    fees: {
      escrowTenantBps: s.fees.escrowTenantBps,
      escrowLandlordBps: s.fees.escrowLandlordBps,
      completedRentalTenantBps: s.fees.completedRentalTenantBps,
      completedRentalLandlordBps: s.fees.completedRentalLandlordBps,
    },
    shortLet: { allowed: s.shortLet.allowed },
    listings: { defaultMinPhotosPerPart: s.listings.defaultMinPhotosPerPart },
    formats: s.formats,
  };
}
