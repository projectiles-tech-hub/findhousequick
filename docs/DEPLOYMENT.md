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
| `REDIS_URL` | Yes | Address and password of Redis | Given by the Redis host | **Secret.** Background jobs run on it (from the identity documents pull request) |
| `TRUST_PROXY_HOPS` | **Yes behind proxies** (default `0`) | How many proxies stand in front of the API, such as Cloudflare and a web server (ADR 0010) | e.g. `2` for Cloudflare in front of nginx; `0` when nothing is in front | Without it, every signed-out visitor seems to come from the proxy's address and all share one viewing limit (decision 52), so the site soon refuses them. Set it to exactly the number of proxies: one too many lets visitors fake their address |
| `PUSH_PROVIDER` | Yes on live servers (default `log`) | Which service sends push notifications (decision 46; ADR 0011) | `log` on development machines only | `log` writes notifications to the server log and is refused when `NODE_ENV` is `production`. The Firebase adapter and its key are added when the Google Cloud account is opened |
| `CALL_PROVIDER` | Yes on live servers (default `test`) | Which calling service carries voice calls inside the app (decision 44; ADR 0011) | `test` on development machines only | `test` carries no voice and is refused when `NODE_ENV` is `production`. The real service gets its own adapter and keys when it is chosen |
| `MAPS_PROVIDER` | No (default `none`) | Which maps service answers place search, nearby amenities and travel times (decision 81; ADR 0015) | `none`, `google` or `openstreetmap` | With `none` those features stay empty. The server refuses to start if the provider chosen is missing its key or addresses |
| `MAPS_PLACES_PROVIDER`, `MAPS_AMENITIES_PROVIDER`, `MAPS_TRAVEL_PROVIDER` | No | Sends one use to a different provider from `MAPS_PROVIDER` | e.g. `MAPS_PROVIDER=openstreetmap` with `MAPS_TRAVEL_PROVIDER=google` | Leave out to follow `MAPS_PROVIDER` |
| `GOOGLE_MAPS_API_KEY` | When any maps use is `google` | The Google Maps Platform key | From the Google Cloud project, with "Places API (New)" and "Routes API" switched on | **Secret.** Limit the key to those two services and to the server's address in the Google Cloud console. Google charges per request above its free allowance |
| `OSM_SEARCH_URL`, `OSM_AMENITIES_URL`, `OSM_ROUTES_URL` | Each when its use is `openstreetmap` | Where the OpenStreetMap services are: Nominatim (place search), Overpass (nearby amenities), OSRM (travel times) | e.g. `https://nominatim.example.com`, `https://overpass.example.com/api/interpreter`, `https://osrm.example.com` | From a paid host, or servers the company runs. Do not point a live server at the OpenStreetMap project's public servers; they are for light use only |
| `OSM_USER_AGENT` | No | The name sent to the OpenStreetMap services, so their operator knows who is calling | `FindHouseQuick (support@findhousequick.com)` | Use a real contact address |
| `MAPS_TIMEOUT_MS` | No (default `4000`) | How long to wait for a maps service before carrying on without it | `4000` | |
| `RUN_BACKGROUND_JOBS` | No (default `true`) | Whether this server runs background jobs, such as deleting identity photos whose retention period has ended | `true` or `false` | Leave `true` on at least one server. With several servers each job still runs once |
| `STORAGE_PROVIDER` | Yes | Where private documents (identity photos, later ownership documents) are kept | `local` for development only | `local` keeps files in a folder and is refused in production. A real provider (Cloudflare R2) is added before any pilot (ADR 0007) |
| `STORAGE_LOCAL_DIR` | No (default `.private-storage`) | Folder used by the `local` storage provider | A folder path | Development only |
| `PUBLIC_WEB_URL` | Yes on servers | The public website's address, used in the invitation links scouts share with landlords (ADR 0008) | e.g. `https://findhousequick.com` | Defaults to `http://localhost:3100` for development |
| `API_PUBLIC_URL` | Yes on servers | The API's own address as the apps reach it, used in upload links | e.g. `https://api.findhousequick.com` | Defaults to `http://localhost:3000` for development |
| `CORS_ORIGINS` | Yes | Web addresses allowed to call the API from a browser | e.g. `https://app.findhousequick.com` (comma-separated) | Must include the web app's address |
| `JWT_SECRET` | Yes | Signs sign-in passes | `openssl rand -hex 32` | **Secret.** At least 32 characters. Changing it signs every user out |
| `OTP_HASH_SECRET` | Yes (from pull request #4, accounts) | Scrambles SMS codes before storing them | `openssl rand -hex 32` | **Secret.** At least 32 characters and **must differ from `JWT_SECRET`**; the server refuses to start otherwise. Changing it cancels codes already sent |
| `LOOKUP_HASH_SECRET` | Yes (from the identity checks pull request, step 3) | Makes fingerprints of ID numbers so one ID used on two accounts can be spotted without storing the number readably (ADR 0007) | `openssl rand -hex 32` | **Secret.** At least 32 characters and **must differ from `JWT_SECRET` and `OTP_HASH_SECRET`**; the server refuses to start otherwise. **Never change it** once real checks exist: earlier fingerprints would stop matching and duplicate IDs would go unnoticed. Keep an offline copy, like `FIELD_ENCRYPTION_KEY` |
| `FIELD_ENCRYPTION_KEY` | Yes | Encrypts staff authenticator app secrets and ID numbers (from the identity checks pull request), and later bank account numbers, in the database | `openssl rand -base64 32` | **Secret. Never change or lose it**: data encrypted with it cannot be read without it. Keep a copy offline in a safe place (see section 3) |
| `ACCESS_TOKEN_MINUTES` | No (default 15) | How long a sign-in pass lasts | Number of minutes, 1 to 60 | Agreed in ADR 0004 |
| `REFRESH_TOKEN_DAYS` | No (default 30) | How long a device stays signed in | Number of days, 1 to 365 | Agreed in ADR 0004 |
| `EMAIL_PROVIDER` | Yes | Which service sends emails (codes and notices) | `log` for development only | `log` prints emails instead of sending them and is refused in production. A real provider is added before any pilot (decision 35) |
| `EMAIL_FROM` | No (has a default) | The sender shown on emails | e.g. `FindHouseQuick <no-reply@findhousequick.com>` | Must be an address on a domain the email service has verified |
| `SMS_PROVIDER` | Yes | Which service sends SMS codes | `log` for development only | `log` prints codes instead of sending them and is refused in production. A real provider (e.g. Termii) is added before any pilot |

### Public website settings (`web/`)

The public website is a separate program (Next.js, ADR 0013). It needs Node.js 22 and runs beside the API, for
example on the same server (`pnpm build`, then `pnpm start`, port 3100). It cannot be hosted as plain files, because
each page is made when it is asked for. `web/.env.example` shows the format.

| Setting | Required | What it is | How to set it | Notes |
| --- | --- | --- | --- | --- |
| `API_BASE_URL` | Yes | Where the website reaches the API, ending in `/v1` | The API's **internal** address, e.g. `http://127.0.0.1:3000/v1` | Not the public address. The website passes the visitor's network address on to the API for the viewing limits (decision 52); through the public address the API would see the web server instead, and all visitors would share one limit |
| `NEXT_PUBLIC_SITE_URL` | Yes | The website's public address | e.g. `https://findhousequick.com` | Used in the links given to search engines. Set before `pnpm build` |
| `NEXT_PUBLIC_APP_URL` | Yes | The address of the signed-in web app, where "Sign in" and "Create an account" lead | e.g. `https://app.findhousequick.com` | Set before `pnpm build` |
| `SITE_COUNTRY` | Yes | The country the website is shown for (ISO code) | `NG` | Its currency, switches and choices then come from the API |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_SUPPORT_PHONE` | Before launch | The support lines shown on the help page | The real numbers, as people should read them | Not decided yet: the designs show placeholder numbers. A line left empty is not shown. Set before `pnpm build` |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_PRIVACY_EMAIL`, `NEXT_PUBLIC_COMPANY_ADDRESS` | Before launch | Contact details shown at the end of the terms and the privacy policy | The company's support email, the Data Protection Officer's email, and the registered address | The privacy policy names a Data Protection Officer, so one must be appointed and this email must reach them. Set before `pnpm build` |
| `NEXT_PUBLIC_PLAY_STORE_URL`, `NEXT_PUBLIC_APP_STORE_URL` | No | Store pages of the phone apps | When the apps are published | The "Get the app" links stay hidden until set |

The website and the API must sit behind the same proxies, and `TRUST_PROXY_HOPS` on the API counts those proxies
only. The API's port must not be open to the internet except through them.

### App build settings (`app/`)

The Flutter app takes its settings when it is built, with `--dart-define=NAME=value` (side note: these are fixed
into the app at build time; they are not secrets).

| Setting | What it is | Example |
| --- | --- | --- |
| `API_BASE_URL` | Where the API is, ending in `/v1` | `https://api.findhousequick.com/v1` |
| `DEFAULT_COUNTRY` | The country used until the user's account or location says otherwise | `NG` |
| `PUBLIC_WEB_URL` | Where the public website is, for the links to the terms of use and the privacy policy on the sign-up screen | `https://findhousequick.com` |
| `PARTS_GALLERY` | `true` adds a page of the shared parts at `/parts`, for checking against the designs. Never set in a build given to users. | not set |

### App permissions on phones

The app asks the phone for the camera and the photo gallery when a user adds a photo of an ID document. The words
iPhone shows when asking are in `app/ios/Runner/Info.plist` (`NSCameraUsageDescription` and
`NSPhotoLibraryUsageDescription`). **Manual step:** Apple reads these words when the app is submitted; change
them there if the wording must change.

### Settings changed in the admin panel (not server settings)

These live in the database and are changed by super admins through the admin endpoints, with a reason; every
change is recorded with the values before and after. They need nothing set on the server.

| Setting | Default | What it is | Where it is changed | Notes |
| --- | --- | --- | --- | --- |
| `listingViewsPerHour` | 120 | Property pages one signed-in account may open in an hour (decision 52) | `PATCH /v1/admin/platform-settings` | 10 to 10,000. Counted in Redis (ADR 0010) |
| `signedOutListingViewsPerHour` | 60 | Property pages one device and network address may open in an hour without signing in (decisions 52 and 75) | `PATCH /v1/admin/platform-settings` | 10 to 10,000 |
| `signedOutViewsPerAddressPerHour` | 300 | Property pages one network address may open in an hour without signing in, whatever device it claims | `PATCH /v1/admin/platform-settings` | 10 to 100,000. Raise it if many people share one address, such as a university network |
| `staffTwoStepMinutes` | 180 (3 hours) | How long a staff device's second step lasts before it must be done again | `PATCH /v1/admin/platform-settings` | Decision 32. Allowed from 15 to 1440 minutes. Reaches every server within 30 seconds |

Country settings and feature switches are also changed this way (see ADR 0002 and the country controls).
The country settings used by identity checks (ADR 0007):

| Country setting | Nigeria at launch | What it is | Notes |
| --- | --- | --- | --- |
| `verification.identityProvider` | `test` on development servers; **must be set to the contracted provider** on the pilot and production servers | Which identity provider runs NIN, selfie and liveness checks | Empty means identity checks are unavailable in that country. The `test` provider exists only when `NODE_ENV` is not `production` |
| `verification.acceptedIdTypes` | `["NIN"]` | ID types accepted for the check | |
| `verification.idNumberPatterns` | `{"NIN": "^[0-9]{11}$"}` | The format each ID number must have | Checked after spaces and dashes are removed |
| `verification.idDocumentTypes` | `["DRIVERS_LICENCE", "INTERNATIONAL_PASSPORT", "NIN_SLIP"]` | Document photos accepted when the ID check fails or does not match (decision 49) | Codes from the country's document types |
| `verification.maxIdentityChecksPerDay` | 3 | Checks one user may start in 24 hours (each costs money with the provider) | 1 to 20 |
| `retention.identityImagesDays` | Not set | Days identity document photos are kept after their check is closed (decision 55) | **Must be set after legal advice before identity checks go live** (open point 15) |

The feature switch `verification.identity_check` (critical) turns identity checks on or off, like any other switch.

The country settings used at sign-up (ADR 0014):

| Setting | Default | What it is | Notes |
| --- | --- | --- | --- |
| `legal.termsVersion` | `2026-11-10` | The version of the terms of use a new user agrees to; recorded on the account | **Manual step:** change it whenever the terms page changes. It is the date shown on the page (`web/src/content/ng/terms.ts`) |
| `legal.privacyVersion` | `2026-11-10` | The same, for the privacy policy | Change it whenever the privacy page changes |

The country settings used by photo and video upload (ADR 0009):

| Country setting | Nigeria at launch | What it is | Notes |
| --- | --- | --- | --- |
| `listings.maxCaptureAgeHours` | 72 | A photo or video must be uploaded within this many hours of being taken | 1 to 720 |
| `listings.captureRadiusMetres` | 100 | A photo or video must be taken within this many metres of the building, plus the phone's reported accuracy | 10 to 1000 |
| `listings.approximateLocationMetres` | 300 | Before an inspection is confirmed, a listing's map position is moved by up to this many metres, the same way every time (Specification 4.3; ADR 0010) | 100 to 2000 |
| `listings.feeTypes` | all four | Which fixed fees are shown on listings, in order: `AGENCY_FEE`, `LEGAL_FEE`, `CAUTION_DEPOSIT`, `SERVICE_CHARGE` (decision 55; ADR 0012) | A fee type left out cannot be entered or charged |
| `inspections.minLeadMinutes` | 120 | How long before it starts a slot can still be booked (ADR 0012) | 0 to 10,080 |
| `inspections.maxDaysAhead` | 30 | How many days ahead inspections can be booked | 1 to 90 |
| `inspections.maxSafetyShares` | 3 | How many times one inspection's details can be sent to a trusted contact by SMS | 1 to 10. Each SMS costs money |
| `verification.riskPoints.*` | 30, 40, 40, 60, 20 | Points added to a listing's risk score by: `nameMatchPending`, `duplicateLocation`, `duplicatePhoto`, `duplicateDocument`, `tenantMismatch` (ADR 0012) | 0 to 100 each. With `verification.riskBands` (amber from 30, red from 60) they decide whether a listing goes live at once, to a desk review or to a site visit |
| `verification.photoMatchBits` | 6 | How different two photo fingerprints may be and still count as the same photo | 0 to 16. Lower means stricter matching |
| `scouts.rewardMinor` | not set | The fixed referral reward for the first rental of a unit, in kobo (decision 70; Decisions Log open point 16) | Whole minor units as text, e.g. `"500000"` for 5,000 naira. While it is not set, no reward becomes eligible |
| `scouts.matchRadiusMetres` | 150 | How near the landlord's building must be to the scout's pin to count as the reported property (ADR 0008) | 20 to 2,000 |
| `listings.confirmAvailabilityDays` | 14 | A live listing expires unless the lister confirms it is still available within this many days | 7 to 14 (Specification 6.6) |

## 2. Outside accounts

All accounts are opened in the name of Projectiles Tech Hub Limited, with the Managing Director holding the master
login. Most need the CAC certificate (RC 7987623).

| Service | Purpose | Needed for | Status |
| --- | --- | --- | --- |
| GitHub organisation `projectiles-tech-hub` | Code, checks, deployment | Now | Done |
| Claude GitHub App on the organisation | Build sessions can push code | Now | Done |
| SMS provider (Termii recommended; Africa's Talking as backup) | SMS codes | Pilot | Not yet |
| Email sending service (for example Resend, Postmark or Amazon SES) | Email confirmation, sign-in and reset codes, receipts and statements (decisions 35 and 36) | Pilot | Not yet |
| Hosting (VPS, e.g. DigitalOcean or Hetzner) | Runs the API, database and Redis | Test system and pilot | Not yet (needs a company dollar card) |
| Cloudflare | Domain DNS, web app hosting (Pages), file storage (R2: private documents now, media later) | Test system and pilot | Not yet. Private storage is built with a local provider; R2 needs its own adapter and keys as server settings |
| Domain name (findhousequick.com and/or .com.ng) | Web addresses | Pilot | Not yet |
| Google Cloud project (with Firebase) | Google Maps (decision 81): switch on "Places API (New)" and "Routes API", and later the maps kits for the apps; push notifications (decision 46); Sign in with Google if adopted | Release 1 | Not yet. Needs a payment card on the account |
| A host for the OpenStreetMap services (map picture, Nominatim, Overpass, OSRM), or servers the company runs | OpenStreetMap (decision 81) | Release 1, if OpenStreetMap is switched on | Not yet; to be chosen |
| Calling service (a self-hosted relay, or a provider such as LiveKit or Agora) | Voice calls inside the app (decision 44) | Release 1 | Not yet; to be chosen when calls are built |
| Penpot (free, open source) and its claude.ai connector | Screen designs (decisions 42 and 67) | Now | Done. Connected and tested on 23 October 2026. The designs are in the Penpot file "Release 1 Screens". The connector's sign-in is kept in claude.ai (Settings, then Connectors, then Penpot), never in this repository or in chat. For each design session, Emmanuel opens the file in his browser, starts the Penpot MCP plugin in it, and keeps that tab open and active. If the connector stops working, reconnect it in claude.ai; if it is still unreliable, the designs move to Claude's Design artifact type (decision 67) |
| Figma | Screen designs (decision 42) | No longer needed | Replaced by Penpot (decision 67), because Figma's AI connector needs a paid seat. The test file "FindHouseQuick Release 1 Screens" in Emmanuel's Figma drafts can be deleted |
| Identity check provider (Smile ID, Dojah, Prembly or similar) | NIN, selfie and liveness checks | Release 1 (before any pilot) | Not yet. Built with a test provider; the real one needs its own adapter, its keys as server settings, and our results address given to the provider: `https://<api address>/v1/identity/provider-results/<provider name>` (ADR 0007) |
| Google Play developer account | Android app distribution and testing | Pilot | Not yet |
| Apple developer account | iPhone app (TestFlight), push notifications and incoming-call alerts on iPhone, Sign in with Apple if adopted | iPhone release | Not yet |

## 3. Handling secrets

- Generate every secret fresh for each server. Never copy a secret from one server to another, and never reuse the
  development values.
- Store secrets only in the host's settings page or in GitHub repository secrets (Settings, then Secrets and
  variables, then Actions).
- Keep an offline copy of `FIELD_ENCRYPTION_KEY` and `LOOKUP_HASH_SECRET` for each server (for example, written down and kept in the company
  safe, or in a password manager the Managing Director controls). Losing it means losing the encrypted ID and bank
  numbers.
- If a secret is ever exposed (pasted in a chat, committed by mistake), replace it at once. For
  `FIELD_ENCRYPTION_KEY`, ask a developer first: it needs a re-encryption step, not a simple swap.

### Server software

| Software | Why | How | Notes |
| --- | --- | --- | --- |
| ffmpeg (which includes ffprobe) | Reading the length of uploaded videos (ADR 0009); later, making the watermarked video copies | On Ubuntu: `sudo apt install ffmpeg`. In a container image, add the `ffmpeg` package | Needed on every server with `RUN_BACKGROUND_JOBS=true`. Without it, every video is rejected as UNREADABLE |
| sharp (image library) | Processing photos: removing location data, quality checks, watermarked display copies | Installed with the server's packages (`pnpm install`); it brings its own image tools | Nothing to do by hand |

### Background queues

Photos and videos are processed on the `media` queue in Redis (ADR 0009). Every server can add work to it; servers
with `RUN_BACKGROUND_JOBS=true` do the work, two items at a time each. An hourly job puts back any media left
processing for more than 15 minutes, and another marks live listings whose lister did not confirm availability in
time as expired. A job every minute marks calls nobody answered within 60 seconds as missed (ADR 0011). Nothing
needs setting up beyond Redis.

### Live connection

Signed-in apps keep a WebSocket open at `/v1/live` (decision 47; ADR 0011). Any proxy or load balancer in front of
the API must pass WebSocket connections through (in nginx: the `Upgrade` and `Connection` headers) and must not
close idle connections in under 60 seconds; the server sends a ping every 30 seconds. Cloudflare passes WebSockets
by default. With several servers, events travel between them through Redis.

## 4. One-time and manual steps

| Step | When | How | Notes |
| --- | --- | --- | --- |
| Create the first super admin | Once per server, after the database is set up (from the staff accounts pull request) | 1. The person (normally the Managing Director) registers in the app as a normal user. 2. On the server, in the `server` folder: `pnpm staff:make-super-admin +234...` with their phone number. 3. They confirm both phone and email, sign in **with their password**, and complete two-step login with an email or SMS code (the second step never uses the channel they signed in with, decision 36). They can then add an authenticator app. | The command refuses if any super admin already exists, so it can only be used once per server. All further staff are added by a super admin through the admin endpoints (ADR 0005). It is recorded in the audit log |
| Load the starter data again after each update | After every deployment that changes `server/prisma/seed.ts` or `server/prisma/seed-data/` (from the step 4 pull request: the photo checklists now ask for toilets separately, decision 56) | On the server, in the `server` folder, after `npx prisma migrate deploy`: `pnpm db:seed` | Safe to run again: it updates property types and checklists without touching anything staff have set |
| Switch on the launch city | Once the launch city is decided (Decisions Log open point) | No admin screen yet. In the database, set `enabled = true` on the city's row in `City` and on its state's row in `Region` | Until a city is switched on, buildings cannot be added there (`CITY_NOT_AVAILABLE`). An admin endpoint for this can be added when wanted |

### Legal and regulatory steps (before any real user signs up)

From the Product Specification (Section 15.1) and the Technical Architecture (Section 5). These are for the
company and its lawyer, not the developers, but no real user may sign up until they are done.

| Step | Status |
| --- | --- |
| Terms of use and privacy policy drafted by a lawyer and published | Drafts written in standard terms and built into the website (`web/src/content/ng/`, pages `/terms` and `/privacy`, ADR 0013). **Still to do: the lawyer's review**, then any changes go into those two files |
| Registration with the Nigeria Data Protection Commission | Not yet |
| Data Protection Officer appointed | Not yet |
| Data protection impact assessment written | Not yet |
| How long identity images are kept after verification (Decisions Log open point 15) | Not yet |
| Before scouts go live (decision 70): whether paying for property introductions needs registration under state estate agency rules, and how withholding tax applies to referral rewards (Decisions Log open points 18 and 19) | Not yet |

## 5. Checklist before any server goes live

1. Every required setting in section 1 is set, with fresh secrets.
2. `NODE_ENV` is `production`, and `SMS_PROVIDER`, `EMAIL_PROVIDER` and `STORAGE_PROVIDER` are real providers.
   Each enabled country's `verification.identityProvider` names a real provider, and `retention.identityImagesDays`
   is set (section 1).
3. Database migrations applied (`npx prisma migrate deploy`) and starter data loaded (`pnpm db:seed`).
   The launch city and its state are switched on (section 4).
4. `GET /v1/health` returns `status: ok`, and `ffprobe -version` works on every server that runs background jobs.
5. The first super admin has been created (section 4) and has completed two-step login.
6. Daily database backups are running and one restore has been tested.
7. HTTPS works on the API and web app addresses.
8. Every legal and regulatory step in section 4 is done (needed before any real user signs up).
