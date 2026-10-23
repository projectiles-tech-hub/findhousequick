# FindHouseQuick: instructions for Claude

FindHouseQuick is a rental property platform (long-term residential, commercial and short lets) owned by
Projectiles Tech Hub Limited. The product owner is Emmanuel Chukwuka Oraegbu (Managing Director).

## Sources of truth (read before starting any task)

1. `docs/specs/FindHouseQuick_Decisions_Log.md`: decisions made and points still open.
2. `docs/specs/FindHouseQuick_Product_Specification.md`: what the platform does (the version is shown inside it).
3. `docs/specs/FindHouseQuick_Technical_Architecture_and_Execution_Plan.md`: how it is built.
4. `docs/adr/`: architecture decision records made during the build.
5. `docs/STATUS.md`: where the build stands and what comes next. Update it at the end of every session.
6. `docs/DEPLOYMENT.md`: every server setting, secret, outside account and manual step needed to run the system.
7. `docs/README.md`: index of every document in `docs/`, what it is for and when to read it.

The `.docx` files in `docs/specs/` are the originals given to Emmanuel; the `.md` files are copies for reading.
If the two differ, the `.docx` wins. Regenerate the `.md` with `pandoc -t gfm --wrap=none`.

**Documents are updated, not multiplied.** A document is updated in place, never copied into a new version
(no "v1.4" or "Decided" copies); the GitHub history keeps older versions, and a document that has versions
shows its version inside it. A new file is made only for a genuinely new subject, such as a new ADR or a new
dated review. Every document added to `docs/` is listed in `docs/README.md` in the same pull request.

Never change a recorded decision without confirming with Emmanuel first. Open points stay open until he settles them;
build them as configurable settings, not hard-coded guesses.

## Decision procedure

1. **What counts.** A decision is anything Emmanuel settles about what the platform does or how it is built. It can
   come from chat, a "Waiting for Emmanuel" item, a pull request, a review report, or a message relaying decisions
   made in the claude.ai Project or another chat.
2. **Repeat it back.** Before recording, repeat the decision back to him in one or two plain sentences.
3. **Record it** in the Decisions Log (both the `.docx` and the `.md`): the next number, the date, the wording and
   the source (at the end of the decision text, "Source: ..."). Never edit an old decision; a change is a new
   entry marked "replaces decision N". When a decision settles an open point, close that point in the Decisions Log.
4. **Update everything it affects, in the same pull request**: the Product Specification (with a new version number,
   and a line in its Version History) if it changes what the platform does; the relevant ADR if it changes how
   something is built; the API design; `docs/DEPLOYMENT.md`; the review report row if it answers a finding;
   `docs/STATUS.md` ("Waiting for Emmanuel" and "Next"); `docs/README.md` if a document is added.
5. **Only then** write code that depends on it.
6. **List it** under "Decisions recorded" in the pull request description. A decision takes effect when Emmanuel
   merges the pull request.

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

## Session routine (how steps are tracked)

A step is **done** only when its pull request has been **merged into `main`** by Emmanuel. Approval happens on
GitHub, outside the session, so every session must check rather than assume.

**At the start of every session:**
1. Run `git fetch origin` and check which pull requests were merged or closed since `docs/STATUS.md` was last
   updated (`gh pr list --state merged` and `--state closed`, or `git log origin/main`).
2. If `STATUS.md` (or the Decisions Log, ADRs or `DEPLOYMENT.md`) is out of date, fix it first, in its own small
   pull request: move merged steps to "Where things stand", tick them in "Next", and note anything closed
   without merging.
3. Read "Waiting for Emmanuel" and remind him, briefly, of any item that blocks the next step.

**At the end of every step, in the same pull request as the work:**
1. Update `STATUS.md`: describe the step as "in pull request #N, awaiting approval" (never as finished), list
   what is still to do from that step, and keep "Next" in order.
2. Record any decision Emmanuel made during the step, following the decision procedure above, and remove it from
   "Waiting for Emmanuel".
3. Record any new setting, secret, account or manual step in `docs/DEPLOYMENT.md`.
4. Keep `docs/README.md` current: add any new document, and update the description of any document whose purpose
   changed.
5. Fill in every section of the pull request template.

**Decisions Emmanuel gives in chat** (for example, an answer to a "Waiting for Emmanuel" item) follow the decision
procedure above: recorded before any code that depends on them is written.

## Git

- Work on a branch; open a pull request to `main` for Emmanuel's approval.
- Keep commits focused, with clear messages.
