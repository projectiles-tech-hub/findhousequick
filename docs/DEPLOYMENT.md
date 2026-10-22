# Deployment guide and settings register

This is the single place that records everything a server needs to run: every setting, every secret, every
outside account, and every manual step. Nobody should have to remember any of it.

**Rule for every pull request:** if a change adds or changes a setting, a secret, an outside account or a manual
step, it must update this file in the same pull request and list it under "Deployment notes" in the pull request
description.

## 1. Server settings

Each server (test, pilot, production) has its own values. Set them in the hosting provider's settings page or in
GitHub repository secrets, **never in the code**. `server/.env.example` shows the format for development machines.

| Setting | Required | What it is | How to set it | Notes |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Yes | Which kind of server this is | `production` on any internet-facing server | Development-only shortcuts are refused when this is `production` |
| `PORT` | No (default 3000) | Port the API listens on | Usually set by the host | |
| `DATABASE_URL` | Yes | Address and password of the PostgreSQL database (with PostGIS) | Given by the database host | **Secret** |
| `REDIS_URL` | Yes | Address and password of Redis | Given by the Redis host | **Secret** |
| `CORS_ORIGINS` | Yes | Web addresses allowed to call the API from a browser | e.g. `https://app.findhousequick.com` (comma-separated) | Must include the web app's address |
| `JWT_SECRET` | Yes | Signs sign-in passes | `openssl rand -hex 32` | **Secret.** At least 32 characters. Changing it signs every user out |
| `OTP_HASH_SECRET` | Yes (from pull request #4, accounts) | Scrambles SMS codes before storing them | `openssl rand -hex 32` | **Secret.** At least 32 characters and **must differ from `JWT_SECRET`**; the server refuses to start otherwise. Changing it cancels codes already sent |
| `FIELD_ENCRYPTION_KEY` | Yes | Encrypts staff authenticator app secrets (from the staff accounts pull request), and later ID numbers and bank account numbers, in the database | `openssl rand -base64 32` | **Secret. Never change or lose it**: data encrypted with it cannot be read without it. Keep a copy offline in a safe place (see section 3) |
| `ACCESS_TOKEN_MINUTES` | No (default 15) | How long a sign-in pass lasts | Number of minutes, 1 to 60 | Agreed in ADR 0004 |
| `REFRESH_TOKEN_DAYS` | No (default 30) | How long a device stays signed in | Number of days, 1 to 365 | Agreed in ADR 0004 |
| `SMS_PROVIDER` | Yes | Which service sends SMS codes | `log` for development only | `log` prints codes instead of sending them and is refused in production. A real provider (e.g. Termii) is added before any pilot |

### Settings changed in the admin panel (not server settings)

These live in the database and are changed by super admins through the admin endpoints, with a reason; every
change is recorded with the values before and after. They need nothing set on the server.

| Setting | Default | What it is | Where it is changed | Notes |
| --- | --- | --- | --- | --- |
| `staffTwoStepMinutes` | 180 (3 hours) | How long a staff device's second step lasts before it must be done again | `PATCH /v1/admin/platform-settings` | Decision 32. Allowed from 15 to 1440 minutes. Reaches every server within 30 seconds |

Country settings and feature switches are also changed this way (see ADR 0002 and the country controls).

## 2. Outside accounts

All accounts are opened in the name of Projectiles Tech Hub Limited, with the Managing Director holding the master
login. Most need the CAC certificate (RC 7987623).

| Service | Purpose | Needed for | Status |
| --- | --- | --- | --- |
| GitHub organisation `projectiles-tech-hub` | Code, checks, deployment | Now | Done |
| Claude GitHub App on the organisation | Build sessions can push code | Now | Done |
| SMS provider (Termii recommended; Africa's Talking as backup) | SMS codes | Pilot | Not yet |
| Hosting (VPS, e.g. DigitalOcean or Hetzner) | Runs the API, database and Redis | Test system and pilot | Not yet (needs a company dollar card) |
| Cloudflare | Domain DNS, web app hosting (Pages), file storage (R2) | Test system and pilot | Not yet |
| Domain name (findhousequick.com and/or .com.ng) | Web addresses | Pilot | Not yet |
| Google Cloud project | Maps; Sign in with Google | Release 1 | Not yet |
| Identity check provider (Smile ID, Dojah, Prembly or similar) | NIN, selfie and liveness checks | Release 1 | Not yet |
| Google Play developer account | Android app distribution and testing | Pilot | Not yet |
| Apple developer account | iPhone app (TestFlight) and Sign in with Apple | iPhone release | Not yet |

## 3. Handling secrets

- Generate every secret fresh for each server. Never copy a secret from one server to another, and never reuse the
  development values.
- Store secrets only in the host's settings page or in GitHub repository secrets (Settings, then Secrets and
  variables, then Actions).
- Keep an offline copy of `FIELD_ENCRYPTION_KEY` for each server (for example, written down and kept in the company
  safe, or in a password manager the Managing Director controls). Losing it means losing the encrypted ID and bank
  numbers.
- If a secret is ever exposed (pasted in a chat, committed by mistake), replace it at once. For
  `FIELD_ENCRYPTION_KEY`, ask a developer first: it needs a re-encryption step, not a simple swap.

## 4. One-time and manual steps

| Step | When | How | Notes |
| --- | --- | --- | --- |
| Create the first super admin | Once per server, after the database is set up (from the staff accounts pull request) | 1. The person (normally the Managing Director) registers in the app as a normal user. 2. On the server, in the `server` folder: `pnpm staff:make-super-admin +234...` with their phone number. 3. They sign in **with their password** and complete two-step login with an SMS code (after signing in with an SMS code, the second step must be an authenticator app code, decision 34). They can then add an authenticator app. | The command refuses if any super admin already exists, so it can only be used once per server. All further staff are added by a super admin through the admin endpoints (ADR 0005). It is recorded in the audit log |

### Legal and regulatory steps (before any real user signs up)

From the Product Specification (Section 15.1) and the Technical Architecture (Section 5). These are for the
company and its lawyer, not the developers, but no real user may sign up until they are done.

| Step | Status |
| --- | --- |
| Terms of use and privacy policy drafted by a lawyer and published | Not yet |
| Registration with the Nigeria Data Protection Commission | Not yet |
| Data Protection Officer appointed | Not yet |
| Data protection impact assessment written | Not yet |
| How long identity images are kept after verification (Decisions Log open point 15) | Not yet |

## 5. Checklist before any server goes live

1. Every required setting in section 1 is set, with fresh secrets.
2. `NODE_ENV` is `production` and `SMS_PROVIDER` is a real provider.
3. Database migrations applied (`npx prisma migrate deploy`) and starter data loaded (`pnpm db:seed`).
4. `GET /v1/health` returns `status: ok`.
5. The first super admin has been created (section 4) and has completed two-step login.
6. Daily database backups are running and one restore has been tested.
7. HTTPS works on the API and web app addresses.
8. Every legal and regulatory step in section 4 is done (needed before any real user signs up).
