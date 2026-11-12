# ADR 0012: Inspections, reports, enforcement and the automatic checks (Release 1 step 5, part 4)

Status: accepted. Merged in pull request #50 on 10 November 2026.

## Context

Part 4 of step 5 (ADR 0009) covers what happens between finding a home and trusting it. It follows:
- Product Specification Sections 4.3, 6.3 to 6.5, 7.2, 7.3 and 8.2;
- decision 45 (inspection time slots), decision 51 (badge removal and bans, recorded against the verified
  identity), decision 55 (fee types as a country setting) and decision 58 (the automatic checks of Release 1).

## Decisions on how it is built

### Inspections (decision 45)

- **Availability.** Those who manage a listing set weekly windows (for example Monday 10:00 to 16:00), a slot
  length of 15 to 120 minutes, and dates to block. Times are in the country's time zone.
- **Free slots.** A slot is offered when it is inside a window, not on a blocked date, not already taken, at least
  `inspections.minLeadMinutes` away (default 2 hours) and within `inspections.maxDaysAhead` (default 30 days).
- **Booking** needs level 2 and a live listing. A tenant has one open inspection per listing. The database itself
  allows one open booking per slot, so two tenants cannot take the same time.
- **Who confirms.** The side that did not propose the time confirms it. The tenant proposes by booking, so the
  lister confirms. Either side may propose another free slot, and then the other side confirms.
- **Closing.** Either side may cancel, with a reason. Once the time has come, either side may mark the inspection
  completed or missed.
- **The exact position** (Specification 4.3). When an inspection is confirmed, the tenant gets the exact position,
  the address and a directions link, on the inspection and on the property page. Nobody else does.
- **Safety sharing.** Once confirmed, the tenant can send the address, the time and the lister's name to a trusted
  contact by SMS, at most `inspections.maxSafetyShares` times per inspection (default 3), because each SMS costs
  money. The contact's number is not stored.
- **Follow-up.** After a completed inspection the tenant says whether the property matched the listing, and each
  side says whether it led to a rental. A "No" on the match adds `verification.riskPoints.tenantMismatch` (default
  20) to the listing's risk score and is sent to the team as a report.
- **The directions link** opens Google Maps for now. It moves into the maps provider adapter when that is built.

### Reports (Specification 7.3)

- Any user at level 1 can report a listing that is or was public, once while their earlier report is open, and not
  their own. A user can send 10 reports a day.
- Each report opens a REPORT task in the verification team's queue.

### Enforcement (decision 51)

- **What the team can decide on a report:** no action; warn the lister; remove the verified badge; suspend; ban; or
  ask for a visit. With any of these except "no action" they may also take the reported listing down.
- **Every sanction is recorded** in its own table with the staff member, the reason, the task, and the lister's
  verified ID (as the hash the identity check already keeps, never the number).
- **Badge removed:** the account keeps working, but its listings and its profile show no verified badge.
- **Suspended:** every device is signed out and the lister's live listings are paused.
- **Banned:** every device is signed out and all the lister's listings are removed. The same ID is refused at the
  identity check on any other account (`ID_BANNED`), so the person cannot return on a new account.
- Staff never decide a report they made or one about themselves, and a staff account is not sanctioned through a
  report.
- The task shows the lister's earlier sanctions, so the team can follow the order in the Specification: a warning,
  then the badge, then suspension.

### Automatic checks and the risk score (decision 58)

When a listing is submitted, these checks run and each result is stored:

| Check | What it finds | Points (country setting) |
| --- | --- | --- |
| Live media | Photos and video taken with the app, at the building, in time (already enforced at upload) | 0 |
| Walkthrough video | The video was recorded at the building | 0 |
| Duplicate location and address | Another building with an open listing within `listings.duplicateRadiusMetres` or at the same address | 40 |
| Duplicate photo | A photo whose fingerprint matches a photo of another building | 40 |
| Duplicate document | A document number already used on another building | 60 |
| Name match | Done by the team: until they have passed the building's ownership documents, the listing needs a desk review | 30 |

- **The score is the sum of the points.** With the country's bands (amber from 30, red from 60):
  - **green** goes live at once, with no review;
  - **amber** goes to a desk review;
  - **red** waits for a site visit.
- **In practice:** the first listing of a building is amber, because a person must match the documents to the
  owner's name. Later listings in a building whose documents have passed are green. Any duplicate signal together
  with the pending name match is red.
- **Random audits:** `verification.randomAuditPercent` of green listings (default 2%) also get a visit task while
  staying live.
- **The team's tasks.** A desk reviewer may approve, reject, or ask for a site visit. A site visit is approved or
  rejected. A random audit that is rejected takes the listing down for correction. A building flagged as a
  duplicate when it was registered can now be decided: "reject" confirms the duplicate and takes its listings down.
- **Photo fingerprints** are compared inside the database. Two fingerprints match when at most
  `verification.photoMatchBits` of their 64 bits differ (default 6). Fingerprints of pictures with no shape in them
  (a blank wall) are left out, because they match each other by accident.
- **Not yet:** the walkthrough's GPS path needs the phone app to record it while filming (step 6); until then the
  check uses where the recording was made. Reading document numbers automatically is not built, so the duplicate
  document check works on numbers the team records. Satellite and stolen photo checks are Release 2 (decision 58).

### Fee types (decision 55)

- The country setting `listings.feeTypes` lists which of the four fixed fees (agency fee, legal fee, caution
  deposit, service charge) are shown on listings, in the order of the cost box. Nigeria shows all four.
- A lister must enter every fee type shown, and cannot charge one that is not shown (`FEE_NOT_ALLOWED`).
- The cost box and its total include only the fee types shown.
