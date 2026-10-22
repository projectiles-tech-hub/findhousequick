# ADR 0001: Technology stack

- Status: Accepted (Emmanuel Chukwuka Oraegbu, 22 October 2026)
- Context: Technical Architecture and Execution Plan, Section 8.

## Decision

| Part | Choice |
| --- | --- |
| Apps (Android, iPhone, web, Windows, Mac) | Flutter |
| Public website | Next.js |
| API server | Node.js 22, NestJS 12, TypeScript (ES modules) |
| Database | PostgreSQL 16 with PostGIS, accessed through Prisma 7 |
| Cache and job queue | Redis 7 with BullMQ |
| Package manager (server) | pnpm |
| Tests (server) | Vitest; API tests run against a real PostgreSQL database |
| Linting (server) | oxlint |

## Notes

- **pnpm, not npm**: npm 10 fails to install this dependency set (`Cannot read properties of null (reading 'edgesOut')`
  while resolving peer dependencies). pnpm installs it cleanly and is stricter about undeclared dependencies.
- **Prisma and PostGIS**: Prisma cannot read or write geography columns. They are declared as `Unsupported(...)`
  and accessed with raw SQL through `src/common/geo.ts`. Spatial indexes are declared in the schema with
  `type: Gist` so Prisma does not try to drop them.
- **Rules Prisma cannot express** (partial unique indexes, check constraints, triggers) live in hand-written
  migrations, starting with `20261022140800_integrity_rules`. Check them with `prisma migrate diff` before releases.
- The old PHP prototype is kept, unchanged, in the `findhousequick-legacy` repository for reference.
