import { describe, expect, it } from 'vitest';
import { homesUrl } from './links';

describe('links', () => {
  it('builds the search address from the filters that are set', () => {
    expect(homesUrl({})).toBe('/homes');
    expect(homesUrl({ city: 'Benin City', area: 'GRA', beds: undefined })).toBe('/homes?city=Benin+City&area=GRA');
  });
});
