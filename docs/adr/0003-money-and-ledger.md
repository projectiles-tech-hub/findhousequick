# ADR 0003: Money and the escrow ledger

- Status: Accepted (follows Product Specification Section 9 and the Architecture Plan, Section 11)

## Decision

- **Amounts** are whole minor units (kobo, cents) stored as `BIGINT`, with an ISO 4217 currency code.
  Floats are never used for money. In JSON, amounts are strings.
- **Rates** are basis points (1.5% = 150). Fees are calculated with `feeFromBps`, rounding half up to the
  nearest minor unit.
- **Fee rates are copied onto each escrow transaction** when it starts, so a later change to country settings
  never changes a transaction already under way.
- **Double-entry ledger** (`LedgerAccount`, `LedgerJournal`, `LedgerEntry`):
  - Every journal's debits equal its credits, in one currency matching its accounts. Checked by a database
    trigger when the transaction commits.
  - Ledger rows cannot be updated or deleted (database triggers). Corrections are new journals.
  - Every journal has a unique idempotency key, so a repeated request cannot post twice.
- **Balances** are calculated from entries, not stored, so they cannot drift from the records.
- The real bank account is represented by an `ESCROW_BANK` ledger account per country and currency, reconciled
  daily against bank statements.

## Open points (Decisions Log)

Automatic release days, key handover days, fee refund when the landlord is at fault, interest on escrow
balances and renewal fees are settings in `Country.settings.escrow`. They are `null` until decided, and the
escrow feature stays switched off until they are set.
