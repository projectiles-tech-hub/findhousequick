import { registerDecorator, type ValidationOptions } from 'class-validator';
import { apiError } from '../common/api-error.js';
import { normalizePhone } from '../common/phone.js';

/*
 * A contact is a phone number or an email address (decision 35). Both are kept in one standard form:
 * phone numbers in E.164 (see src/common/phone.ts), email addresses trimmed and in lower case.
 */

export type Channel = 'SMS' | 'EMAIL';

export interface Contact {
  channel: Channel;
  /** E.164 phone number, or lower-case email address. */
  destination: string;
}

/** A reasonable email check: something@something.something, no spaces, at most 254 characters. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns the standard form of an email address, or null if it is not a valid address. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().toLowerCase();
  return text.length <= 254 && EMAIL.test(text) ? text : null;
}

/** Class-transformer step: replaces a valid email with its standard form; leaves anything else for the validator. */
export const toStandardEmail = ({ value }: { value: unknown }) => normalizeEmail(value) ?? value;

/**
 * The single contact a request names, from its `phone` and `email` fields (already in standard form).
 * Exactly one must be given.
 */
export function oneContact(dto: { phone?: string; email?: string }): Contact {
  if (!!dto.phone === !!dto.email) {
    throw apiError(400, 'BAD_REQUEST', 'Give either a phone number or an email address.');
  }
  return dto.phone ? { channel: 'SMS', destination: dto.phone } : { channel: 'EMAIL', destination: dto.email! };
}

/** A contact from a channel and a raw value, put in standard form; throws a clear error if the value is invalid. */
export function contactOf(channel: Channel, raw: unknown): Contact {
  const destination = channel === 'SMS' ? normalizePhone(raw) : normalizeEmail(raw);
  if (!destination) {
    throw apiError(
      400,
      'BAD_REQUEST',
      channel === 'SMS'
        ? 'Give a valid phone number in international format, e.g. +2348031234567.'
        : 'Give a valid email address.',
    );
  }
  return { channel, destination };
}

/** The user field that holds each kind of contact, and the field recording when it was confirmed. */
export const FIELDS = {
  SMS: { value: 'phone', confirmedAt: 'phoneVerifiedAt' },
  EMAIL: { value: 'email', confirmedAt: 'emailVerifiedAt' },
} as const;

/** "+2348031234567" becomes "+234*******567"; "ada@example.com" becomes "a**@example.com". For logs. */
export function maskContact(c: Contact): string {
  if (c.channel === 'SMS') {
    const p = c.destination;
    return p.length <= 7 ? '***' : p.slice(0, 4) + '*'.repeat(p.length - 7) + p.slice(-3);
  }
  const [name, domain] = c.destination.split('@');
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(name.length - 1, 2))}@${domain}`;
}

/** Validator: the value must already be a valid email address in standard form (use after toStandardEmail). */
export function IsStandardEmail(options?: ValidationOptions): PropertyDecorator {
  return (target: object, property: string | symbol) =>
    registerDecorator({
      name: 'isStandardEmail',
      target: target.constructor,
      propertyName: String(property),
      options: { message: `${String(property)} must be a valid email address`, ...options },
      validator: { validate: (value: unknown) => typeof value === 'string' && normalizeEmail(value) === value },
    });
}
