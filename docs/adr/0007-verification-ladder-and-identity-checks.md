# ADR 0007: The verification ladder check and identity checks

- Status: Proposed (Release 1 step 3).
- Context: Product Specification, Sections 3.1 to 3.4 and 15; decisions 6, 35, 37, 49, 50, 55 and 64; ADR 0004
  (sign-in); ADR 0006 (contacts). Technical Architecture: identity providers such as Smile ID, Dojah or Prembly.

## Decision

### The verification ladder check

- A route states the level it needs with `@RequireLevel(1 | 2 | 3)` (`server/src/accounts/verification.guard.ts`).
  The check runs after the sign-in check and works out the user's level from the database on every request, never
  from the sign-in pass or anything the app sends, so a change (a contact confirmed, an identity check passed)
  counts at once.
- Too low a level gets `403 VERIFICATION_REQUIRED` with `requiredLevel`, `currentLevel` and `next` (the same "what to
  do next" the app shows on the profile), so the app can take the user straight to the right step.
- Every action beyond browsing needs at least level 1 (decision 64). Routes built in later steps carry the level
  shown as `x-verification-level` in the API design.
- The same rules work out the level for `GET /me` and for the check, so the two can never disagree.

### Identity checks

**Starting a check** (`POST /identity/checks`, level 1, feature switch `verification.identity_check`):

1. The ID type must be one the country accepts, and the number must fit the country's pattern for it (country
   settings `verification.acceptedIdTypes` and `verification.idNumberPatterns`). Spaces, dashes and dots are removed
   first. Nothing about Nigeria is in the code; NIN and its 11-digit pattern are country settings.
2. The ID number is encrypted with `FIELD_ENCRYPTION_KEY` before it is stored, and only its last four characters are
   ever shown again. A fingerprint of it, keyed with a new secret `LOOKUP_HASH_SECRET`, is stored so that the same
   ID on two accounts can be spotted without the number being readable.
3. Refused when: the user is already verified; a check of theirs is with the verification team; or they have
   started the country's daily limit of checks (`verification.maxIdentityChecksPerDay`, 3 by default, because each
   check costs money with the provider). Checks that failed because the provider could not be reached do not count.
4. Starting again replaces an unfinished check (for example, the user closed the camera halfway). A late result for
   the replaced check is ignored.
5. If another account already holds the same ID (a check pending, passed or with the team), nothing is sent to the
   provider. The check is recorded as being with the team (`DUPLICATE_ID`), a duplicate-resolution task is created,
   and the answer is `409 ID_ALREADY_LINKED`.
6. Otherwise the provider's adapter starts the check and returns the values for its camera component in the app
   (selfie and liveness). These steps run in one database transaction with the user's row locked, so two starts at
   the same moment are handled one after the other.

**Receiving the result** (`POST /identity/provider-results/{provider}`, called by the provider):

- The provider's adapter first confirms the result is genuine (real providers sign their results). Only a check
  still pending is updated, in one statement, so a result delivered twice counts once.
- The adapter reports what the provider found; the server decides what it means (decision 49):

| Finding | Result | What the user may do |
| --- | --- | --- |
| Selfie not from a live person | FAILED (`LIVENESS_FAILED`) | Try again; a document photo would not help |
| ID number not found | FAILED (`ID_NOT_FOUND`) | Add a document photo for the team, or try again |
| Face does not match the ID photo | FAILED (`FACE_MISMATCH`) | Add a document photo for the team, or try again |
| Name on the ID does not clearly match the account | With the team (`NAME_MISMATCH`), identity review task | Add a document photo for the team |
| Another account passed or is under review with the same ID | With the team (`DUPLICATE_ID`), duplicate-resolution task | Wait for the team |
| Everything matches | PASSED: the user reaches level 2 | |

- "Clearly matches" means every word of the user's first and last names appears in the name on the ID, in any order,
  ignoring accents, capitals and punctuation (IDs often add a middle name or put the surname first). Anything less
  clear goes to people rather than being refused, because spellings of the same name differ.
