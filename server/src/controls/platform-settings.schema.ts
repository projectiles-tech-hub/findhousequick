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
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

/** The settings that may be sent in a change: any subset, each checked against the rules above. */
export const platformSettingsChangeSchema = platformSettingsSchema.partial().strict();

export function parsePlatformSettings(raw: unknown): PlatformSettings {
  return platformSettingsSchema.parse(raw ?? {});
}
