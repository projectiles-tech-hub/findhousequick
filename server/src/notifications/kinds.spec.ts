import { effectiveSettings, settingsChangeSchema } from './kinds.js';

describe('notification settings', () => {
  it('gives defaults, with SMS off and messages by push only', () => {
    const s = effectiveSettings({});
    expect(s.NEW_MESSAGE).toEqual(['PUSH']);
    expect(Object.values(s).some((c) => c.includes('SMS'))).toBe(false);
  });

  it('applies stored choices over the defaults', () => {
    expect(effectiveSettings({ SAVED_SEARCH_ALERT: ['SMS'] }).SAVED_SEARCH_ALERT).toEqual(['SMS']);
    expect(effectiveSettings({ SAVED_SEARCH_ALERT: [] }).SAVED_SEARCH_ALERT).toEqual([]);
  });

  it('refuses security messages and unknown channels', () => {
    expect(settingsChangeSchema.safeParse({ SECURITY: [] }).success).toBe(false);
    expect(settingsChangeSchema.safeParse({ NEW_MESSAGE: ['FAX'] }).success).toBe(false);
    expect(settingsChangeSchema.safeParse({ NEW_MESSAGE: ['PUSH', 'PUSH'] }).success).toBe(false);
  });
});
