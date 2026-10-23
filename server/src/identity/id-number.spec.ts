import { idLookupHash, idNumberFits, last4, namesMatch, nameWords, standardIdNumber } from './id-number.js';
import { outcomeOf } from './identity.service.js';

describe('ID numbers', () => {
  it('puts numbers in one standard form', () => {
    expect(standardIdNumber(' 1234 567-8901 ')).toBe('12345678901');
    expect(standardIdNumber('a12.34-b')).toBe('A1234B');
  });

  it("checks numbers against the country's pattern, or a safe fallback", () => {
    const nin = '^[0-9]{11}$';
    expect(idNumberFits('12345678901', nin)).toBe(true);
    expect(idNumberFits('1234567890', nin)).toBe(false);
    expect(idNumberFits('1234567890A', nin)).toBe(false);
    expect(idNumberFits('A1234567', undefined)).toBe(true);
    expect(idNumberFits('A1', undefined)).toBe(false);
  });

  it('refuses every number when a pattern in the settings is broken', () => {
    expect(idNumberFits('12345678901', '([0-9')).toBe(false);
  });

  it('gives the same fingerprint for the same ID, and different ones otherwise', () => {
    const a = idLookupHash('s'.repeat(40), 'NG', 'NIN', '12345678901');
    expect(idLookupHash('s'.repeat(40), 'NG', 'NIN', '12345678901')).toBe(a);
    expect(idLookupHash('s'.repeat(40), 'NG', 'NIN', '12345678902')).not.toBe(a);
    expect(idLookupHash('t'.repeat(40), 'NG', 'NIN', '12345678901')).not.toBe(a);
    expect(a).not.toContain('12345678901');
  });

  it('shows only the last four characters', () => {
    expect(last4('12345678901')).toBe('8901');
  });
});

describe('names on IDs', () => {
  it('compares words without accents, case or punctuation', () => {
    expect(nameWords("Adébáyọ̀ O'Neil-Okafor")).toEqual(['adebayo', 'oneil', 'okafor']);
  });

  it('accepts a middle name and any order', () => {
    expect(namesMatch('Chidi', 'Okafor', 'OKAFOR CHIDI EMEKA')).toBe(true);
    expect(namesMatch('Adebayo', 'Ogunlesi', 'Adébáyọ̀ Ogunlesi')).toBe(true);
  });

  it('sends anything less clear to the verification team', () => {
    expect(namesMatch('Chidi', 'Okafor', 'Chidi Okeke')).toBe(false);
    expect(namesMatch('Chidi', 'Okafor', null)).toBe(false);
    expect(namesMatch('', '', 'Chidi Okafor')).toBe(false);
  });
});

describe('what a provider result means (decision 49)', () => {
  const user = { firstName: 'Chidi', lastName: 'Okafor' };
  const good = { reference: 'r', idFound: true, nameOnId: 'Chidi Okafor', livenessPassed: true, faceMatched: true, faceMatchScore: 92 };

  it('passes a clear result', () => {
    expect(outcomeOf(good, user)).toEqual({ status: 'PASSED', failureReason: null, nextAction: null });
  });

  it('asks for a new attempt, not a document, when liveness fails', () => {
    expect(outcomeOf({ ...good, livenessPassed: false }, user)).toEqual({
      status: 'FAILED',
      failureReason: 'LIVENESS_FAILED',
      nextAction: null,
    });
  });

  it('offers a document photo when the ID is not found or the face does not match', () => {
    expect(outcomeOf({ ...good, idFound: false }, user)).toMatchObject({ status: 'FAILED', nextAction: 'UPLOAD_ID_DOCUMENT' });
    expect(outcomeOf({ ...good, faceMatched: false }, user)).toMatchObject({
      status: 'FAILED',
      failureReason: 'FACE_MISMATCH',
      nextAction: 'UPLOAD_ID_DOCUMENT',
    });
  });

  it('sends a name that does not match to the verification team, with a document photo allowed', () => {
    expect(outcomeOf({ ...good, nameOnId: 'Emeka Obi' }, user)).toEqual({
      status: 'MANUAL_REVIEW',
      failureReason: 'NAME_MISMATCH',
      nextAction: 'UPLOAD_ID_DOCUMENT',
    });
  });
});
