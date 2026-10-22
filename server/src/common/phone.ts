import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { registerDecorator, type ValidationOptions } from 'class-validator';

/*
 * Phone numbers are turned into one standard form (E.164: "+" then country code then number, no spaces)
 * as soon as they arrive, before any lookup, limit or storage. So "+234 0803 123 4567", "+23408031234567"
 * and "+2348031234567" are all the same number, and one person cannot get around limits or register twice
 * by writing their number differently.
 *
 * The full ("max") number database is used, so numbers that are well formed but cannot exist in that
 * country are refused.
 */

/** Only digits and common separators after a leading "+". The library would otherwise ignore extra text. */
const ALLOWED = /^\+[0-9\s().-]{7,30}$/;

/** Returns the standard form of an international number, or null if it is not a valid number. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!ALLOWED.test(text)) return null;
  const parsed = parsePhoneNumberFromString(text);
  return parsed?.isValid() ? parsed.number : null;
}

/** Class-transformer step: replaces a valid number with its standard form; leaves anything else for the validator. */
export const toStandardPhone = ({ value }: { value: unknown }) => normalizePhone(value) ?? value;

/** Validator: the value must already be a valid number in standard form (use after toStandardPhone). */
export function IsStandardPhone(options?: ValidationOptions): PropertyDecorator {
  return (target: object, property: string | symbol) =>
    registerDecorator({
      name: 'isStandardPhone',
      target: target.constructor,
      propertyName: String(property),
      options: {
        message: `${String(property)} must be a valid phone number in international format, e.g. +2348031234567`,
        ...options,
      },
      validator: { validate: (value: unknown) => typeof value === 'string' && normalizePhone(value) === value },
    });
}
