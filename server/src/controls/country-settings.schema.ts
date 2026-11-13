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
      /** A photo or video must be uploaded within this many hours of being taken with the app's camera (ADR 0009). */
      maxCaptureAgeHours: z.number().int().min(1).max(720).default(72),
      /** A photo or video must be taken within this many metres of the building, plus the phone's reported accuracy. */
      captureRadiusMetres: z.number().int().min(10).max(1000).default(100),
      /**
       * Before an inspection is confirmed, a listing's map position is moved by up to this many metres, the same way
       * every time, so the exact building stays private (Specification 4.3).
       */
      approximateLocationMetres: z.number().int().min(100).max(2000).default(300),
      /**
       * Which of the fixed fees are shown on listings in this country, in the order of the cost box (decision 55).
       * A fee type that is not listed cannot be charged: listers cannot enter it and it is not shown.
       */
      feeTypes: z
        .array(z.enum(['AGENCY_FEE', 'LEGAL_FEE', 'CAUTION_DEPOSIT', 'SERVICE_CHARGE']))
        .refine((a) => new Set(a).size === a.length, { message: 'must not repeat a fee type' })
        .default(['AGENCY_FEE', 'LEGAL_FEE', 'CAUTION_DEPOSIT', 'SERVICE_CHARGE']),
    })
    .prefault({}),

  scouts: z
    .object({
      /**
       * The fixed referral reward for the first rental of a unit, in whole minor units (kobo). Not set until
       * Emmanuel decides the amount (Decisions Log open point 16); while it is not set, no reward becomes eligible.
       */
      rewardMinor: z
        .string()
        .regex(/^[1-9]\d{0,14}$/)
        .nullable()
        .default(null),
      /** How near the landlord's building must be to the scout's pin to count as the reported property. */
      matchRadiusMetres: z.number().int().min(20).max(2000).default(150),
    })
    .prefault({}),

  inspections: z
    .object({
      /** A slot can be booked only this many minutes or more before it starts, so the lister has notice. */
      minLeadMinutes: z.number().int().min(0).max(10_080).default(120),
      /** How many days ahead slots can be booked. */
      maxDaysAhead: z.number().int().min(1).max(90).default(30),
      /** How many times one inspection's details can be sent to a trusted contact; each SMS costs money. */
      maxSafetyShares: z.number().int().min(1).max(10).default(3),
      /** Hours before a confirmed inspection that both sides are reminded of it. */
      reminderHoursBefore: z.number().int().min(1).max(72).default(3),
      /** Hours after a completed inspection's time that both sides are asked the follow-up questions (Specification 14.2). */
      followUpHoursAfter: z.number().int().min(0).max(72).default(2),
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
      /** Points each automatic check adds to a listing's risk score when it finds something (Specification 6.4). */
      riskPoints: z
        .object({
          /** Ownership documents the verification team has not yet matched to the owner's name. */
          nameMatchPending: z.number().int().min(0).max(100).default(30),
          /** Another building with an open listing at the same spot or address. */
          duplicateLocation: z.number().int().min(0).max(100).default(40),
          /** A photo that matches one on another building. */
          duplicatePhoto: z.number().int().min(0).max(100).default(40),
          /** A document number already used on another building. */
          duplicateDocument: z.number().int().min(0).max(100).default(60),
          /** A tenant said after an inspection that the property did not match the listing. */
          tenantMismatch: z.number().int().min(0).max(100).default(20),
        })
        .prefault({}),
      /** Different people blocking one account before it goes to the trust team for review (decision 88). */
      blocksForReview: z.number().int().min(2).max(100).default(5),
      /** Two photo fingerprints (64 bits) differing in this many bits or fewer count as the same photo. */
      photoMatchBits: z.number().int().min(0).max(16).default(6),
    })
    .prefault({}),

  /** What the maps provider is asked for in this country (ADR 0015). */
  maps: z
    .object({
      /** The kinds of amenity shown near a property, from the platform's own list. */
      amenityKinds: z
        .array(z.enum(['school', 'hospital', 'pharmacy', 'market', 'bank', 'fuel_station', 'bus_stop', 'place_of_worship', 'police']))
        .default(['school', 'hospital', 'market', 'bus_stop', 'bank']),
      /** How far from a property amenities are looked for, and how many are shown. */
      amenityRadiusMetres: z.number().int().min(200).max(10_000).default(2000),
      amenityLimit: z.number().int().min(0).max(20).default(8),
      /** Days an answer from the provider is kept before it is asked again. */
      keepAnswersDays: z.number().int().min(1).max(365).default(30),
    })
    .prefault({}),

  /** How long personal data is kept (decision 55). Null means not yet set (open point 15). */
  retention: z
    .object({
      /** Days identity document photos are kept after the check they belong to is closed. Set after legal advice. */
      identityImagesDays: z.number().int().positive().nullable().default(null),
      /** Days a user's copy of their own data can be downloaded before it is deleted (Specification 15.2). */
      dataExportLinkDays: z.number().int().min(1).max(30).default(7),
      /** Hours a user waits between two copies of their data, so the work of making one is not repeated needlessly. */
      dataExportEveryHours: z.number().int().min(0).max(168).default(24),
    })
    .prefault({}),

  payments: z
    .object({
      provider: z.string().nullable().default(null),
      /** Hours before a new or changed payout account can receive money. */
      newPayoutAccountWaitHours: z.number().int().min(0).default(48),
    })
    .prefault({}),

  /**
   * The choices offered for each unit detail (Product Specification, Section 5.2). Tenants filter by these, so they
   * are fixed lists per country rather than free text. A unit's details are checked against them.
   */
  unitDetails: z
    .object({
      furnishing: z.array(z.string()).default(['UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED']),
      power: z.array(z.string()).default(['PUBLIC_SUPPLY', 'PREPAID_METER', 'SHARED_METER', 'GENERATOR', 'INVERTER', 'SOLAR']),
      water: z.array(z.string()).default(['BOREHOLE', 'PUBLIC_SUPPLY', 'TREATED']),
      security: z.array(z.string()).default(['FENCED', 'GATED', 'GUARD', 'CCTV', 'ESTATE_SECURITY']),
      roadCondition: z.array(z.string()).default(['TARRED', 'PARTLY_TARRED', 'UNTARRED']),
      whoMayRent: z.array(z.string()).default(['SINGLES', 'FAMILIES', 'STUDENTS', 'CORPORATE']),
    })
    .prefault({}),

  formats: z
    .object({
      areaUnit: z.enum(['SQM', 'SQFT']).default('SQM'),
      dateFormat: z.string().default('dd/MM/yyyy'),
    })
    .prefault({}),

  /**
   * Which version of the terms of use and the privacy policy a new user agrees to in this country. They are the
   * dates shown on those pages; change them here whenever the pages change, so each account records what it agreed to.
   */
  legal: z
    .object({
      termsVersion: z.string().min(1).max(40).default('2026-11-10'),
      privacyVersion: z.string().min(1).max(40).default('2026-11-10'),
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
    listings: { defaultMinPhotosPerPart: s.listings.defaultMinPhotosPerPart, feeTypes: s.listings.feeTypes },
    inspections: { minLeadMinutes: s.inspections.minLeadMinutes, maxDaysAhead: s.inspections.maxDaysAhead },
    // The choices offered in forms and search filters.
    unitDetails: s.unitDetails,
    formats: s.formats,
    legal: s.legal,
    // What the identity screens need: which ID types are accepted and how their numbers look, which documents
    // may be added as a photo, and whether a check can be started at all. The provider's name is not given out.
    verification: {
      identityCheckAvailable: s.verification.identityProvider !== null,
      acceptedIdTypes: s.verification.acceptedIdTypes,
      idNumberPatterns: s.verification.idNumberPatterns,
      idDocumentTypes: s.verification.idDocumentTypes,
    },
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
