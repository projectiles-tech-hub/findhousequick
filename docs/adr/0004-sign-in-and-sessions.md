# ADR 0004: Sign-in, codes and sessions

- Status: Proposed for Emmanuel's confirmation
- Context: Product Specification, Section 3 (Registration and Verification) and Section 15 (Data Protection);
  Decision 5 (everyone registers, free); Release 1 step 1.

## Decision

### One-time SMS codes
- Six digits, valid for 10 minutes, at most 5 wrong guesses per code. Only the newest code for a number counts.
- One code a minute and five an hour per phone number and purpose; plus per-address limits on the routes.
- Only a keyed hash of each code is stored, so a copy of the database does not reveal codes.
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
- After 5 wrong passwords in a row, password sign-in pauses for 15 minutes. Sign-in by SMS code still works,
  so a stranger cannot lock the real owner out.

### Sessions
- An **access token** lasts 15 minutes (`ACCESS_TOKEN_MINUTES`) and is checked on every request.
- A **refresh token** keeps a device signed in for 30 days of inactivity (`REFRESH_TOKEN_DAYS`). It works once;
  each use returns a new one. If a used token comes back, someone copied it, so that device is signed out and
  the event is written to the audit log.
- On every request the server also confirms the account is active and the device has not signed out, so
  suspension and sign-out take effect at once rather than when the access token runs out.

## Points for confirmation
1. Session lengths: 15 minutes for access tokens, 30 days for signed-in devices.
2. Code rules: 10 minutes, 5 guesses, one a minute, five an hour.
3. Password rules: at least 8 characters; 15-minute pause after 5 wrong passwords.
4. Password reset: the API design lists a reset code but no reset endpoint. Codes for reset are refused for now.
   Should a reset endpoint be added to the Release 1 design?
