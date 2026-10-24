# Documents

Every document in `docs/`, what it is for and when to read it. Keep this list current: add a document here in
the same pull request that adds it (see `CLAUDE.md`).

Documents are updated in place, never copied into new versions; GitHub keeps the older versions. Where a document
has both a Word (`.docx`) and a text (`.md`) copy, the Word file is the original and wins if they differ.

## Specifications (`docs/specs/`)

| Document | What it is for | When to read it |
| --- | --- | --- |
| `FindHouseQuick_Decisions_Log` (`.docx`, `.md`) | Every decision Emmanuel has made, numbered and dated with its source, and the points still open. | First, before any task. Before building anything an open point touches. |
| `FindHouseQuick_Product_Specification` (`.docx`, `.md`) | What the platform does: users, verification, listings, payments, controls. The version and its history are inside the document (Section 22). | Before building or changing any feature. |
| `FindHouseQuick_Technical_Architecture_and_Execution_Plan` (`.docx`, `.md`) | How the platform is built and delivered: technology, structure, security, releases and the order of work. | Before starting a release or a step, and when making a technical choice. |

## Build records

| Document | What it is for | When to read it |
| --- | --- | --- |
| `STATUS.md` | Where the build stands, what Emmanuel still needs to decide, and the next steps in order. | At the start and end of every session. |
| `DEPLOYMENT.md` | Every server setting, secret, outside account and manual step needed to run the system. | When adding a setting, secret or outside service, and when deploying. |
| `api/openapi.yaml` | The agreed Release 1 API design (OpenAPI). | Before building or changing any endpoint; the code must match it. |
| `designs.md` | Every Release 1 screen design and design system part: its Penpot link, its group, and whether Emmanuel has approved it, asked for changes or is still to review it (decisions 42 and 67). | Before designing a screen, and before building any app screen: only approved designs are built. |

## Architecture decision records (`docs/adr/`)

How particular parts are built, and why. Read the one for the area you are working on.

| Document | Subject |
| --- | --- |
| `0001-technology-stack.md` | Choice of NestJS, Prisma, PostgreSQL with PostGIS, Redis and Flutter. |
| `0002-feature-controls.md` | Feature switches, country settings and how switch changes are approved. |
| `0003-money-and-ledger.md` | Money in whole minor units, fee rates in basis points, and the append-only escrow ledger. |
| `0004-sign-in-and-sessions.md` | Sign-in, access and refresh tokens, sessions and password protection. |
| `0005-staff-accounts-and-two-step-login.md` | Staff roles, the first super admin, and the staff second step. |
| `0006-email-and-contacts.md` | Email as a second contact: confirming phone and email, sign-in and codes by either, and replacing a contact. |
| `0007-verification-ladder-and-identity-checks.md` | How the server enforces verification levels, how identity checks run and what each result means, and agent company details. |
| `0008-scouts-and-referral-rewards.md` | Proposed build plan for scouts and the referral reward (decisions 70 and 71): reporting, invitations, the referral record, conflict checks and reward payouts kept apart from the escrow ledger. Not built yet. |

## Reviews (`docs/reviews/`)

Dated reviews of the documents or the build. Emmanuel's decisions on each finding are written into the report's
own rows, with the date and Decisions Log number.

| Document | What it is for | When to read it |
| --- | --- | --- |
| `2026-10-22_FindHouseQuick_Specification_Check` (`.docx`, `.md`) | Check of Product Specification 1.3 against the build plan: 21 findings, each with Emmanuel's decision (decisions 39 to 59). | When working on an area a finding covers. |
