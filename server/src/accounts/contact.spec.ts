import { contactOf, maskContact, normalizeEmail, oneContact } from './contact.js';
import { allowedMethods } from '../staff/two-step.service.js';

describe('contacts', () => {
  it('puts email addresses in one standard form', () => {
    expect(normalizeEmail('  Ada.Obi@Example.COM ')).toBe('ada.obi@example.com');
    for (const bad of ['ada', 'ada@', '@example.com', 'ada@example', 'a da@example.com', 42, null]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
    expect(normalizeEmail(`${'a'.repeat(250)}@x.co`)).toBeNull();
  });

  it('needs exactly one of phone or email', () => {
    expect(oneContact({ phone: '+2348031234567' })).toEqual({ channel: 'SMS', destination: '+2348031234567' });
    expect(oneContact({ email: 'ada@example.com' })).toEqual({ channel: 'EMAIL', destination: 'ada@example.com' });
    expect(() => oneContact({})).toThrow();
    expect(() => oneContact({ phone: '+2348031234567', email: 'ada@example.com' })).toThrow();
  });

  it('reads a contact for a channel in standard form, and refuses invalid values', () => {
    expect(contactOf('SMS', '+234 0803 123 4567')).toEqual({ channel: 'SMS', destination: '+2348031234567' });
    expect(contactOf('EMAIL', ' ADA@example.com')).toEqual({ channel: 'EMAIL', destination: 'ada@example.com' });
    expect(() => contactOf('SMS', 'ada@example.com')).toThrow();
    expect(() => contactOf('EMAIL', '+2348031234567')).toThrow();
  });

  it('masks contacts for logs', () => {
    expect(maskContact({ channel: 'SMS', destination: '+2348031234567' })).toBe('+234*******567');
    expect(maskContact({ channel: 'EMAIL', destination: 'ada@example.com' })).toBe('a**@example.com');
  });
});

describe('second-step choices (decision 36)', () => {
  it('never uses the channel the device signed in with, and offers the authenticator first', () => {
    expect(allowedMethods('PASSWORD')).toEqual(['AUTHENTICATOR', 'EMAIL', 'SMS']);
    expect(allowedMethods('SMS_CODE')).toEqual(['AUTHENTICATOR', 'EMAIL']);
    expect(allowedMethods('EMAIL_CODE')).toEqual(['AUTHENTICATOR', 'SMS']);
  });
});
