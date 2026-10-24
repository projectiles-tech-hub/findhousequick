# ADR 0008: Scouts and the referral reward (build plan)

- Status: Proposed. A plan only: nothing is built until Emmanuel chooses the release (Decisions Log open point 17)
  and answers the questions at the end.
- Context: decision 70 (scouts and the referral reward); decisions 7 (agent authority), 14 and 15 (completed rental
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

- A user opts in from their profile (`POST /me/scout`). Opting in, reporting and inviting need verification, which
  is unchanged (see question 1 on the level). The server checks the level, as for every action (ADR 0007).
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

- `POST /scout/reports/{reportId}/invitations` creates an invitation with a single-use code, stored only as a hash,
  and an expiry date taken from the country setting `scouts.invitationExpiryDays`.
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
  the scout reported, and checks that it is near the reported pin. If an agent is involved, the agent goes through
  the normal authority process (decision 7); the scout plays no part in it.

### 4. The referral record

- A referral links one scout, one invitation, one landlord and one property. It is unique per property, so there is
  only ever one scout per property. If two valid invitations exist for the same property, the earliest one wins.
- Statuses: `WAITING_FOR_RENTAL`, `ELIGIBLE`, `PAID`, and `VOID` with a reason (expired, already on the app, rented
  through escrow, conflict of interest, cancelled by staff).
- The scout sees their referrals and statuses in the app (`GET /me/scout/referrals`); staff see all of them.

### 5. When the reward is earned

- Only the first rental of the property counts. When it is recorded:
  - If it went through escrow, the referral becomes `VOID` (rented through escrow); no reward, now or later.
  - If it was completed outside escrow, the referral waits until Projectiles has received the completed rental fee
    for that rental (see question 3), then becomes `ELIGIBLE`.
- The reward amount is read from the country setting `scouts.rewardMinor` (whole minor units, kobo in Nigeria) when
  the referral becomes eligible, and saved on the referral, so a later change of the setting does not alter a reward
  already earned. While the setting is not set (open point 16), no referral can become eligible.

### 6. Conflict checks

Run when the invitation is accepted, again when the property is linked, and again just before paying:

- The scout must not be the landlord, an agent on the property, or the tenant of that first rental.
- The scout must not share, with any of them, a phone number or email address ever confirmed on either account, a
  bank account (compared by its fingerprint, as ID numbers are in ADR 0007), or a device (by the install identifier
  still to be added).
- A failed check makes the referral `VOID` with the reason recorded and goes to the staff review list, so a mistaken
  match can be put right by a person.

### 7. Paying the reward

- Rewards are Projectiles' own money, so they are **not** written to the escrow ledger (ADR 0003). They have their own
  table of reward payouts: referral (unique), amount in minor units with the currency, the scout's bank account,
  status, provider reference and an **idempotency key**, like every payout.
- A payout goes only to a bank account confirmed in the scout's own name. Without one, the reward waits and the scout
  is told to add one.
- Payouts go through the payout provider adapter (`server/src/integrations`). See question 5 on whether staff approve
  each payout first.
- Payouts stay blocked until open points 18 and 19 (estate agency rules and withholding tax) are settled, so no
  guess about tax is built in.

### 8. Switch and settings

- New feature switch `growth.scouts` ("Scouts and referral rewards"), off by default, in a new "Growth" area
  (Specification Section 17.1). The server refuses every scout route while it is off.
- New country settings: `scouts.rewardMinor` (not set, open point 16) and `scouts.invitationExpiryDays` (see
  question 4). Both are recorded in `docs/DEPLOYMENT.md` and `server/.env.example`, if needed, in the pull request
  that adds them.

### 9. API (added to `docs/api/openapi.yaml` when the work is scheduled)

`POST` and `GET /me/scout`; `POST` and `GET /scout/reports`; `POST /scout/reports/{reportId}/invitations`;
`GET /invitations/{code}` (public: who invited you, nothing private); `invitationCode` on `POST /auth/register`;
`GET /me/scout/referrals`; staff: `GET /admin/scout-referrals`, `POST /admin/scout-referrals/{id}/void`,
`GET /admin/scout-payouts`. Each states its verification level and feature switch, as the existing routes do.

### 10. Screens (a design group of their own, approved before any app screen is built)

Become a scout; report a vacant property (pin, photos, description); invite the landlord (share link, show QR code);
the landlord's invitation page; my referrals and rewards; staff screens for referrals, the review list and payouts.

### 11. Tests

Unit tests for the rules (one scout per property, earliest valid invitation wins, expiry, escrow voids, the amount
saved at eligibility, every conflict check) and API tests for each route, including the switch being off, a landlord
already on the app, an expired invitation, and a repeated payout request returning the same payout.

## Questions for Emmanuel

1. **Level to be a scout.** "Verified first" could mean level 1 (phone and email confirmed, as for every action) or
   level 2 (identity checked). Level 2 is suggested, because rewards are money and a checked identity makes fraud
   harder. Payment always needs the bank account in the scout's own name.
2. **What counts as one property.** One reward per listed unit (each flat or shop), or one per building?
3. **"Projectiles has received the fee".** The completed rental fee is paid by both sides (2% each). Is the reward due
   when both have paid, or when either has?
4. **Invitation expiry.** A starting value for the country setting; 30 days is suggested.
5. **Payout approval.** Should each reward payout wait for a staff member to approve it, or go out automatically once
   eligible (with the checks above)?
