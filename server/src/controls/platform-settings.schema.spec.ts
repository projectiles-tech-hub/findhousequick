import { parsePlatformSettings, platformSettingsChangeSchema } from './platform-settings.schema.js';

describe('platform settings', () => {
  it('defaults the staff second step to 3 hours (decision 32)', () => {
    expect(parsePlatformSettings(undefined)).toEqual({ staffTwoStepMinutes: 180 });
    expect(parsePlatformSettings({})).toEqual({ staffTwoStepMinutes: 180 });
  });

  it('accepts 15 minutes to 24 hours, in whole minutes', () => {
    expect(platformSettingsChangeSchema.safeParse({ staffTwoStepMinutes: 15 }).success).toBe(true);
    expect(platformSettingsChangeSchema.safeParse({ staffTwoStepMinutes: 1440 }).success).toBe(true);
    for (const v of [14, 1441, 60.5, '60', null]) {
      expect(platformSettingsChangeSchema.safeParse({ staffTwoStepMinutes: v }).success).toBe(false);
    }
  });

  it('refuses settings it does not know', () => {
    expect(platformSettingsChangeSchema.safeParse({ unknownSetting: 1 }).success).toBe(false);
  });
});
