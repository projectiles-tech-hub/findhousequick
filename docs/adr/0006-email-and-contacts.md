# ADR 0006: Email, and confirming phone numbers and email addresses

- Status: Built to decisions 35 to 38 (Decisions Log, 22 October 2026). One reading is marked for confirmation below.
- Context: Product Specification, Sections 3.2 to 3.4 (level 1 needs phone and email); ADR 0004 (codes, sign-in,
  password reset); ADR 0005 (staff second step).

## Decision

### Contacts
- A **contact** is a phone number or an email address. Phone numbers are kept in one standard form (ADR 0004);
  email addresses are trimmed and kept in lower case, so `Ada@Example.com` and `ada@example.com` are the same.
- Every account has both. Each is either **confirmed** (proved with a code sent to it) or not.

### Registration (decision 35)
- Phone and email are both required. The user chooses which one receives the registration code (`signUpWith`);
  that one is confirmed at once, and the other is confirmed afterwards.
- Until both are confirmed the user is at **level 0** and can only browse. Level 1 needs both (decision 37).
  Because every action beyond browsing needs at least level 1, the phone is always confirmed before any action,
  as decision 35 requires. The app is told what to do next (`CONFIRM_PHONE` first, then `CONFIRM_EMAIL`).

### One rule for both contacts
- A contact is only **added or changed once it is confirmed**, through `POST /v1/me/contacts/code` and
  `POST /v1/me/contacts/confirm`. The email can no longer be changed through `PATCH /v1/me`.
- **Squatting is not possible.** If someone types another person's email address into their own account
  without confirming it, the real owner can still register with it or confirm it: the address is
  **released** from the account that never confirmed it, and the release is written to the audit log.
- A contact **another account has confirmed** cannot be taken. Codes are not sent for it, and confirming it
  is refused.
- **Replacing a confirmed contact** needs the current password (counted against the password limit), and a
  notice goes to the old contact. So someone holding only a stolen session cannot quietly move the account to
  their own phone or email.

### Codes and sign-in
- Codes go by SMS or by email, with the same rules (ADR 0004): 10 minutes, 5 guesses, one a minute and five an
  hour for each phone number or email address.
- **Sign-in** works with either contact, by password or by a code sent to it (decision 35).
- **Sign-in and password-reset codes** are only sent to a contact an active account has **confirmed**, and a
  code only signs in through a confirmed contact. Otherwise the owner of a mistyped address could get into a
  stranger's account.
- **Password reset** works by SMS or by email, as the user chooses (decision 36).

### Staff second step (decision 36)
- It never uses the channel the device signed in with: after an SMS code, an email code or the authenticator;
  after an email code, an SMS code or the authenticator.
- After a password it is offered in this order: authenticator app (if set up), then email code, then SMS code.
  `GET /v1/auth/two-step/options` gives the order, and whether each option is ready.
- A code by phone or email needs that contact to be confirmed.

### Staff accounts (decision 38)
- Super admins can add staff by **confirmed** phone number or **confirmed** email address. A contact nobody
  has proved they own never gives staff rights. The first super admin command also needs a confirmed phone.

### Email sending
- Email goes through an adapter (`server/src/integrations/email`), like SMS. The only adapter so far is `log`,
  which writes emails to the server log for development; the server refuses to start in production with it.
  The sender address is `EMAIL_FROM`.

## For confirmation

1. **Level 0 and actions.** Decision 35 says a confirmed phone is needed for any action, and decision 37 says
   level 1 needs both contacts. Read together, every action beyond browsing needs both phone and email
   confirmed (level 1). The verification ladder check in step 3 will enforce it that way.
