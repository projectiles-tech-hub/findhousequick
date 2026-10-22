# FindHouseQuick: instructions for Claude

FindHouseQuick is a rental property platform (long-term residential, commercial and short lets) owned by
Projectiles Tech Hub Limited. The product owner is Emmanuel Chukwuka Oraegbu (Managing Director).

## Sources of truth (read before starting any task)

1. `docs/specs/FindHouseQuick_Decisions_Log.md`: decisions made and points still open.
2. `docs/specs/FindHouseQuick_Product_Specification_v1.3.md`: what the platform does.
3. `docs/specs/FindHouseQuick_Technical_Architecture_and_Execution_Plan.md`: how it is built.
4. `docs/adr/`: architecture decision records made during the build.
5. `docs/STATUS.md`: where the build stands and what comes next. Update it at the end of every session.
6. `docs/DEPLOYMENT.md`: every server setting, secret, outside account and manual step needed to run the system.

The `.docx` files in `docs/specs/` are the originals given to Emmanuel; the `.md` files are copies for reading.
If the two differ, the `.docx` wins. Regenerate the `.md` with `pandoc -t gfm --wrap=none`.

Never change a recorded decision without confirming with Emmanuel first. Open points stay open until he settles them;
build them as configurable settings, not hard-coded guesses.

## Working with Emmanuel

- He is a programmer but prefers plain-language explanations. Explain technical terms in short side notes.
- No em dashes in any text written for him (documents, PR descriptions, messages). Use semicolons, colons or separate sentences.
- Documents for him are delivered as Word (.docx) files.
- Do not add unrequested features or content. Suggest them; build them only when approved.

## Stack

| Part | Location | Technology |
| --- | --- | --- |
| API server | `server/` | Node.js 22, NestJS, TypeScript, Prisma, PostgreSQL 16 with PostGIS, Redis, BullMQ |
| Apps (mobile, desktop, logged-in web) | `app/` | Flutter (Dart) |
| Public website | `web/` | Next.js (not started) |
| Local services | `infra/` | Docker Compose (PostgreSQL with PostGIS, Redis) |

## Rules that apply to all code

- **Nothing country-specific is hard-coded.** Currencies, fee rates, time periods, accepted documents, categories,
  languages and similar values are read from country settings (`server/src/controls`).
- **Every feature is behind a feature switch.** Check it on the server; the apps only hide what the server disallows.
- **The verification ladder is enforced on the server**, never only in the apps.
- **Money is stored as whole minor units** (kobo, cents) in `BigInt` columns with an ISO 4217 currency code. Never floats.
- **Fee rates are stored in basis points** (1.5% = 150).
- **The escrow ledger is append-only.** Never update or delete ledger entries; correct with new entries.
- **Payment and payout requests carry an idempotency key.**
- **Personal data is minimised and access is logged.** ID documents and original media live in private storage only.
- **Outside services are reached through adapters** in `server/src/integrations`, one adapter per provider.
- **Nothing Emmanuel needs to know lives only in a chat message.** Any new or changed setting, secret, outside
  account or manual step goes into `docs/DEPLOYMENT.md` (and `server/.env.example` for settings) in the same pull
  request, and is listed under "Deployment notes" in the pull request description. Decisions go into the Decisions
  Log or an ADR; progress and next steps go into `docs/STATUS.md`.

## Setting up a fresh workspace

```bash
bash scripts/setup-dev.sh        # PostgreSQL+PostGIS, Redis, server deps, migrations, seed, Flutter
export PATH="/opt/sdk/flutter/bin:$PATH"
```

## Commands (server, uses pnpm)

```bash
cd server
pnpm install
pnpm db:up             # start Postgres+Redis with Docker (alternative to the setup script)
pnpm db:migrate        # create and apply a migration after changing schema.prisma
pnpm db:seed           # load starter data (Nigeria, states, Benin City, property types, feature switches)
pnpm start:dev         # API on http://localhost:3000/v1, docs at http://localhost:3000/docs
pnpm test              # unit tests
pnpm test:e2e          # API and database tests (rebuilds the findhousequick_test database)
pnpm lint && pnpm typecheck
```

After editing `schema.prisma`, confirm no drift:
`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` must print an empty migration.

## Commands (app)

```bash
cd app
flutter pub get
flutter analyze && flutter test
flutter run -d chrome
```

## API design

`docs/api/openapi.yaml` is the agreed Release 1 API. Build endpoints to match it; update it when the design changes.
Lint it with `npx @redocly/cli lint docs/api/openapi.yaml`.

## Git

- Work on a branch; open a pull request to `main` for Emmanuel's approval.
- Keep commits focused, with clear messages.
