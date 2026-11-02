import { z } from 'zod';
import type { CountrySettings } from '../controls/country-settings.schema.js';

/**
 * A unit's details (Product Specification, Section 5.2): finishing, power, water, security, access and occupancy.
 * The choices for each come from the country settings (unitDetails), so each market can use its own. Every field is
 * optional; a change only needs the fields it alters.
 */
export function unitDetailsSchema(settings: CountrySettings) {
  const o = settings.unitDetails;
  const oneOf = (choices: string[]) => z.string().refine((v) => choices.includes(v), { message: `must be one of ${choices.join(', ')}` });
  const someOf = (choices: string[]) => z.array(oneOf(choices)).max(choices.length).refine((a) => new Set(a).size === a.length, { message: 'must not repeat a choice' });
  return z
    .object({
      furnishing: oneOf(o.furnishing),
      power: someOf(o.power),
      water: someOf(o.water),
      security: someOf(o.security),
      roadCondition: oneOf(o.roadCondition),
      parkingSpaces: z.number().int().min(0).max(500),
      whoMayRent: someOf(o.whoMayRent),
      petsAllowed: z.boolean(),
      maxOccupants: z.number().int().min(1).max(100),
      /** Floor finish, ceiling, kitchen fittings, wardrobes, air conditioning and similar, as short values. */
      finishing: z.record(z.string().max(40), z.union([z.string().max(100), z.boolean(), z.number()])).refine((r) => Object.keys(r).length <= 30, {
        message: 'has too many entries',
      }),
    })
    .partial()
    .strict();
}

export type UnitDetails = z.infer<ReturnType<typeof unitDetailsSchema>>;

/** Checks details against the country's choices; returns the cleaned details or the problems found. */
export function checkUnitDetails(raw: unknown, settings: CountrySettings): { ok: true; details: UnitDetails } | { ok: false; problems: string[] } {
  const parsed = unitDetailsSchema(settings).safeParse(raw ?? {});
  if (parsed.success) return { ok: true, details: parsed.data };
  return { ok: false, problems: parsed.error.issues.map((i) => `${i.path.join('.') || 'details'}: ${i.message}`) };
}
