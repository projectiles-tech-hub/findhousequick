# Project status

Updated: 22 October 2026 (evening). Read this after CLAUDE.md at the start of every build session, and update it at the end.

## Where things stand

- **Repository**: `projectiles-tech-hub/findhousequick` (public during the build; may be made private later).
  The old PHP prototype is in `ecoraegbu/findhousequick-legacy`, for reference only.
- **Release 0 (foundations)**: complete. Delivered in pull request #1. All GitHub checks pass.
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

## Small follow-ups

- `ubuntu-latest` runners are moving to Ubuntu 26. On 22 October 2026 the checks still ran on Ubuntu 24.04;
  confirm CI still passes once GitHub makes the switch. (The GitHub Actions versions were moved to their
  Node.js 24 releases in pull request #3.)

## Waiting for Emmanuel

- Password rules: keep the agreed minimum of 8 characters, or move to at least 10 characters with common and
  leaked passwords blocked and no character-mix rules (discussed 22 October 2026, not yet decided).
- Sign in with Google (and Sign in with Apple for the iPhone release): add to Release 1 or not (discussed
  22 October 2026, not yet decided).
- ADR 0002: confirm the up-to-30-second delay for switch changes, and that country managers can change
  non-critical switches in their own countries without a second approval.
- Decisions Log open points: the five escrow settings, escrow legal structure, launch city, partner API,
  mention of the Agent Emma channel in the launch plan, budget, hiring.

## Next: Release 1, in this order

1. ~~**Accounts**~~: done (pull request #4). Still to do from the accounts area: `DELETE /me` (account deletion) and
   `POST /me/data-export`; both need background jobs. A real SMS adapter (Termii or Twilio) once an account
   is opened. App sign-in screens.
2. **Staff accounts and roles**, then expose the admin feature-rule endpoints (`/admin/feature-rules`) using
   the existing `ControlsService`.
3. **Verification ladder guard** (`VERIFICATION_REQUIRED`), and the identity check flow behind an adapter.
4. **Reference data endpoints**, then buildings, units and the parts checklist.
5. Documents and media upload (private storage adapter), listings and submission, search, saved items,
   messaging, inspections, reports, review tasks.

Each step: build to `docs/api/openapi.yaml`, add unit and API tests, keep CI green, open a pull request.
