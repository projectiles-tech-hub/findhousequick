import { describe, expect, it } from 'vitest';
import { checkMessage } from './monitoring.js';

describe('chat monitoring', () => {
  it('passes ordinary messages, including prices', () => {
    expect(checkMessage('Is the flat still available? Rent of N1,500,000 is fine.')).toEqual([]);
    expect(checkMessage('Can I come on Saturday at 10?')).toEqual([]);
  });

  it('finds phone numbers, also written in words or split up', () => {
    expect(checkMessage('call 08031234567')).toContain('PHONE_NUMBER');
    expect(checkMessage('+234 803 123 4567')).toContain('PHONE_NUMBER');
    expect(checkMessage('zero eight zero three one two three four five six seven')).toContain('PHONE_NUMBER');
  });

  it('finds bank details, email addresses and moves off the platform', () => {
    expect(checkMessage('Pay into my account 0123456789 at the bank')).toContain('BANK_DETAILS');
    expect(checkMessage('email me at ade@example.com')).toContain('EMAIL_ADDRESS');
    expect(checkMessage("Let's talk on WhatsApp")).toContain('OFF_PLATFORM');
    expect(checkMessage('just pay me directly')).toContain('OFF_PLATFORM');
  });
});
