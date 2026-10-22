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

You need Node.js 22, Flutter 3.x, and either Docker or local installations of PostgreSQL 16 (with PostGIS) and Redis 7.

```bash
# 1. Start the database and Redis
docker compose -f infra/docker-compose.yml up -d

# 2. Run the API server
cd server
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run start:dev        # API at http://localhost:3000, API docs at http://localhost:3000/docs

# 3. Run the app
cd ../app
flutter pub get
flutter run              # choose a device, or: flutter run -d chrome
```

## Status

Release 0 (foundations) in progress. See `docs/specs/FindHouseQuick_Technical_Architecture_and_Execution_Plan.md`
for the release plan.

## Ownership

Copyright Projectiles Tech Hub Limited. All rights reserved. This repository is private.
