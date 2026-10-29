import { applyCountrySettingsChange, parseCountrySettings } from './country-settings.schema.js';

describe('applyCountrySettingsChange', () => {
  it('merges a group key by key and keeps everything else', () => {
    const current = { listings: { confirmAvailabilityDays: 14, duplicateRadiusMetres: 20 }, fees: { feeTaxBps: 750 } };
    const result = applyCountrySettingsChange(current, { listings: { confirmAvailabilityDays: 10 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.listings.confirmAvailabilityDays).toBe(10);
    expect(result.settings.listings.duplicateRadiusMetres).toBe(20);
    expect(result.settings.fees.feeTaxBps).toBe(750);
  });

  it('replaces lists and maps whole, and allows setting an undecided value back to null', () => {
    const current = parseCountrySettings({ verification: { acceptedIdTypes: ['NIN', 'BVN'], idNumberPatterns: { NIN: '^\\d{11}$' } } });
    const result = applyCountrySettingsChange(current, {
      verification: { acceptedIdTypes: ['NIN'], idNumberPatterns: { BVN: '^\\d{11}$' } },
      escrow: { autoReleaseDays: null },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.verification.acceptedIdTypes).toEqual(['NIN']);
    expect(result.settings.verification.idNumberPatterns).toEqual({ BVN: '^\\d{11}$' });
    expect(result.settings.escrow.autoReleaseDays).toBeNull();
  });

  it('refuses unknown settings, values out of range and the wrong shape', () => {
    for (const change of [
      { listings: { confirmAvailabilityDays: 30 } },
      { fees: { escrowTenantBps: 1.5 } },
      { fees: { escrowTenantBps: '150' } },
      { listing: { confirmAvailabilityDays: 10 } },
      { listings: { somethingElse: 1 } },
      { listings: 10 },
    ]) {
      const result = applyCountrySettingsChange({}, change);
      expect(result.ok).toBe(false);
    }
    expect(applyCountrySettingsChange({}, ['fees']).ok).toBe(false);
  });
});
