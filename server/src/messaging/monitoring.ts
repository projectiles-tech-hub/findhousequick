/**
 * Automatic chat monitoring (Specification 6.1 and the API design): messages are checked for phone numbers, bank
 * details, email addresses and attempts to move the deal off the platform. The message is still sent; the sender
 * sees a warning and the finding is logged for the trust team. Users are told about this in the terms of use.
 */
export type ChatFlag = 'PHONE_NUMBER' | 'BANK_DETAILS' | 'EMAIL_ADDRESS' | 'OFF_PLATFORM';

export const WARNING =
  'For your safety, keep contact and payment on FindHouseQuick until an inspection is booked. Payments made outside the platform are not protected.';

// Digit groups of 10 or more digits, allowing spaces, dots, dashes and brackets between them, and a leading +.
const PHONE = /(?:\+?\d[\s.\-()]*){10,15}/;
// A 10-digit account number next to a word about banks or accounts.
const BANK_WORDS = /\b(acc(?:oun)?t|a\/c|acct|bank|iban|swift|sort code|routing|transfer to|send (?:the )?money)\b/i;
const ACCOUNT_NUMBER = /\b\d{10}\b|\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const OFF_PLATFORM =
  /\b(whats\s?app|telegram|signal app|call me on|text me on|my number is|reach me on|dm me|pay (?:me )?(?:directly|cash|outside)|outside (?:the )?(?:app|platform)|off (?:the )?(?:app|platform))\b/i;

/** Finds what a message contains that should stay on the platform. */
export function checkMessage(text: string): ChatFlag[] {
  const flags: ChatFlag[] = [];
  // Words for digits ("zero eight zero...") are turned into digits first, a common way around number checks.
  const normalised = text.toLowerCase().replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => String(DIGIT_WORDS[w]));
  const bank = BANK_WORDS.test(text) && ACCOUNT_NUMBER.test(normalised.toUpperCase().replace(/\s+/g, ' '));
  if (bank) flags.push('BANK_DETAILS');
  else if (PHONE.test(normalised)) flags.push('PHONE_NUMBER');
  if (EMAIL.test(text)) flags.push('EMAIL_ADDRESS');
  if (OFF_PLATFORM.test(text)) flags.push('OFF_PLATFORM');
  return flags;
}

const DIGIT_WORDS: Record<string, number> = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
