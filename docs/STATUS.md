# Project status

Updated: 22 October 2026. Read this after CLAUDE.md at the start of every build session, and update it at the end.

## Where things stand

- **Repository**: `projectiles-tech-hub/findhousequick` (public during the build; may be made private later).
  The old PHP prototype is in `ecoraegbu/findhousequick-legacy`, for reference only.
- **Release 0 (foundations)**: complete. Delivered in pull request #1. All GitHub checks pass.
  - Database design (Release 1 plus escrow ledger) with database-level safety rules
  - Country settings and feature controls (48 switches, approvals, emergency switches, change record)
  - Seed data for Nigeria, Benin City, property types, documents
  - Flutter app foundation (loads switches and country settings from the server)
  - Release 1 API design in `docs/api/openapi.yaml`
  - CI on GitHub Actions; one-command setup in `scripts/setup-dev.sh`

## Small follow-ups

- Update GitHub Actions versions in `.github/workflows/ci.yml` (checkout, setup-node, pnpm action-setup)
  to releases that run on Node.js 24; GitHub shows deprecation warnings for the current ones.
- `ubuntu-latest` runners are moving to Ubuntu 26; confirm CI still passes after the switch.

## Waiting for Emmanuel

- ADR 0002: confirm the up-to-30-second delay for switch changes, and that country managers can change
  non-critical switches in their own countries without a second approval.
- Decisions Log open points: the five escrow settings, escrow legal structure, launch city, partner API,
  mention of the Agent Emma channel in the launch plan, budget, hiring.

## Next: Release 1, in this order

1. **Accounts**: SMS codes (adapter, with a development provider that logs codes), registration with consent,
   login (password or code), refresh tokens (single use), logout, `/me` with verification level.
2. **Staff accounts and roles**, then expose the admin feature-rule endpoints (`/admin/feature-rules`) using
   the existing `ControlsService`.
3. **Verification ladder guard** (`VERIFICATION_REQUIRED`), and the identity check flow behind an adapter.
4. **Reference data endpoints**, then buildings, units and the parts checklist.
5. Documents and media upload (private storage adapter), listings and submission, search, saved items,
   messaging, inspections, reports, review tasks.

Each step: build to `docs/api/openapi.yaml`, add unit and API tests, keep CI green, open a pull request.
