# Project status

Updated: 23 October 2026. Read this after CLAUDE.md at the start of every build session, and update it at the end.

## Where things stand

- **Repository**: `projectiles-tech-hub/findhousequick` (public during the build; may be made private later).
  The old PHP prototype is in `ecoraegbu/findhousequick-legacy`, for reference only.
- **Release 0 (foundations)**: mostly complete; delivered in pull request #1. **Not yet done** (Technical
  Architecture, Section 15; found by the specification check, finding 4): screen designs for tenants, landlords,
  agents and staff (now the design step 2c below, decisions 42 and 67); the test system on a cloud host (after the
  hosting account, which needs a company dollar card); the public website code structure (with step 5).
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

- **Specification check**: report merged in pull request #9; all 21 findings decided by Emmanuel on 23 October
  2026 (decisions 39 to 59, finding n recorded as decision 38 + n). Each decision is written into its row of
  the report itself (`docs/reviews/2026-10-22_FindHouseQuick_Specification_Check.docx`). The API design and
  the Product Specification (to version 1.4) were updated to match; with the document index and the decision
  procedure (decisions 60 to 63), merged in pull request #10.

- **Release 1 step 2b (email)**: complete. Merged in pull request #11. Email required at registration; sign-up and sign-in with phone or email; both confirmed, with
  level 0 (browse only) until they are; contacts added or changed only once confirmed, and released from an
  account that never confirmed them; codes by SMS or email for sign-in, the staff second step and password reset;
  staff added by confirmed email; an email adapter (development provider that logs emails). Design in
  `docs/adr/0006-email-and-contacts.md`. Still to do from this step: a real email provider adapter once the
  account is opened.

- **Release 1 step 2c (screen designs)**: started. Decision 67 (Penpot instead of Figma) and the design system
  merged in pull request #16. The design system is in Emmanuel's Penpot file "Release 1 Screens", page "00 Design
  system": colours, text styles, spacing and touch size, icons, buttons and chips, form fields, cards and notices,
  map pins, and a Pidgin length check. Merging #16 recorded the decision and the files; it is not the approval of
  the designs. Colours approved by Emmanuel on 23 October 2026. Icons redrawn the same day as the app's own set,
  to a standard above Font Awesome Pro, with outline and filled styles (decision 68). Font changed to Source Sans 3
  (decision 69), because Roboto lacks the Yoruba letter ṣ. On 23 October 2026 Emmanuel
  approved the whole design system and asked for the screens to start (review states are kept in
  `docs/designs.md`). The first group of screens, sign-up and sign-in (9 phone screens), was approved the same day.
  The app sign-up and sign-in screens may now be built from it (step 6); no app screen built yet.

- **Release 1 step 3, first part (verification ladder and identity checks)**: complete. Merged in pull request
  #13. The server refuses actions above the user's level (`VERIFICATION_REQUIRED`, decision 64); identity
  checks (NIN, selfie, liveness) through a provider adapter, with a test provider for development; one ID on two
  accounts sent to the verification team; agent company details (decision 50); data retention country setting
  (decision 55). Design in `docs/adr/0007-verification-ladder-and-identity-checks.md`.

- **Release 1 step 3, second part (identity documents and the verification queue)**: complete. Merged in pull
  request #14. Private document upload through a storage adapter (local provider for
  development), checked by size and SHA-256; a document photo added to a failed check (decision 49); the
  verification team's queue and decisions for identity checks, duplicate IDs and agent company details; staff
  document views recorded with the reason; hourly deletion of photos whose retention period has ended (first
  background job, BullMQ). Still to do from step 3: real identity and storage provider adapters once the accounts
  are opened; app screens.

## Small follow-ups

