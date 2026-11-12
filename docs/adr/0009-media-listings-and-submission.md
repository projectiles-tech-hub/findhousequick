# ADR 0009: Ownership documents, agent authority, media and listings (Release 1 step 5, part 1)

Status: accepted. Merged in pull request #47 on 10 November 2026.

## Context

Step 5 of Release 1 is large, so it is built in parts, each with its own pull request:

1. Ownership documents, agent authority, photo and video upload, listings and submission, and the staff review
   of listings and authority letters (this ADR).
2. Search, the property page (decisions 75 to 77), saved items and viewing limits (decision 52).
3. Messaging with the live connection, calls inside the app and notifications (decisions 44, 46 and 47).
4. Inspections with time slots (decision 45), reports, review tasks with badge removal and bans (decision 51),
   and the Release 1 automatic checks with the risk score (decision 58).
5. The public website code structure (decision 39 as replaced by decision 75).

This part follows Product Specification Sections 3.3 to 3.5, 5.3, 6.2, 6.6 and 15.3, and the API design.

## Decisions on how it is built

### Ownership documents and authority letters

- `/documents` now also takes `OWNERSHIP` and `AUTHORITY_LETTER`, each tied to a building (`buildingId`).
- Ownership documents are uploaded by the building's landlord (its owner on the platform), using the country's
  ownership document types.
- An authority letter is uploaded by an agent, with the letter itself (document type of purpose
  `AUTHORITY_LETTER`) and the landlord's identity document (a document type of purpose `IDENTITY`), as
  Specification 3.5 asks.
- The building's existence is never revealed to someone who may not see it: such requests answer "not found".

### Agent authority (Specification 3.5)

- An agent asks for authority over a building with `POST /buildings/{id}/authorities`.
- If the landlord is on the platform, the request waits for the landlord's decision
  (`POST /authorities/{id}/decision`: approve, reject or withdraw).
- If not, the agent attaches an uploaded authority letter, and a review task (`AUTHORITY_CONFIRMATION`) asks the
  team to call the landlord before approving.
- Authority may carry an end date; withdrawn or expired authority stops the agent managing the building at once.
- One open request per agent per building.

### Photo and video upload (Specification 5.3 and 15.3; Technical Architecture Section 11)

- Uploads are resumable: the file is sent in parts of a fixed size (8 MB), each part to its own short-lived link.
  Asking again with the same `Idempotency-Key` returns fresh links and the parts already received, so an
  interrupted upload carries on rather than starting over.
- The storage adapter gains three operations for this (part links, assembling the parts, and reading and writing
  processed copies). Each real provider maps them to its own multipart upload; the development provider keeps
  the parts as separate files and joins them.
- Only media captured with the app's camera is accepted. The app sends the capture time and GPS reading taken at
  capture; the server refuses a capture older than the country setting `listings.maxCaptureAgeHours` (default
  72) or further from the building than `listings.captureRadiusMetres` (default 100) plus the reported accuracy.
- The kind must match the checklist part: photos for photo parts, video for the walkthrough. 360-degree photos and
  floor plans need their feature switches.
- When the app confirms the upload, the server joins the parts, checks the size and SHA-256 against what was
  declared, marks the media `PROCESSING` and puts a job on the `media` queue.
- Processing a photo:
  1. Turn it upright and remove all hidden location and camera data.
  2. Check its quality: too small (shorter side under 720 pixels), too dark (average brightness under 40 of 255)
     or blurred (edge sharpness under a set threshold). A photo that fails is `REJECTED` with its reasons, so the
     app asks for a retake.
  3. Make a photo fingerprint (a 64-bit difference hash) for the duplicate checks in part 4.
  4. Make three display copies (480, 960 and 1600 pixels wide), each with the visible "FindHouseQuick" watermark
     and the unit's reference.
  5. Mark the photo `READY`.
- Processing a video:
  1. Read its length with ffprobe. A walkthrough shorter than 20 seconds is rejected (`TOO_SHORT`).
  2. Mark the video `READY`.
- Display copies are only ever served through expiring links (15 minutes). Originals are never returned.
- If a processing job is lost, an hourly job puts back any media left in `PROCESSING` for more than 15 minutes.
- Still to do in later parts:
  - automatic blurring of faces, number plates and documents;
  - the hidden watermark;
  - a watermarked, smaller copy of each video.
  Media is not shown to the public until the property page part, and that part must not show a video until
  its display copy exists.

### Listings and submission (Specification 6.2 and 6.6; Section 8.2)

- A listing is created for a unit by anyone who may manage its building, at verification level 2, while
  `platform.new_listings` is on. Long-term, commercial and short-let listings each need their feature switch.
- Only one open listing per unit (already a database rule).
- Money is entered in the country's currency, as whole minor units.
- Every fee must be entered, even when it is zero, because no fee may be charged that is not shown.
- Rent periods: year or month for long-term and commercial listings; night or week for short lets.
- A draft can be changed freely. A live listing can change its text and fees only, and every fee change is
  recorded in the audit log. A listing waiting for review cannot be changed.
- Submitting is refused with `LISTING_INCOMPLETE`, listing what is missing, until all of these are in place:
  - every required part has its minimum photos ready;
  - the walkthrough video is ready;
  - every fee is entered;
  - for the landlord, at least one ownership document for the building has finished uploading;
  - for an agent, approved, unexpired authority.
- A submitted listing goes to `IN_REVIEW`, with a `LISTING_REVIEW` task for the verification team (a desk
  review). Until the automatic checks and the risk score arrive in part 4, every listing is reviewed by a person
  before it goes live. Nothing goes live without a review.
- Staff decide `LISTING_REVIEW` tasks:
  - approving makes the listing live, starts its availability clock and marks its ownership documents as passed;
  - rejecting returns the listing to the lister as `REJECTED`, who may correct it and submit again.
- Staff decide `AUTHORITY_CONFIRMATION` tasks: approve or reject the agent's authority.
- A live listing expires unless the lister confirms it is still available within the country setting
  `listings.confirmAvailabilityDays`. An hourly job marks listings past their time as `EXPIRED`.
- The lister can pause, resume, mark as rented or close a listing. Closing marks it `REMOVED`, recorded as closed
  by the lister. Marking as rented records the tenant, if given, for the completed rental fee in Release 2.

## Consequences

- Servers need ffprobe installed (part of ffmpeg) to process videos. This is recorded in `docs/DEPLOYMENT.md`.
- The `sharp` image library is added to the server.
- Two new country settings are added: `listings.maxCaptureAgeHours` and `listings.captureRadiusMetres`.
