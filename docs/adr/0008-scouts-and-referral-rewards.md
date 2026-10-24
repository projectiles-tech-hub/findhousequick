# ADR 0008: Scouts and the referral reward (build plan)

- Status: Proposed. A plan only: nothing is built until Emmanuel chooses the release (Decisions Log open point 17).
- Context: decisions 70 and 71 (scouts and the referral reward); decisions 7 (agent authority), 14 and 15 (completed rental
  fee), 43 (landlords register their own properties), 58 (duplicate checks) and 64 (actions need level 1); Product
  Specification 1.6, Section 3.6; ADR 0002 (feature controls), ADR 0003 (money and ledger), ADR 0007 (verification).

## What has to exist first

Scouts lean on parts that are not built yet:

| Needed | Why | Where it is planned |
| --- | --- | --- |
| Buildings, units and listings | A referral is tied to a property the landlord lists himself | Release 1 steps 4 and 5 |
| The completed rental fee | The reward is paid only after that fee is received for the first rental | Specification Section 14; not yet scheduled in a step |
| Bank accounts in the user's own name | The reward goes only to the scout's verified bank account | Verification level 3; not yet built |
| A payout provider adapter | To send the reward | Needs the payment provider account (`docs/DEPLOYMENT.md`) |
| A stable device identifier | For the "shares a device" check | Sign-in records only a device name today (ADR 0004); an install identifier must be added |

So scouts cannot go live before those parts. The scout reporting and invitation steps could be built earlier, with
rewards recorded as "waiting for a rental" until the fee and payouts exist.

## Plan

### 1. Becoming a scout

- A user opts in from their profile (`POST /me/scout`). Opting in, reporting and inviting need level 1, like every
  action beyond browsing (decisions 64 and 71). The server checks the level, as for every action (ADR 0007).
- Withdrawing a reward needs the further verification for payouts: identity checked (level 2) and a bank account
  confirmed in the scout's own name (decision 71). A scout can earn rewards before then; they wait until it is done.
- A scout profile records the opt-in date and a status (active or suspended). Staff can suspend a scout.
- Being a scout gives no rights over any property: a scout never lists, manages or speaks for a property. The server
  never lets a scout's account act on a building or listing because of a referral.

### 2. Reporting a vacant property

- `POST /scout/reports`: the location (a map pin, required), a short description of the place (street, landmark),
  optional photos (through the existing private document upload), and optionally the landlord's name.
- At once the report is checked against buildings and listings already on the app, using the duplicate checks of
  decision 58 (location and address). A match is shown to the scout as "already on FindHouseQuick": no reward is
  possible.
- If two scouts report the same place, both reports are kept; the first valid invitation wins (section 4).

### 3. Inviting the landlord

- `POST /scout/reports/{reportId}/invitations` creates an invitation with a single-use code, stored only as a hash.
  Invitations do not expire (decision 71).
- Two ways, both ending with the landlord on his own phone:
  - **Link:** the scout shares the link (WhatsApp, SMS). It opens the app, or the website if the app is not
    installed, on a page that says who invited him and what FindHouseQuick is.
  - **Help him sign up:** the scout shows a QR code or the code itself, and the landlord opens it on his own phone.
    The app never lets a landlord be signed up on the scout's phone.
- The landlord registers through the normal sign-up (`POST /auth/register` gains an optional `invitationCode`). He
  enters his own details, accepts the terms himself and gets verified himself. Nothing the scout typed is copied into
  his account.
- An invitation can be accepted only by a new account. A person already on the app (by phone, email or, once
  verified, NIN) cannot accept it, so no reward arises for a landlord already on the app.
- When the invited landlord adds his building (decision 43), the app asks him to confirm whether it is the property
  the scout reported, and checks that it is near the reported pin. Every unit he adds to that building is linked to
  the referral (section 4). If an agent is involved, the agent goes through
  the normal authority process (decision 7); the scout plays no part in it.

### 4. The referral record

- A referral links one scout, one invitation, one landlord and one building. For the reward, every unit that can be
  rented and paid for counts as one property (decision 71), so the referral holds one reward line per unit: a
  building with four flats has four lines and can earn four rewards. A unit can belong to only one referral, so
  there is only ever one scout per unit. If two valid invitations exist for the same property, the earliest wins.
