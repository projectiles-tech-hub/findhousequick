# FindHouseQuick: instructions for Claude

FindHouseQuick is a rental property platform (long-term residential, commercial and short lets) owned by
Projectiles Tech Hub Limited. The product owner is Emmanuel Chukwuka Oraegbu (Managing Director).

## Sources of truth (read before starting any task)

1. `docs/specs/FindHouseQuick_Decisions_Log.md`: decisions made and points still open.
2. `docs/specs/FindHouseQuick_Product_Specification_v1.3.md`: what the platform does.
3. `docs/specs/FindHouseQuick_Technical_Architecture_and_Execution_Plan.md`: how it is built.
4. `docs/adr/`: architecture decision records made during the build.

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

## Commands (server)

```bash
cd server
npm install
npm run db:up          # start local Postgres+Redis with Docker (or use local services)
npx prisma migrate dev # apply migrations
npm run db:seed        # load starter data (Nigeria, Edo, Benin City, categories, feature switches)
npm run start:dev      # run the API on http://localhost:3000 (docs at /docs)
npm test               # unit tests
npm run test:e2e       # API tests against a real database
npm run lint
```

## Git

- Work on a branch; open a pull request to `main` for Emmanuel's approval.
- Keep commits focused, with clear messages.