- Every start, duplicate and result is recorded in the audit log, without the ID number.

**Providers** are adapters in `server/src/integrations/identity`, one per company, chosen per country in
`verification.identityProvider`. A built-in `test` provider checks nothing: results are sent to it by hand or by the
tests. Because anyone could send it a result, it exists only when `NODE_ENV` is not `production`. The starter data
sets Nigeria to `test` outside production only. Real providers verify a signature over the exact bytes they send, so
the first real adapter will also switch on keeping the raw request body for this route.

### Agent company details (decision 50)

`PUT /me/agent-profile` (level 2, agents only) saves a business name and an optional registration number, marks them
PENDING and creates one review task for the verification team (a second save while a task is open does not add
another). `GET /me/agent-profile` returns them.

### Data retention (decision 55)

A country setting `retention.identityImagesDays` holds how long identity document photos are kept after their check
is closed. It is empty until set after legal advice (open point 15). Selfies stay with the provider and are not
stored by the platform. Each photo's deletion date is set from it when its check is closed (below).

### Document photos (decision 49)

- **Private storage** is reached through an adapter (`server/src/integrations/storage`), one per company. The
  development provider `local` keeps files in a folder and accepts uploads through the API with signed links that
  run out after 15 minutes; it is refused in production. Cloudflare R2 gets its own adapter when the account is opened.
- **Uploading** (`POST /documents`, level 1): the app declares the document type, file type, size and SHA-256 and
  gets an upload link. Only identity documents are open so far, of the types in the country setting
  `verification.idDocumentTypes` (Nigeria: driver's licence, international passport, NIN slip). After sending the
  file, the app confirms (`/documents/{id}/complete`); the server checks the stored file's size and SHA-256 against
  what was declared, and removes a file that does not match. An `Idempotency-Key` returns the same document if the
  request is repeated.
- **Adding the photo to a check** (`/identity/checks/{id}/document`) is allowed only when the check says
  `UPLOAD_ID_DOCUMENT`, with a finished upload of the user's own not used on another check. The check goes to the
  verification team.

### The verification team's queue

- `GET /admin/review-tasks` lists tasks oldest first, only in the staff member's countries, for verifiers, country
  managers and super admins who have completed two-step login. Each task carries what is needed to decide it (the
  account name, the ID type and last four characters, the name on the ID, the reason, the document), never the full
  ID number.
- `POST /admin/review-tasks/{id}/decision` with APPROVE or REJECT and notes:
  - identity reviews and duplicate IDs: APPROVE passes the check and the user reaches level 2; REJECT fails it and the
    user may start a new check. An ID already verified on another account is never passed (one ID, one verified
    account); that account must be dealt with first;
  - agent company details: APPROVE or REJECT them.
  Other task types and outcomes (bans, site visits and so on) are decided here once their parts are built.
- Staff never decide their own case or view their own documents. Each decision is written to the audit log with the
  notes. `POST /admin/documents/{id}/view` gives a 5-minute link and records the viewer and reason in the audit log.

### Deleting photos when the retention period ends (decision 55)

When a check with a photo is closed, the photo is marked for deletion after the country's
`retention.identityImagesDays` (no date while the setting is empty). An hourly background job removes due files from
storage and marks the documents deleted, keeping the record without the file. This is the first background job, so
BullMQ on Redis starts here (decision 59); the schedule is stored once in Redis, so with several servers it still runs
once an hour. `RUN_BACKGROUND_JOBS=false` turns jobs off on a server.

## Build choices

These are technical choices made while building, within decision 49. Each can be changed later without touching
any recorded decision.

1. **Liveness failure** is "try again", without a document photo, because a document cannot prove the person is
   present.
2. **A name that does not clearly match** goes to the verification team, with a document photo allowed, rather than
   failing outright.
3. **Daily limit** of 3 checks per user is a country setting, to limit provider costs.
