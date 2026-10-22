# FindHouseQuick

A rental property platform that lets tenants find verified properties by location and deal directly with the
landlords and authorised agents responsible for them. Built by Projectiles Tech Hub Limited.

## What is in this repository

| Folder | Contents |
| --- | --- |
| `docs/specs/` | Product Specification, Technical Architecture and Execution Plan, Decisions Log |
| `docs/adr/` | Architecture decision records made during the build |
| `docs/api/` | API design (OpenAPI) |
| `server/` | The API server (NestJS, PostgreSQL with PostGIS) |
| `app/` | The Flutter app for Android, iPhone, web, Windows and Mac |
| `web/` | The public website (not started) |
| `infra/` | Local development services |

## Getting started

You need Node.js 22, pnpm 10, Flutter 3.x, and either Docker or local installations of PostgreSQL 16 (with PostGIS)
and Redis 7. On Ubuntu, `bash scripts/setup-dev.sh` installs and prepares everything.

```bash
# 1. Start the database and Redis
docker compose -f infra/docker-compose.yml up -d

# 2. Run the API server
cd server
cp .env.example .env     # then set the two secrets as described in the file
pnpm install
npx prisma migrate deploy
pnpm db:seed
pnpm start:dev           # API at http://localhost:3000/v1, API docs at http://localhost:3000/docs

# 3. Run the app
cd ../app
flutter pub get
flutter run              # choose a device, or: flutter run -d chrome
```

## Status

Release 0 (foundations) complete; Release 1 next. See `docs/STATUS.md` for current status, and
`docs/specs/FindHouseQuick_Technical_Architecture_and_Execution_Plan.md` for the release plan.

## Ownership

Copyright Projectiles Tech Hub Limited. All rights reserved.

This repository is publicly visible during the build, but it is not open source. No licence is granted to copy,
modify, distribute or use this code without written permission from Projectiles Tech Hub Limited.

Never commit secrets (passwords, API keys, tokens, `.env` files) to this repository.
