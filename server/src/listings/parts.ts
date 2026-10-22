import { z } from 'zod';

/**
 * Builds the media checklist for a unit from its property type's part template
 * (Product Specification, Section 5.3). Example: a 3-bedroom flat gets Bedroom 1, 2 and 3.
 */

export const partTemplateItemSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  required: z.boolean().default(true),
  /** Minimum photos; 0 for video-only items. Falls back to the country default when omitted. */
  minPhotos: z.number().int().min(0).optional(),
  /** Repeat this part once per bedroom, bathroom or toilet in the unit. */
  repeat: z.enum(['bedrooms', 'bathrooms', 'toilets']).optional(),
  mediaKind: z.enum(['PHOTO', 'VIDEO']).default('PHOTO'),
});

export const partTemplateSchema = z.array(partTemplateItemSchema);
export type PartTemplateItem = z.infer<typeof partTemplateItemSchema>;

export interface UnitCounts {
  bedrooms: number;
  bathrooms: number;
  toilets: number;
}

export interface GeneratedPart {
  code: string;
  label: string;
  required: boolean;
  minPhotos: number;
  mediaKind: 'PHOTO' | 'VIDEO';
  sortOrder: number;
}

export function generateParts(template: unknown, counts: UnitCounts, defaultMinPhotos: number): GeneratedPart[] {
  const items = partTemplateSchema.parse(template);
  const parts: GeneratedPart[] = [];
  for (const item of items) {
    const minPhotos = item.mediaKind === 'VIDEO' ? 0 : (item.minPhotos ?? defaultMinPhotos);
    const times = item.repeat ? Math.max(0, Math.floor(counts[item.repeat])) : 1;
    for (let i = 1; i <= times; i++) {
      parts.push({
        code: item.repeat ? `${item.code}_${i}` : item.code,
        label: item.repeat ? `${item.label} ${i}` : item.label,
        required: item.required,
        minPhotos,
        mediaKind: item.mediaKind,
        sortOrder: parts.length,
      });
    }
  }
  return parts;
}
