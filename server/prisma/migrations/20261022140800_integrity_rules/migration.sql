-- Integrity rules that Prisma's schema language cannot express.
-- Keep these in sync with the comments in schema.prisma.

-- ---------------------------------------------------------------------
-- Location indexes (fast "near me" and map-area searches)
-- ---------------------------------------------------------------------
CREATE INDEX "Building_location_gist" ON "Building" USING GIST ("location");
CREATE INDEX "City_centre_gist" ON "City" USING GIST ("centre");
CREATE INDEX "MediaAsset_captureLocation_gist" ON "MediaAsset" USING GIST ("captureLocation");
CREATE INDEX "SavedSearch_area_gist" ON "SavedSearch" USING GIST ("area");

-- ---------------------------------------------------------------------
-- One open listing per unit (prevents the same unit being listed twice)
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX "Listing_one_open_per_unit"
  ON "Listing" ("unitId")
  WHERE "status" IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'LIVE', 'PAUSED');

-- ---------------------------------------------------------------------
-- Value checks
-- ---------------------------------------------------------------------
ALTER TABLE "Listing"
  ADD CONSTRAINT "Listing_amounts_not_negative" CHECK (
    "rentMinor" > 0 AND "agencyFeeMinor" >= 0 AND "legalFeeMinor" >= 0
    AND "cautionDepositMinor" >= 0 AND "serviceChargeMinor" >= 0
  );

ALTER TABLE "FeatureRule"
  ADD CONSTRAINT "FeatureRule_rollout_range" CHECK ("rolloutPercent" IS NULL OR "rolloutPercent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "FeatureRule_scope_value" CHECK (("scope" = 'GLOBAL') = ("scopeValue" IS NULL));

ALTER TABLE "EscrowTransaction"
  ADD CONSTRAINT "EscrowTransaction_amounts_valid" CHECK (
    "rentMinor" > 0 AND "agencyFeeMinor" >= 0 AND "legalFeeMinor" >= 0
    AND "cautionDepositMinor" >= 0 AND "serviceChargeMinor" >= 0
    AND "tenantFeeBps" >= 0 AND "landlordFeeBps" >= 0
    AND "tenantFeeMinor" >= 0 AND "landlordFeeMinor" >= 0
  );

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_amount_positive" CHECK ("amountMinor" > 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountMinor" > 0);

-- ---------------------------------------------------------------------
-- Ledger: append-only
-- ---------------------------------------------------------------------
CREATE FUNCTION ledger_block_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ledger records cannot be changed or deleted (table %). Post a correcting journal instead.', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "LedgerEntry_append_only"
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_block_change();

CREATE TRIGGER "LedgerJournal_append_only"
  BEFORE UPDATE OR DELETE ON "LedgerJournal"
  FOR EACH ROW EXECUTE FUNCTION ledger_block_change();

-- ---------------------------------------------------------------------
-- Ledger: every journal must balance, in one currency, matching its accounts.
-- Checked at commit, so all entries of a journal can be inserted first.
-- ---------------------------------------------------------------------
CREATE FUNCTION ledger_check_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  debits  numeric;
  credits numeric;
  entry_count int;
  currency_count int;
  mismatched int;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN "direction" = 'DEBIT'  THEN "amountMinor" END), 0),
    COALESCE(SUM(CASE WHEN "direction" = 'CREDIT' THEN "amountMinor" END), 0),
    COUNT(*),
    COUNT(DISTINCT "currency")
  INTO debits, credits, entry_count, currency_count
  FROM "LedgerEntry" WHERE "journalId" = NEW."journalId";

  IF entry_count < 2 THEN
    RAISE EXCEPTION 'Ledger journal % needs at least two entries', NEW."journalId";
  END IF;
  IF currency_count <> 1 THEN
    RAISE EXCEPTION 'Ledger journal % mixes currencies', NEW."journalId";
  END IF;
  IF debits <> credits THEN
    RAISE EXCEPTION 'Ledger journal % does not balance (debits %, credits %)', NEW."journalId", debits, credits;
  END IF;

  SELECT COUNT(*) INTO mismatched
  FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
  WHERE e."journalId" = NEW."journalId" AND a."currency" <> e."currency";
  IF mismatched > 0 THEN
    RAISE EXCEPTION 'Ledger journal % posts to an account in a different currency', NEW."journalId";
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "LedgerEntry_journal_balances"
  AFTER INSERT ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_check_journal();
