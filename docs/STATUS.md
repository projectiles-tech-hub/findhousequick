# Project status

Updated: 11 November 2026. Read this after CLAUDE.md at the start of every build session, and update it at the end.

## Where things stand

- **Repository**: `projectiles-tech-hub/findhousequick` (public during the build; may be made private later).
  The old PHP prototype is in `ecoraegbu/findhousequick-legacy`, for reference only.
- **Release 0 (foundations)**: mostly complete; delivered in pull request #1. **Not yet done** (Technical
  Architecture, Section 15; found by the specification check, finding 4): screen designs for tenants, landlords,
  agents and staff are now done (step 2c below, all 217 designs approved); the test system on a cloud host (after the
  hosting account, which needs a company dollar card); the public website code structure (built in step 5, part 5, pull request #51).
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

- **Release 1 step 2c (screen designs)**: complete: all 217 designs approved (the public website pages, group 14, in pull request #41, merged on 29 October 2026). Decision 67 (Penpot instead of Figma) and the design system
  merged in pull request #16. The design system is in Emmanuel's Penpot file "Release 1 Screens", page "00 Design
  system": colours, text styles, spacing and touch size, icons, buttons and chips, form fields, cards and notices,
  map pins, and a Pidgin length check. Merging #16 recorded the decision and the files; it is not the approval of
  the designs. Colours approved by Emmanuel on 23 October 2026. Icons redrawn the same day as the app's own set,
  to a standard above Font Awesome Pro, with outline and filled styles (decision 68). Font changed to Source Sans 3
  (decision 69), because Roboto lacks the Yoruba letter ṣ. On 23 October 2026 Emmanuel
  approved the whole design system and asked for the screens to start (review states are kept in
  `docs/designs.md`). Group 1, sign-up and sign-in (9 phone screens), was approved the same day (pull requests #20
  and #21); group 2, verification (10 phone screens), was approved on 24 October 2026 (pull request #22), with level
  3 ("Payment ready") shown as "Later". Group 3, search and map, with the bottom bar, was approved on 24 October 2026. Group 4, the property page (screens 30 to 36), was approved on 24 October 2026 (pull request #27).
  Group 5, listing creation (screens 50 to 65, phone), with a bottom bar for landlords and agents, was approved on
  24 October 2026 (pull request #28). Groups 6 to 11 were made on 24 and 25 October 2026:
  agents and authority (screens 66 to 70, pull request #29), messages and calls (40 to 45, #30), inspections for
  tenants (46 to 49, #31), saved items (37 to 39, #32), me and settings (71 to 80, #33) and scouts (81 to 87, #34).
  Each pull request is built on the one before, so they are merged in that order. Emmanuel approved all of them on
  25 October 2026: **every phone screen, 1 to 87, is approved**, and the phone app screens may be built from them
  (step 6); no app screen is built yet. The points raised in those pull requests were approved as shown: Mute and
  Speaker as worded buttons, a call leaving a line in the chat, and the dark background of the call screens. The
  support phone numbers (screen 77), the scout reward amount (screens 81 and 85, open point 16) and the web address
  in invitation links (screen 83) are placeholders. Screen widths for the website and desktop designs (decision 74):
  the website is responsive, drawn at 1366 (desktop) and 768 (tablet), following the phone screens at phone width;
  the desktop software at 1366 by 768 in a resizable window. Decision 74 was approved and merged on 26 October 2026 (pull request #35).
  The staff screens (88 to 105), which exist only on the website and desktop, were approved by Emmanuel on
  27 October 2026 (pull request #36): 54 designs, each screen at 1366 and 768 for the website and in the desktop software window, with two
  new design system parts (the staff side navigation and the desktop window bar). On 27 October 2026 Emmanuel changed decisions 73 and 74 (pull request #39): the desktop software is for staff only;
  tenants, landlords, agents and scouts use the phone app and the website (217 designs in all). Group 13, the website layouts of screens 1 to 87, was approved by Emmanuel on 28 October 2026 (pull request #40):
  screens 1 to 87 are drawn at 1366 and 768 on the Penpot pages "13 Website: 1 Welcome" to
  "31 Website: 85 to 87 Rewards" (178 designs), in a public-website style of their own with the approved
  colours, font and components. The landing page shows the available properties straight away; sign-in (screens 6
  and 7) opens over the page the user is on; sign-up and the password screens have pages of their own. Group 14, the public
  website pages, was approved by Emmanuel on 29 October 2026 (pull request #41): page 106 (Home) is the approved website layout of screen 1, and pages
  107 to 112 are drawn at 1366, 768 and 360 (18 designs) on the Penpot pages "32 Website: 107 to 109 Public
  search and listings" and "33 Website: 110 to 112 Public help and legal".

- **Pages 107 and 108 redrawn** (decisions 75 to 80): approved. Merged in pull request #46 on 10 November 2026. On 2 November 2026
  Emmanuel found the public search results (107) and listing (108) pages too thin. They were redrawn in Figma
  (decision 78), at 1366, 768 and 360: signed-out visitors see full listings without the lister (decision 75), and
  both pages also show other properties and FindHouseQuick services (decision 77). The Penpot design system values
  are now written into `docs/designs.md`. Screens 25 (list of results) and 30 (property page) for signed-in users, on the
  phone app and the website, were redrawn the same way, with the lister shown (decision 80). All twelve designs are approved.

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

- **Country settings changes**: complete. Merged in pull request #43 on 2 November 2026. Super admins change a
  country's settings through `PATCH /admin/countries/{countryCode}`; every change is recorded.

- **Release 1 step 4 (reference lists, buildings, units and the parts checklist)**: complete. Merged in pull
  request #44 on 2 November 2026 (decision 56). Still to do from this step: comparing a building's location with
  its first photos (with media upload, step 5); admin endpoints to switch cities on.

- **Release 1 step 5, part 1 (ownership documents, agent authority, media upload, listings and submission)**:
  complete. Merged in pull request #47 on 10 November 2026. Plan in `docs/adr/0009-media-listings-and-submission.md`, which also splits
  step 5 into five parts.
  - Ownership documents and authority letters through `/documents`; agent authority, approved by the landlord in the
    app or, with a letter, by the team after calling the landlord.
  - Resumable photo and video upload in parts, checked against where and when it was taken.
  - Photo processing on the `media` queue: location data removed, quality checks (blurred, dark, small),
    fingerprint, and three watermarked display copies behind 15-minute links. Videos have their length checked.
  - Listings: drafts, every fee entered, edits recorded, submission with a list of what is missing, the staff desk
    review, availability confirmation, hourly expiry, pause, resume, mark as rented and close.
  - Still to do from this part: automatic blurring and the hidden watermark (not built in part 4; the privacy
    policy and the terms describe both, so they must be built before any real user signs up); a watermarked copy of each
    video (before any video is shown publicly); asking for the occupant's consent only when the unit is occupied (an
    "occupied" detail on units); the property page for tenants (part 2); a real storage provider adapter (Cloudflare
    R2) once the account is opened.

- **Release 1 step 5, part 2 (search, the property page and saved items)**: complete. Merged in pull request #48 on 10 November 2026. Plan in
  `docs/adr/0010-search-and-the-property-page.md`.
  - Search: around me, landmark, map (grouped pins when zoomed out) and area, with every filter.
  - Positions are approximate and distances rounded until an inspection is confirmed.
  - The property page in full for everyone, with the lister and saved-place distances for signed-in users only
    (decisions 75 and 80).
  - Similar and nearby listings (decisions 77 and 80); viewing limits per account and per device in Redis
    (decision 52), with the new server setting `TRUST_PROXY_HOPS`.
  - Saved areas, saved places (decision 48) and favourites.
  - Still to do from this part:
    - a maps provider adapter (Google Maps or Mapbox) for place search, nearby amenities and travel times; until
      then amenities are empty and distances are straight lines;
    - alerts for saved areas (built in part 3);
    - the exact position after a confirmed inspection (built in part 4).

- **Release 1 step 5, part 3 (messaging, calls and notifications)**: complete. Merged in pull request #49 on 10 November 2026.
  Plan in `docs/adr/0011-messaging-calls-and-notifications.md`.
  - Chat between a tenant and the lister, with unread counts, automatic monitoring with a warning, and phone
    numbers shared only after an inspection is booked and both sides agree.
  - Voice calls inside the app (decision 44) through a calling service adapter, with a test service for
    development; missed calls marked every minute; each call leaves a line in the chat.
  - The live connection at `/v1/live` (decision 47), across several servers through Redis.
  - Notifications by push, email and SMS, chosen per kind (decision 46), with a push adapter that logs for
    development; device registration.
  - Alerts for saved areas when a listing goes live; listers told when their listing goes live or is sent back.
  - Still to do from this part: real push (Firebase) and calling service adapters once the accounts are opened;
    notifications for verification results.

- **Release 1 step 5, part 4 (inspections, reports, enforcement and the automatic checks)**:
  complete. Merged in pull request #50 on 10 November 2026. Plan in
  `docs/adr/0012-inspections-reports-and-automatic-checks.md`.
  - Inspections with time slots (decision 45): availability, booking, confirming, rescheduling, cancelling,
    completing; the exact position, address and directions for the tenant once confirmed; safety sharing by SMS;
    follow-up answers.
  - Reports of listings, and what the team can do about them (decision 51): warning, badge removal, suspension and
    ban, each recorded against the verified identity; a banned ID is refused on any other account.
  - The Release 1 automatic checks and the risk score (decision 58): green listings go live at once, amber go to a
    desk review, red wait for a site visit; random audits; site visit, audit and duplicate building tasks can be
    decided.
  - Fee types shown on listings as a country setting (decision 55).
  - Still to do from this part: the walkthrough's GPS path (needs the phone app, step 6); automatic reading of
    document numbers; a reminder before an inspection and a prompt for the follow-up answers; blocking another
    user in chat; the directions link through the maps provider adapter.

- **Release 1 step 5, part 5 (the public website)**: complete. Merged in pull request #51 on 10 November 2026.
  Pages 107 and 108 follow the designs approved in pull request #46. Plan in `docs/adr/0013-public-website.md`.
  - The website's code structure in `web/` (Next.js), with its own checks in CI. This also completes the "public
    website code structure" item left over from Release 0.
  - Page 107 (search results) at `/homes` and page 108 (listing page) at `/homes/{id}`, at all three widths, made
    from the API for each request, with titles, a sitemap and descriptions for search engines.
  - The visitor's network address and a device id are passed to the API, so the viewing limits count each visitor.
  - Small API additions: the total and the city on search results, a city filter, popular areas, and the unit
    detail choices in `/controls`.
  - Pages 110 (help), 111 (terms of use) and 112 (privacy policy) at `/help`, `/terms` and `/privacy`, from the
    approved Penpot designs, with the terms and policy written in standard terms for Nigeria.
  - The icons are the app's own set, exported from the design file; the header and footer are the approved ones.
  - Still to do from this part: pages 106 and 109; the map and the "power and water" and "more filters" filters;
    the lawyer's review of the terms and the privacy policy; the real support numbers and contact emails.

- **Release 1 step 5a (scouts)**: in pull request #53. Built on pull request #52. How it was built is at the end
  of `docs/adr/0008-scouts-and-referral-rewards.md` ("As built").
  - Joining as a scout, reporting a vacant property, making the invitation code and link, the landlord
    registering with the code and confirming his building, one reward line per unit, the conflict checks with a
    task for the team, staff voiding a referral and suspending a scout; all behind the switch `growth.scouts`,
    which is off.
  - Rewards only wait for a rental; the steps for the first rental and the fee are built and tested, and are
    connected when rentals and the completed rental fee exist (Release 2).
  - Added in pull request #54: photos on a scout's report; remembering, as hashes, the phone numbers and emails an
    account has confirmed, for the conflict checks; the invitation link leading to sign-up with the code.
  - Still to do from this step: the scout screens (step 6); switching `growth.scouts` on when the screens exist.

- **Release 1 step 6 (app screens), part 1, the foundation**: in pull request #55. Built on pull request #54. The
  plan for the whole step, in seven parts, is `docs/adr/0014-app-screens.md`.
  - The design values (colours, text styles, spacing, corners) and Source Sans 3, read from the design system page.
  - The app's own icons, made from the same list as the website's; the nine filled icons were added to the list.
  - The shared parts: buttons, icon buttons, filter chips, tags, the text, phone, password, code, picker and
    search fields, radio and tick choices, notices, and the bottom bar with both sets of tabs.
  - The words in a file per language (English filled; Pidgin empty until its wording is written and checked).
  - The sign-in session: keys in the phone's protected storage, a new access token shortly before the old one
    runs out, sign-out when the server ends the session.
  - No screen for users is built in this part; the app still opens on the start screen.
  - Still to do from this step: parts 2 to 7.

- **Release 1 step 6 part 2a, sign-up and sign-in on the phone (screens 1 to 9)**: in pull request #57. Built on
  pull request #56.
  - Welcome, Who are you, Your details, Enter the code, Confirm your email, Sign in, Sign in paused, Forgot
    password and Set a new password, built from the Penpot designs and working against the API: an account can be
    created, its email confirmed, signed in to by password or by code, and its password reset.
  - Tried end to end in a browser against the real API, and compared by eye with the designs at 360 wide.
  - The server now gives the apps the country's dialling code, and has country settings for the versions of the
    terms and privacy policy a new user agrees to.
  - The checks on GitHub now use a fixed Flutter version (3.47.9, the one the app is built with). A newer Flutter
    release, out since pull request #55, marks the way the app brings in its Material parts as outdated, and the
    check failed on that alone. Still to do: upgrade Flutter on purpose and move to the new `material_ui` package.
  - Still to do from part 2: the wide layouts of screens 1 to 9 (part 2b), which are their own designs with a
    card and a collage of live listings; verification, screens 12 to 21 (part 2c). Until 2b, a wide screen shows
    the phone layout in a narrow column.

- **Maps providers (decision 81)**: in pull request #56. Built on pull request #55. How it is built is in
  `docs/adr/0015-maps-providers.md`.
  - The server has an adapter for Google Maps and one for OpenStreetMap, for place search, nearby amenities and
    travel times; the provider is a server setting, for all uses or one use at a time. The default is none, so
    nothing changes for users.
  - Neither adapter has been tried against the real service: no account exists yet.
  - Still to do: use the adapters in place search and on the property page, keeping answers so they are not paid
    for twice; the map picture in the apps and on the website (step 6 part 3); the satellite check.
  - Also recorded here: decision 82 (the scout invitation link opens no page of its own) and decision 83 (the
    Pidgin wording is written later by Projectiles Tech Hub).

## Small follow-ups

- Technical points from the specification check (finding 21): move rate limits to Redis (they are still counted in
  each server's memory; BullMQ was started in pull request #14); make sure request logs never record "around me" search locations (Specification 15.2).
- Rare, harmless gap: if a staff member's app renews its sign-in at the very moment they complete the second
  step, the renewed sign-in may not carry the second step, and they are asked to do it again. Not fixed yet.
- `ubuntu-latest` runners are moving to Ubuntu 26. On 22 October 2026 the checks still ran on Ubuntu 24.04;
  confirm CI still passes once GitHub makes the switch. (The GitHub Actions versions were moved to their
  Node.js 24 releases in pull request #3.)

## Waiting for Emmanuel

- Before the website goes live: the lawyer's review of the terms of use and the privacy policy; the real support
  WhatsApp and phone numbers; the support and privacy emails; the name of the Data Protection Officer.
- A Google Cloud account (for Google Maps), and a host for the OpenStreetMap services or the choice to run them
  ourselves, before either maps provider can be switched on (decision 81; `docs/DEPLOYMENT.md`).
- The Pidgin wording for the app, which Projectiles Tech Hub writes itself (decision 83). Until it is supplied the
  app shows English when Pidgin is chosen.
- Before identity checks go live: how long identity images are kept after verification, after legal advice
  (Decisions Log open point 15). Step 3 is built with this as a country setting (decision 55) that is not yet set.
- A company dollar card, so the hosting account (and the test system) can be opened (decision 42).
- Scouts and the referral reward (decisions 70 to 72): Decisions Log open points 16, 18 and 19: the reward amount
  and, before it goes live, state estate agency rules and withholding tax. The release is settled (decision 72).
- Decisions Log open points: the five escrow settings, escrow legal structure, launch city, partner API,
  mention of the Agent Emma channel in the launch plan, budget, hiring.

## Next: Release 1, in this order

1. ~~**Accounts**~~: done (pull request #4). Still to do from the accounts area: `DELETE /me` (account deletion) and
   `POST /me/data-export`; both need background jobs. A real SMS adapter (Termii or Twilio) once an account
   is opened. App sign-in screens.
2. ~~**Staff accounts and roles**~~, and the admin feature-rule endpoints: done (pull request #7).
   Still to do from this area: admin screens in the app; two-step login for ordinary users (ADR 0005, point 3).
   Country settings changes (`PATCH /admin/countries/{countryCode}`, super admins, recorded): done (pull request
   #43, merged on 2 November 2026), built before step 4 as Emmanuel asked on 29 October 2026.
2a. ~~**Specification check**~~: done (pull requests #9 and #10; decisions 39 to 63).
2b. ~~**Email**~~ (decisions 35 to 38, 64): done (pull request #11). Still to do: a real email provider adapter
    once the email sending account is opened (see `docs/DEPLOYMENT.md`).
2c. ~~**Screen designs in Penpot**~~: done (pull requests #16 to #41). (Release 0 work; decisions 42, 67 and 73): the 112 screens listed in
    `docs/designs.md`, for tenants, landlords, agents, scouts and staff and the public website, on the phone app
    (87), the website (112) and the desktop software (18, staff screens only): 217 designs. The step is complete
    only when all 217 are approved. All 217 approved by 29 October 2026; the six designs of pages 107 and 108 were redrawn in Figma on 2 November 2026 for review (decisions 75 to 80, pull request #46; screens 25 and 30 redrawn too). Produced in the build sessions with the Penpot connector in Emmanuel's file "Release 1 Screens", for his
    review and approval; if the connector is not reliable, Claude's Design artifact type is used instead and
    Emmanuel is told. No longer blocked: the connector was tested on 23 October 2026. Order: the design system
    first (for approval before any screen), then the screens in groups, phone layouts first, then the staff screens
    and the signed-in website, then the public website pages. Every screen, its Penpot link, its group and its review state are listed in
    `docs/designs.md`. Emmanuel is told before each design session so he can keep the file open. **No app screen
    is built until its design is approved.**
    Done after the email step, so the sign-up and sign-in designs match what is built; the server steps below
    continue in other sessions while the designs are reviewed.
    Progress: decision 67 and the design system merged in pull request #16. Icons redrawn (decision 68) and font
    changed to Source Sans 3 (decision 69) in pull request #19; the whole design system approved by Emmanuel on
    23 October 2026. Now: the screens, group by group. Group 1, sign-up and sign-in (9 phone
    screens), approved by Emmanuel on 23 October 2026 (pull request #20). Group 2, verification (10 phone screens),
    approved on 24 October 2026 (pull request #22). Group 3, search and map (10 phone screens and
    the new bottom bar), approved on 24 October 2026 (pull request #24). Group 4, the property page (screens 30 to 36),
    approved on 24 October 2026 (pull request #27). Group 5, listing creation (screens 50 to 65, phone, and the
    bottom bar for landlords and agents), approved on 24 October 2026 (pull request #28). Groups 6 to 11 (screens
    37 to 49 and 66 to 87, phone), approved on 25 October 2026 (pull requests #29 to #34): every phone layout is
    approved. The staff screens (88 to 105, 54 designs, website and desktop only) approved on 27 October 2026
    (pull request #36). Website layouts of screens 1 to 87 (group 13): 178 designs on Penpot pages 13 to 31,
    approved on 28 October 2026 (pull request #40). Public website pages (group 14): page 106 (Home) is the
    approved website layout of screen 1; pages 107 to 112 are drawn at 1366, 768 and 360 (18 designs, Penpot pages
    32 and 33), approved on 29 October 2026 (pull request #41). Widths as in
    decision 74.
3. ~~**Verification ladder and identity checks**~~: done (pull requests #13 and #14). Still to do: real
   identity and storage provider adapters once the accounts are opened; app screens.
4. ~~**Reference data endpoints**, then buildings, units and the parts checklist, with the distance to the main
   road, separate toilets in the checklist and a note per part (decision 56)~~: done (pull request #44, merged on 2 November 2026). Built: the three
   reference lists (property types with their checklists, document types, regions with cities); registering a
   building at its location, with duplicates sent to the verification team; units with their checklists (one
   part per bedroom, bathroom and toilet), rebuilt when room counts change without losing photos; notes on parts;
   unit details checked against choices held in the country settings. Still to do from this step: the comparison
   of the building's location with the first photos (with media upload, step 5); admin endpoints to switch cities
   on (switched on in the database for now, see `docs/DEPLOYMENT.md`).
5. **Step 5, in five parts** (ADR 0009). Part 1, documents and media upload, agent authority, listings and
   submission: complete (pull request #47). Part 2, search, the property page and saved items: complete (pull request #48). Part 3,
   messaging with the live connection (decision 47), calls inside the app (decision 44, new feature switch
   `contact.in_app_call`), notifications (decision 46) and alerts for saved areas: complete (pull request #49). Part 4,
   inspections with time slots (decision 45), reports, review tasks with badge removal and bans (decision 51), the
   Release 1 automatic checks and risk score (decision 58), and fee types shown on listings as a country setting
   (decision 55): complete (pull request #50). Part 5, the public website code structure with the public search and listing
   pages (decisions 75 and 77): complete (pull request #51).
5a. **Scouts, server side: in pull request #53.** (decisions 70 to 72; plan in `docs/adr/0008-scouts-and-referral-rewards.md`), after buildings and
    listings (steps 4 and 5): opting in, reporting vacant properties, inviting landlords, the referral record, the
    conflict checks and the staff referral screens, behind the switch `growth.scouts`. The scout routes are added
    to `docs/api/openapi.yaml` at the start of this step. Rewards are recorded as waiting for a rental; payouts
    come with the completed rental fee in Release 2.
6. **App screens** (Flutter), built only from approved designs (step 2c), for the phone app, the website and the
   desktop software (staff screens only): every screen listed in `docs/designs.md` (decision 73), including the scout screens and the
   staff screens with switch messages, return times and dependency warnings (decision 53). In seven parts
   (`docs/adr/0014-app-screens.md`). Part 1, the foundation: in pull request #55. Part 2a, sign-up and sign-in on the phone
   (screens 1 to 9): in pull request #57. Next: part 2b, the wide layouts of screens 1 to 9; part 2c, verification
   (screens 12 to 21); then part 3, search, the map, the property page and saved items; part 4,
   messages, calls and inspections; part 5, listing a property; part 6, me, settings and scouts; part 7, staff.

## Later releases (decided)

- **Release 2**: scout referral reward payouts, with the completed rental fee, bank accounts in the user's own
  name and a payout adapter (decision 72); in-app support chat and tickets (decision 41); ratings and reviews (decision 57); satellite and
  stolen photo checks (decision 58).
- **A later release** (not Release 1): Sign in with Google and Sign in with Apple (decision 66).
- **Release 3**: other languages switched on as their translations are ready and checked (decision 40, may be
  sooner); blocking restricted countries before a second country (decision 54); further country settings
  (decision 55).

Each step: build to `docs/api/openapi.yaml`, add unit and API tests, keep CI green, open a pull request.