- Each reward line has a status: `WAITING_FOR_RENTAL`, `ELIGIBLE`, `APPROVED`, `PAID`, and `VOID` with a reason
  (already on the app, rented through escrow, conflict of interest, put right by staff after review).
- The scout sees their referrals and statuses in the app (`GET /me/scout/referrals`); staff see all of them.

### 5. When the reward is earned

- Only the first rental of each unit counts. When it is recorded:
  - If it went through escrow, that unit's reward line becomes `VOID` (rented through escrow); no reward for that
    unit, now or later. The other units are not affected.
  - If it was completed outside escrow, the line waits until Projectiles has received the completed rental fee for
    that rental, then becomes `ELIGIBLE`. Whether that means both sides' fees or either one is Decisions Log open
    point 20; payouts are not built until it is settled.
- The reward amount is read from the country setting `scouts.rewardMinor` (whole minor units, kobo in Nigeria) when
  a line becomes eligible, and saved on that line, so a later change of the setting does not alter a reward already
  earned. While the setting is not set (open point 16), no line can become eligible.

### 6. Conflict checks

Run when the invitation is accepted, again when the property is linked, and again just before paying:

- The scout must not be the landlord, an agent on the property, or the tenant of that first rental.
- The scout must not share, with any of them, a phone number or email address ever confirmed on either account, a
  bank account (compared by its fingerprint, as ID numbers are in ADR 0007), or a device (by the install identifier
  still to be added).
- A failed check makes the reward line `VOID` with the reason recorded and goes to the staff review list, so a mistaken
  match can be put right by a person.

### 7. Paying the reward

- Rewards are Projectiles' own money, so they are **not** written to the escrow ledger (ADR 0003). They have their own
  table of reward payouts: the reward line (unique), amount in minor units with the currency, the scout's bank
  account, the staff member who approved it and when, status, provider reference and an **idempotency key**, like
  every payout.
- A payout goes only to a bank account confirmed in the scout's own name. Without one, the reward waits and the scout
  is told to add one.
- **Every payout is approved by staff before it is paid** (decision 71): an eligible line goes to the staff payout
  list, a staff member approves it (recorded in the audit log), and only then is it sent through the payout provider
  adapter (`server/src/integrations`).
- Payouts stay blocked until open points 18 and 19 (estate agency rules and withholding tax) are settled, so no
  guess about tax is built in.

### 8. Switch and settings

- New feature switch `growth.scouts` ("Scouts and referral rewards"), off by default, in a new "Growth" area
  (Specification Section 17.1). The server refuses every scout route while it is off.
- New country setting: `scouts.rewardMinor` (not set, open point 16). There is no invitation expiry setting
  (decision 71). The setting is recorded in `docs/DEPLOYMENT.md` in the pull request that adds it.

### 9. API (added to `docs/api/openapi.yaml` when the work is scheduled)

`POST` and `GET /me/scout`; `POST` and `GET /scout/reports`; `POST /scout/reports/{reportId}/invitations`;
`GET /invitations/{code}` (public: who invited you, nothing private); `invitationCode` on `POST /auth/register`;
`GET /me/scout/referrals`; staff: `GET /admin/scout-referrals`, `POST /admin/scout-referrals/{id}/void`,
`GET /admin/scout-payouts`, `POST /admin/scout-payouts/{id}/approve`. Each states its verification level and feature switch, as the existing routes do.

### 10. Screens (a design group of their own, approved before any app screen is built)

Become a scout; report a vacant property (pin, photos, description); invite the landlord (share link, show QR code);
the landlord's invitation page; my referrals and rewards; staff screens for referrals, the review list and payouts.

### 11. Tests

Unit tests for the rules (one scout per unit, one reward per unit, earliest valid invitation wins, escrow voids only
that unit, the amount saved at eligibility, every conflict check, no payout without staff approval) and API tests for each route, including the switch being off, a landlord
already on the app, a second invitation for the same property, and a repeated payout request returning the same payout.

## Settled by decision 71 (24 October 2026)

Level 1 is enough to be a scout; withdrawing needs identity checked and a bank account in the scout's own name. Each
unit that can be rented and paid for counts as one property for the reward. Invitations do not expire. Every payout
is approved by staff. Still open: Decisions Log open points 16 (amount), 17 (release), 18 and 19 (legal and tax), and
20 (whether both sides' completed rental fees, or either, must be received).