- Technical points from the specification check (finding 21): move rate limits to Redis (they are still counted in
  each server's memory; BullMQ was started in pull request #14); make sure request logs never record "around me" search locations (Specification 15.2).
- Rare, harmless gap: if a staff member's app renews its sign-in at the very moment they complete the second
  step, the renewed sign-in may not carry the second step, and they are asked to do it again. Not fixed yet.
- `ubuntu-latest` runners are moving to Ubuntu 26. On 22 October 2026 the checks still ran on Ubuntu 24.04;
  confirm CI still passes once GitHub makes the switch. (The GitHub Actions versions were moved to their
  Node.js 24 releases in pull request #3.)

## Waiting for Emmanuel

- Review of each group of screens as it is sent (step 2c); each group waits for approval before the next starts.
- Before identity checks go live: how long identity images are kept after verification, after legal advice
  (Decisions Log open point 15). Step 3 is built with this as a country setting (decision 55) that is not yet set.
- A company dollar card, so the hosting account (and the test system) can be opened (decision 42).
- Whether to build country settings changes (`PATCH /admin/countries`, still to do from step 2) as a small step
  before step 4 (suggested 22 October 2026, when it was proposed for before step 3; step 3 is now done).
- Scouts and the referral reward (decision 70): the five questions at the end of ADR 0008 (level to be a scout,
  what counts as one property, which fee payment earns the reward, invitation expiry, payout approval), and
  Decisions Log open points 16 to 19: the reward amount, which release, and, before it goes live, state estate
  agency rules and withholding tax.
- Decisions Log open points: the five escrow settings, escrow legal structure, launch city, partner API,
  mention of the Agent Emma channel in the launch plan, budget, hiring.

## Next: Release 1, in this order

1. ~~**Accounts**~~: done (pull request #4). Still to do from the accounts area: `DELETE /me` (account deletion) and
   `POST /me/data-export`; both need background jobs. A real SMS adapter (Termii or Twilio) once an account
   is opened. App sign-in screens.
2. ~~**Staff accounts and roles**~~, and the admin feature-rule endpoints: done (pull request #7).
   Still to do from this area: admin screens in the app; two-step login for ordinary users (ADR 0005, point 3);
   `PATCH /admin/countries/{countryCode}` (country settings), which is in the API design but not yet built.
2a. ~~**Specification check**~~: done (pull requests #9 and #10; decisions 39 to 63).
2b. ~~**Email**~~ (decisions 35 to 38, 64): done (pull request #11). Still to do: a real email provider adapter
    once the email sending account is opened (see `docs/DEPLOYMENT.md`).
2c. **Screen designs in Penpot** (decisions 42 and 67): every Release 1 screen for tenants, landlords, agents and
    staff, produced in the build sessions with the Penpot connector in Emmanuel's file "Release 1 Screens", for his
    review and approval; if the connector is not reliable, Claude's Design artifact type is used instead and
    Emmanuel is told. No longer blocked: the connector was tested on 23 October 2026. Order: the design system
    first (for approval before any screen), then the screens in groups, phone layouts first, then desktop and the
    signed-in website. Every screen, its Penpot link, its group and its review state are listed in
    `docs/designs.md`. Emmanuel is told before each design session so he can keep the file open. **No app screen
    is built until its design is approved.**
    Done after the email step, so the sign-up and sign-in designs match what is built; the server steps below
    continue in other sessions while the designs are reviewed.
    Progress: decision 67 and the design system merged in pull request #16. Icons redrawn (decision 68) and font
    changed to Source Sans 3 (decision 69) in pull request #19; the whole design system approved by Emmanuel on
    23 October 2026. Now: the screens, group by group. Group 1, sign-up and sign-in (9 phone
    screens), approved by Emmanuel on 23 October 2026 (pull request #20). Group 2, verification (10 phone screens), is in pull
    request #22, awaiting Emmanuel's review.
3. ~~**Verification ladder and identity checks**~~: done (pull requests #13 and #14). Still to do: real
   identity and storage provider adapters once the accounts are opened; app screens.
4. **Reference data endpoints**, then buildings, units and the parts checklist, with the distance to the main
   road, separate toilets in the checklist and a note per part (decision 56).
5. Documents and media upload (private storage adapter), listings and submission, search and the property page
   (summary only for signed-out visitors, decision 39; viewing limits per account in Redis, decision 52; saved
   places and travel distance, decision 48), saved items, messaging with the live connection (decision 47) and
   calls inside the app (decision 44, new feature switch `contact.in_app_call`), inspections with time slots
   (decision 45), notifications (decision 46), reports, review tasks with badge removal and bans (decision 51),
   the Release 1 automatic checks (decision 58), fee types shown on listings as a country setting (decision 55),
   and the public website code structure with listing summaries (decision 39).
6. **App screens** (Flutter), built only from approved designs (step 2c): sign-up and sign-in, verification,
   search and map, property page, listing creation, messaging and calls, inspections, saved items, notification
   and language settings (decision 40), the help page with WhatsApp and phone lines (decision 41), and the staff
   admin screens, including switch messages, return times and dependency warnings (decision 53).

## Decided, release not yet chosen

- **Scouts and the referral reward** (decision 70; Product Specification 1.6, Section 3.6): verified users report
  vacant properties and invite the landlords, who sign up, get verified and list for themselves; Projectiles pays the
  scout a fixed reward from its own money for the first rental completed through the completed rental fee. Build plan
  in `docs/adr/0008-scouts-and-referral-rewards.md` (proposed). No code until the release is chosen (open point 17)
  and the questions in ADR 0008 are answered. It needs buildings and listings (steps 4 and 5), the completed rental
  fee, bank accounts in the user's own name and a payout adapter, so rewards cannot be paid before those exist.

## Later releases (decided)

- **Release 2**: in-app support chat and tickets (decision 41); ratings and reviews (decision 57); satellite and
  stolen photo checks (decision 58).
- **A later release** (not Release 1): Sign in with Google and Sign in with Apple (decision 66).
- **Release 3**: other languages switched on as their translations are ready and checked (decision 40, may be
  sooner); blocking restricted countries before a second country (decision 54); further country settings
  (decision 55).

Each step: build to `docs/api/openapi.yaml`, add unit and API tests, keep CI green, open a pull request.
