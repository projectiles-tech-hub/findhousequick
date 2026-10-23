# Project status

Updated: 22 October 2026 (evening). Read this after CLAUDE.md at the start of every build session, and update it at the end.

## Where things stand

- **Repository**: `projectiles-tech-hub/findhousequick` (public during the build; may be made private later).
  The old PHP prototype is in `ecoraegbu/findhousequick-legacy`, for reference only.
- **Release 0 (foundations)**: mostly complete; delivered in pull request #1. **Not yet done** (Technical
  Architecture, Section 15; found by the specification check, finding 4): screen designs for tenants, landlords,
  agents and staff; the test system on a cloud host (needs the hosting account); the public website code structure.
  - Database design (Release 1 plus escrow ledger) with database-level safety rules
  - Country settings and feature controls (48 switches, approvals, emergency switches, change record)
  - Seed data for Nigeria, Benin City, property types, documents
  - Flutter app foundation (loads switches and country settings from the server)
  - Release 1 API design in `docs/api/openapi.yaml`
  - CI on GitHub Actions; one-command setup in `scripts/setup-dev.sh`

- **Release 1 step 1 (accounts)**: complete. Merged in pull request #4.
  - SMS codes through an adapter (`log` provider for development), registration with consent, sign-in by
    password or code, password reset by code, single-use refresh tokens, sign-out, `GET` and `PATCH /me`
  - Review fixes: code guesses and password attempts counted in single database statements; phone numbers
    in one standard form (libphonenumber-js); separate `OTP_HASH_SECRET` for SMS codes
  - Every route now needs sign-in unless marked `@Public()` (`server/src/accounts/auth.ts`)
  - Design in `docs/adr/0004-sign-in-and-sessions.md` (accepted 22 October 2026)

- **Release 1 step 2 (staff accounts and roles)**: complete. Merged in pull request #7.
  - Staff management by super admins (`/admin/staff`), with every change in the audit log; the first super
    admin is made with `pnpm staff:make-super-admin` (see `docs/DEPLOYMENT.md`)
  - Two-step login for staff, by SMS code or authenticator app; every `/admin` route needs it. It lasts 3 hours
    (a platform setting super admins can change), and must be a different factor from the sign-in: after an
    SMS code sign-in, only an authenticator code (decisions 31 to 34)
  - Feature-rule endpoints (`/admin/feature-rules`) following decision 28: country managers switch off at
    once, everything else they do waits for a super admin, including withdrawal requests
  - Platform settings store and `/admin/platform-settings`, starting with the staff second-step period
  - Design in `docs/adr/0005-staff-accounts-and-two-step-login.md`; decisions 28 to 34 in the Decisions Log

## Small follow-ups

- Technical points from the specification check (finding 21): move rate limits to Redis and start BullMQ with
  the first background job; make sure request logs never record "around me" search locations (Specification 15.2).
- Rare, harmless gap: if a staff member's app renews its sign-in at the very moment they complete the second
  step, the renewed sign-in may not carry the second step, and they are asked to do it again. Not fixed yet.
- `ubuntu-latest` runners are moving to Ubuntu 26. On 22 October 2026 the checks still ran on Ubuntu 24.04;
  confirm CI still passes once GitHub makes the switch. (The GitHub Actions versions were moved to their
  Node.js 24 releases in pull request #3.)

## Waiting for Emmanuel

- Password rules: keep the agreed minimum of 8 characters, or move to at least 10 characters with common and
  leaked passwords blocked and no character-mix rules (discussed 22 October 2026, not yet decided).
- Sign in with Google (and Sign in with Apple for the iPhone release): add to Release 1 or not (discussed
  22 October 2026, not yet decided).
- Before step 3 (identity checks) goes live: which ID documents to accept in Nigeria besides NIN, and how long
  identity images are kept after verification (lawyer). Decisions Log open points 14 and 15; both will be
  country settings, so step 3 can be built before they are settled.
- Whether to build country switching (`PATCH /admin/countries`, still to do from step 2) as a small step
  before step 3 (suggested 22 October 2026).
- Specification check: a decision on each of the 21 findings in
  `docs/reviews/2026-10-22_FindHouseQuick_Specification_Check.docx` (findings 1, 4, 5 and 8 are high priority).
- Decisions Log open points: the five escrow settings, escrow legal structure, launch city, partner API,
  mention of the Agent Emma channel in the launch plan, budget, hiring.

## Next: Release 1, in this order

1. ~~**Accounts**~~: done (pull request #4). Still to do from the accounts area: `DELETE /me` (account deletion) and
   `POST /me/data-export`; both need background jobs. A real SMS adapter (Termii or Twilio) once an account
   is opened. App sign-in screens.
2. ~~**Staff accounts and roles**~~, and the admin feature-rule endpoints: done (pull request #7).
   Still to do from this area: admin screens in the app; two-step login for ordinary users (ADR 0005, point 3);
   `PATCH /admin/countries/{countryCode}` (country settings), which is in the API design but not yet built.
2a. **Check the specification against what is built and designed**: done 22 October 2026. Report in
    `docs/reviews/2026-10-22_FindHouseQuick_Specification_Check.docx` (21 findings; 1, 4, 5 and 8 high priority),
    **waiting for Emmanuel's decisions**. Each decision goes into the Decisions Log, and the API design and this
    note are updated, before any code that depends on it.
2b. **Email** (decisions 35 to 38): email required at registration; sign-up and sign-in with phone or email;
    both confirmed; phone confirmed before any action; email codes for sign-in, the second step and password
    reset; level 1 needs both confirmed; staff can be added by confirmed email; an email adapter (a development provider that logs emails, then a real one). Needs an email sending
    account (see `docs/DEPLOYMENT.md`).
3. **Verification ladder guard** (`VERIFICATION_REQUIRED`), and the identity check flow behind an adapter.
4. **Reference data endpoints**, then buildings, units and the parts checklist.
5. Documents and media upload (private storage adapter), listings and submission, search, saved items,
   messaging, inspections, reports, review tasks.

Each step: build to `docs/api/openapi.yaml`, add unit and API tests, keep CI green, open a pull request.
