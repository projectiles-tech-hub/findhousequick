# ADR 0005: Staff accounts and two-step login

- Status: Decided by Emmanuel on 22 October 2026 (Decisions Log, decisions 29 to 34)
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
- Every staff-only route (`/v1/admin/...`) needs the signed-in device to have passed the second step **within the
  last 3 hours** (decision 32). Without it the answer is `403 TWO_STEP_REQUIRED`, and the staff member does the
  second step again.
- The 3 hours is a **platform setting** (`staffTwoStepMinutes`, default 180), which super admins can change through
  `PATCH /v1/admin/platform-settings` with a reason. Every change is recorded with the person, time, reason, and
  the values before and after. A change applies to every device straight away, including devices that passed
  the second step earlier.
- **The second step must be a different factor from the sign-in** (decision 34). The server records how each
  device signed in (password or SMS code):
  - signed in with a **password**: the second step may be an SMS code or an authenticator app code;
  - signed in with an **SMS code** (or just registered, which also uses an SMS code): the second step must be an
    authenticator app code, because a second SMS code would prove the same phone twice. Such a device is
    refused an SMS second-step code (`403 DIFFERENT_FACTOR_REQUIRED`). A staff member with no authenticator app
    signs in with their password instead.
- After signing in normally, the staff member either asks for an SMS code (`POST /v1/auth/two-step/sms`) or opens
  their authenticator app, then sends the code (`POST /v1/auth/two-step/verify`, saying which kind).
- **Setting up an authenticator** (`POST /v1/me/two-step/authenticator`, then `.../confirm` with a first code)
  needs a device that has already passed the second step (by SMS, or by an authenticator already set up).
  Otherwise someone who stole only the password could add their own authenticator.
- The authenticator's secret is encrypted in the database with `FIELD_ENCRYPTION_KEY`. Each authenticator code
  works once, so a code seen over someone's shoulder cannot be reused.
- SMS codes for the second step follow the code rules in ADR 0004 (10 minutes, 5 guesses, one a minute, five an
  hour).

### Feature-rule endpoints
- `GET /v1/admin/feature-rules`, `POST /v1/admin/feature-rules`, `POST .../{ruleId}/approve` and
  `POST .../{ruleId}/archive`, for super admins and country managers, following ADR 0002 as confirmed.
- "Switching off at once" means a rule that switches a feature off with no start time, end time or percentage.
  An off rule with a start time is scheduling, and one with an end time switches the feature back on later
  without approval, so both wait for a super admin when a country manager makes them.
- When a country manager withdraws a live rule, the rule is marked "withdrawal requested" and stays in force until
  a super admin approves the withdrawal with the same approve endpoint.
- Country managers see whole-platform and user-type rules (they affect their countries) and the rules for their
  own countries; super admins see all rules.

## Confirmed (22 October 2026)

1. After 5 wrong second-step codes, the second step pauses for 15 minutes for that staff member (the same rule
   as passwords), counted in one database statement as in ADR 0004 (decision 31).
2. The staff second step lasts 3 hours, then must be done again; super admins can change the period (decision 32).
3. Two-step login for ordinary users is left for a later step (decision 31).
4. "Switching off at once" means an off rule with no start time, end time or percentage (decision 33).
5. The second step must be a different factor from the sign-in (decision 34).
