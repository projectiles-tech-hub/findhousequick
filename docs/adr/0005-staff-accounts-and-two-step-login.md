# ADR 0005: Staff accounts and two-step login

- Status: Decided by Emmanuel on 22 October 2026 (Decisions Log, decisions 29 and 30); the details marked
  "proposed" below are for his confirmation
- Context: Product Specification, Sections 15.4 (staff two-step login), 16.2 (team roles by country) and 19
  (administration); Technical Architecture, Section 13; Release 1 step 2.

## Decided

- Staff sign in with two steps. The second step can be **either an SMS code or a code from an authenticator app**
  (Google Authenticator or similar); both are built, and staff choose each time.
- Super admins add staff, set their roles and countries, and deactivate them **through admin endpoints**, with
  every change recorded. The **first super admin** is created with a one-time server command.

## How it works

### Staff accounts
- A staff member is an ordinary registered user with a staff record: roles (`SUPER_ADMIN`, `COUNTRY_MANAGER`,
  `VERIFIER`, `FIELD_OFFICER`, `SUPPORT`, `FINANCE`), the countries they may act on (`*` for all), and whether
  they are active.
- **First super admin**: the person registers in the app as normal, then a developer runs
  `pnpm staff:make-super-admin +234...` on the server. The command refuses if any super admin already exists,
  so it cannot be used to add more later; after that, staff are managed through the API.
- **Admin endpoints** (super admins only): `GET /v1/admin/staff`, `POST /v1/admin/staff` (by phone number),
  `PATCH /v1/admin/staff/{userId}` (roles, countries, active). Every change is written to the audit log with the
  before and after values.
- A super admin cannot remove their own super admin role or deactivate themselves, so the platform always has
  at least one super admin.
- Changes take effect on the staff member's next request; nobody needs to sign out and in again.

### Two-step login
- Every staff-only route (`/v1/admin/...`) needs the signed-in device to have passed the second step. Without
  it the answer is `403 TWO_STEP_REQUIRED`.
- After signing in normally, the staff member either asks for an SMS code (`POST /v1/auth/two-step/sms`) or opens
  their authenticator app, then sends the code (`POST /v1/auth/two-step/verify`, saying which kind).
- **Setting up an authenticator** (`POST /v1/me/two-step/authenticator`, then `.../confirm` with a first code)
  needs a device that has already passed the second step by SMS. Otherwise someone who stole only the password
  could add their own authenticator.
- The authenticator's secret is encrypted in the database with `FIELD_ENCRYPTION_KEY`. Each authenticator code
  works once, so a code seen over someone's shoulder cannot be reused.
- SMS codes for the second step follow the code rules in ADR 0004 (10 minutes, 5 guesses, one a minute, five an
  hour).

### Feature-rule endpoints
- `GET /v1/admin/feature-rules`, `POST /v1/admin/feature-rules`, `POST .../{ruleId}/approve` and
  `POST .../{ruleId}/archive`, for super admins and country managers, following ADR 0002 as confirmed.
- When a country manager withdraws a live rule, the rule is marked "withdrawal requested" and stays in force until
  a super admin approves the withdrawal with the same approve endpoint.

## Proposed (for confirmation)

1. **Second-step guess limit**: after 5 wrong second-step codes, the second step pauses for 15 minutes for that
   staff member (the same rule as passwords), counted in one database statement as in ADR 0004.
2. **How long the second step lasts**: until that device signs out or its session ends (30 days without use,
   ADR 0004). A shorter period for staff, for example 12 hours, is possible if wanted.
3. Two-step login for **ordinary users** (Specification 15.4 says they may turn it on) is left for a later step.
