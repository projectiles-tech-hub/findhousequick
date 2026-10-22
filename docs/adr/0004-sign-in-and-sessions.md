# ADR 0004: Sign-in, codes and sessions

- Status: Accepted by Emmanuel on 22 October 2026 (session lengths, code rules and password rules as proposed;
  password reset added to Release 1)
- Context: Product Specification, Section 3 (Registration and Verification) and Section 15 (Data Protection);
  Decision 5 (everyone registers, free); Release 1 step 1.

## Decision

### Phone numbers
- Every phone number is turned into one standard form (E.164, for example `+2348031234567`) with
  libphonenumber-js as soon as it arrives, before any lookup, limit or storage. `+234 0803 123 4567` and
  `+23408031234567` are the same number as `+2348031234567`. Numbers that cannot exist in their country, and
  input with letters or other extra text, are refused. Code: `server/src/common/phone.ts`.

### One-time SMS codes
- Six digits, valid for 10 minutes, at most 5 guesses per code (right or wrong). Only the newest code for a
  number counts.
- The check, the count and the "used" mark are one database statement, so guesses sent at the same moment
  cannot get past the limit. Only one of several simultaneous correct guesses can use a code.
- One code a minute and five an hour per phone number and purpose; plus per-address limits on the routes.
- Only a keyed hash of each code is stored, so a copy of the database does not reveal codes. The key is its own
  secret, `OTP_HASH_SECRET`, separate from the secret that signs access tokens; the server refuses to start if
  the two are the same.
- The answer to "send me a code" is the same whether or not the number is registered, so the API cannot be
  used to find out who has an account. A registration code is not sent to a registered number, and a sign-in
  code is not sent to an unregistered one; both still count towards the limits.
- SMS is sent through an adapter (`server/src/integrations/sms`). The only adapter so far is `log`, which writes
  codes to the server log for development; the server refuses to start in production with it.

### Registration
- Needs a valid registration code, so every account starts at verification level 1 with its phone confirmed.
- Needs consent: the versions of the terms of use and privacy policy the user agreed to are stored with the
  date. The legal documents are still being drafted, so the server stores the version the app sends.
- Follows the `platform.new_registrations` switch for the country (and region or city, when the app says where
  the user is). The country must be switched on, and the language must be one the country offers.

### Passwords
- At least 8 characters. Stored with scrypt (a deliberately slow, salted one-way hash).
- After 5 password attempts without a correct one, password sign-in pauses for 15 minutes. Sign-in by SMS code
  still works, so a stranger cannot lock the real owner out.
- Each attempt is counted before the password is checked, in one database statement, and the attempt that
  reaches the limit starts the pause in that same statement. So attempts sent at the same moment cannot get
  past the limit. A correct password sets the count back to 0.

### Password reset
- `POST /v1/auth/password-reset` with the phone number, a RESET_PASSWORD code and the new password.
- Changes the password, lifts any pause on password sign-in, signs out every device, and is written to the
  audit log. The user then signs in with the new password.

### Sessions
- An **access token** lasts 15 minutes (`ACCESS_TOKEN_MINUTES`) and is checked on every request.
- A **refresh token** keeps a device signed in for 30 days of inactivity (`REFRESH_TOKEN_DAYS`). It works once;
  each use returns a new one. If a used token comes back, someone copied it, so that device is signed out and
  the event is written to the audit log.
- On every request the server also confirms the account is active and the device has not signed out, so
  suspension and sign-out take effect at once rather than when the access token runs out.

## Confirmed
1. Session lengths: 15 minutes for access tokens, 30 days for signed-in devices.
2. Code rules: 10 minutes, 5 guesses, one a minute, five an hour.
3. Password rules: at least 8 characters; 15-minute pause after 5 attempts without a correct password.
4. Password reset by SMS code is part of Release 1, and signs out every device.
