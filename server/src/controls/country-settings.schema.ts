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
      /** Which identity provider runs NIN, selfie and liveness checks (ADR 0007). Null: checks unavailable. */
      identityProvider: z.string().nullable().default(null),
      /** ID types accepted for the identity check, e.g. ["NIN"]. */
      acceptedIdTypes: z.array(z.string()).default([]),
      /**
       * Pattern each ID number must match, per ID type, checked after spaces and dashes are removed and letters
       * are made capitals. An ID type without a pattern is accepted if it has 4 to 30 letters and digits.
       */
      idNumberPatterns: z.record(z.string(), z.string()).default({}),
      /**
       * Document types (codes from the country's document types, purpose IDENTITY) accepted as a photo when the ID
       * check fails or does not match (decision 49).
       */
      idDocumentTypes: z.array(z.string()).default([]),
      /** Identity checks one user may start in 24 hours; each one costs money with the provider. */
      maxIdentityChecksPerDay: z.number().int().min(1).max(20).default(3),
      /** Percentage of green listings picked for a random site visit. */
      randomAuditPercent: z.number().min(0).max(100).default(2),
      riskBands: z
        .object({ amberFrom: z.number().int().default(30), redFrom: z.number().int().default(60) })
        .prefault({}),
    })
    .prefault({}),

  /** How long personal data is kept (decision 55). Null means not yet set (open point 15). */
  retention: z
    .object({
      /** Days identity document photos are kept after the check they belong to is closed. Set after legal advice. */
      identityImagesDays: z.number().int().positive().nullable().default(null),
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

/** The full settings with every default filled in; used to tell which keys exist. */
const DEFAULTS = parseCountrySettings({}) as unknown as Record<string, unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Applies a partial change to a country's stored settings and checks the result.
 *
 * Groups (fees, escrow, listings and so on) are merged key by key, so a change only needs the values it
 * alters. Lists and maps (such as acceptedIdTypes or idNumberPatterns) are replaced whole. Unknown settings
 * are refused rather than quietly dropped, so a typing mistake cannot look like a successful change.
 *
 * Returns the settings to store, or the list of problems.
 */
export function applyCountrySettingsChange(
  current: unknown,
  change: unknown,
): { ok: true; settings: CountrySettings } | { ok: false; problems: string[] } {
  if (!isPlainObject(change)) return { ok: false, problems: ['settings: must be an object'] };
  const problems: string[] = [];
  const merge = (base: Record<string, unknown>, patch: Record<string, unknown>, shape: Record<string, unknown>, path: string) => {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      const where = path ? `${path}.${key}` : key;
      if (!(key in shape)) {
        problems.push(`${where}: not a known setting`);
        continue;
      }
      const model = shape[key];
      if (isPlainObject(model) && Object.keys(model).length > 0) {
        if (!isPlainObject(value)) {
          problems.push(`${where}: must be a group of settings`);
          continue;
        }
        out[key] = merge(isPlainObject(base[key]) ? (base[key] as Record<string, unknown>) : {}, value, model, where);
      } else {
        out[key] = value;
      }
    }
    return out;
  };
  const stored = isPlainObject(current) ? current : {};
  const merged = merge(stored, change, DEFAULTS, '');
  if (problems.length) return { ok: false, problems };
  const parsed = countrySettingsSchema.safeParse(merged);
  if (!parsed.success) {
    return { ok: false, problems: parsed.error.issues.map((i) => `${i.path.join('.') || 'settings'}: ${i.message}`) };
  }
  return { ok: true, settings: parsed.data };
}
