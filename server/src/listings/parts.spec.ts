import { generateParts } from './parts.js';
import { RESIDENTIAL_PARTS } from '../../prisma/seed-data/part-templates.js';

describe('generateParts', () => {
  it('creates one part per bedroom and bathroom for a 3-bedroom flat', () => {
    const parts = generateParts(RESIDENTIAL_PARTS, { bedrooms: 3, bathrooms: 2, toilets: 3 }, 2);
    const codes = parts.map((p) => p.code);
    expect(codes).toContain('bedroom_1');
    expect(codes).toContain('bedroom_3');
    expect(codes).not.toContain('bedroom_4');
    expect(codes).toContain('bathroom_2');
    expect(parts.find((p) => p.code === 'bedroom_2')?.label).toBe('Bedroom 2');
  });

  it('requires a walkthrough video with no photo minimum', () => {
    const parts = generateParts(RESIDENTIAL_PARTS, { bedrooms: 1, bathrooms: 1, toilets: 1 }, 2);
    expect(parts.find((p) => p.code === 'walkthrough')).toMatchObject({ mediaKind: 'VIDEO', minPhotos: 0, required: true });
  });

  it('uses the country default minimum photos unless the template sets one', () => {
    const parts = generateParts(
      [{ code: 'kitchen', label: 'Kitchen' }, { code: 'frontage', label: 'Front', minPhotos: 3 }],
      { bedrooms: 0, bathrooms: 0, toilets: 0 },
      4,
    );
    expect(parts.map((p) => p.minPhotos)).toEqual([4, 3]);
  });

  it('numbers parts in order', () => {
    const parts = generateParts(RESIDENTIAL_PARTS, { bedrooms: 2, bathrooms: 1, toilets: 1 }, 2);
    expect(parts.map((p) => p.sortOrder)).toEqual(parts.map((_, i) => i));
  });

  it('rejects a malformed template', () => {
    expect(() => generateParts([{ code: 'Bad Code', label: '' }], { bedrooms: 0, bathrooms: 0, toilets: 0 }, 2)).toThrow();
  });
});
