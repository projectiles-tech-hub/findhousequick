import { z } from 'zod';

/**
 * Settings that apply to the whole platform rather than one country, held in the single PlatformSettings row.
 * Super admins change them through PATCH /v1/admin/platform-settings; every change is recorded.
 * Country-specific values belong in country settings (country-settings.schema.ts), not here.
 */
export const platformSettingsSchema = z.object({
  /**
   * How long a staff device's second step lasts before it must be done again (decision 32: 3 hours).
   * Allowed from 15 minutes to 24 hours.
   */
  staffTwoStepMinutes: z.number().int().min(15).max(24 * 60).default(180),
  /** Property pages one signed-in account may open in an hour, against copying (decision 52). */
  listingViewsPerHour: z.number().int().min(10).max(10_000).default(120),
  /** Property pages one device and network address may open in an hour without signing in (decisions 52 and 75). */
  signedOutListingViewsPerHour: z.number().int().min(10).max(10_000).default(60),
  /** Property pages one network address may open in an hour without signing in, whatever device it claims. */
  signedOutViewsPerAddressPerHour: z.number().int().min(10).max(100_000).default(300),
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

/** The settings that may be sent in a change: any subset, each checked against the rules above. */
export const platformSettingsChangeSchema = platformSettingsSchema.partial().strict();

export function parsePlatformSettings(raw: unknown): PlatformSettings {
  return platformSettingsSchema.parse(raw ?? {});
}
