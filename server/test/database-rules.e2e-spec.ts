import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { TEST_ENV } from './test-env.js';

/**
 * Checks the safety rules built into the database itself, so they hold even if application code
 * has a bug.
 */
describe('Database safety rules', () => {
  let db: pg.Client;

  beforeAll(async () => {
    db = new pg.Client({ connectionString: TEST_ENV.DATABASE_URL });
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  async function account(type: string, currency = 'NGN'): Promise<string> {
    const id = randomUUID();
    await db.query(
      `INSERT INTO "LedgerAccount"(id, type, "countryCode", currency, name, "ownerUserId", "escrowId")
       VALUES ($1, $2, 'NG', $3, $4, NULL, $5)`,
      [id, type, currency, `${type} test`, randomUUID()],
    );
    return id;
  }

  async function postJournal(entries: [string, 'DEBIT' | 'CREDIT', number, string?][]): Promise<string> {
    const journalId = randomUUID();
    await db.query('BEGIN');
    try {
      await db.query(
        `INSERT INTO "LedgerJournal"(id, kind, "idempotencyKey", description) VALUES ($1, 'ADJUSTMENT', $2, 'test')`,
        [journalId, randomUUID()],
      );
      for (const [accountId, direction, amount, currency] of entries) {
        await db.query(
          `INSERT INTO "LedgerEntry"(id, "journalId", "accountId", direction, "amountMinor", currency)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), journalId, accountId, direction, amount, currency ?? 'NGN'],
        );
      }
      await db.query('COMMIT');
      return journalId;
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  }

  describe('escrow ledger', () => {
    it('accepts a balanced journal', async () => {
      const bank = await account('ESCROW_BANK');
      const hold = await account('ESCROW_HOLD');
      await expect(postJournal([[bank, 'DEBIT', 101_500_000], [hold, 'CREDIT', 101_500_000]])).resolves.toBeTruthy();
    });

    it('refuses a journal where debits and credits differ', async () => {
      const bank = await account('ESCROW_BANK');
      const hold = await account('ESCROW_HOLD');
      await expect(postJournal([[bank, 'DEBIT', 100], [hold, 'CREDIT', 90]])).rejects.toThrow(/does not balance/);
    });

    it('refuses a journal with a single entry', async () => {
      const bank = await account('ESCROW_BANK');
      await expect(postJournal([[bank, 'DEBIT', 100]])).rejects.toThrow(/at least two entries/);
    });

    it('refuses an entry in a different currency from its account', async () => {
      const bank = await account('ESCROW_BANK', 'NGN');
      const hold = await account('ESCROW_HOLD', 'NGN');
      await expect(
        postJournal([[bank, 'DEBIT', 100, 'USD'], [hold, 'CREDIT', 100, 'USD']]),
      ).rejects.toThrow(/different currency/);
    });

    it('refuses zero or negative amounts', async () => {
      const bank = await account('ESCROW_BANK');
      const hold = await account('ESCROW_HOLD');
      await expect(postJournal([[bank, 'DEBIT', 0], [hold, 'CREDIT', 0]])).rejects.toThrow(/amount_positive/);
    });

    it('refuses any change or deletion of posted records', async () => {
      const bank = await account('ESCROW_BANK');
      const hold = await account('ESCROW_HOLD');
      const journalId = await postJournal([[bank, 'DEBIT', 500], [hold, 'CREDIT', 500]]);
      await expect(db.query(`UPDATE "LedgerEntry" SET "amountMinor" = 1 WHERE "journalId" = $1`, [journalId])).rejects.toThrow(
        /cannot be changed or deleted/,
      );
      await expect(db.query(`DELETE FROM "LedgerEntry" WHERE "journalId" = $1`, [journalId])).rejects.toThrow(
        /cannot be changed or deleted/,
      );
      await expect(db.query(`DELETE FROM "LedgerJournal" WHERE id = $1`, [journalId])).rejects.toThrow(
        /cannot be changed or deleted/,
      );
    });

    it('processes a repeated request only once (idempotency key)', async () => {
      const key = randomUUID();
      const insert = () =>
        db.query(`INSERT INTO "LedgerJournal"(id, kind, "idempotencyKey", description) VALUES ($1, 'ADJUSTMENT', $2, 'x')`, [
          randomUUID(),
          key,
        ]);
      // A journal with no entries is allowed to exist only inside a transaction that also adds entries,
      // so test the unique key inside a rolled-back transaction.
      await db.query('BEGIN');
      await insert();
      await expect(insert()).rejects.toThrow(/duplicate key/);
      await db.query('ROLLBACK');
    });
  });

  describe('listings', () => {
    async function makeUnit(): Promise<{ unitId: string; userId: string }> {
      const userId = randomUUID();
      await db.query(
        `INSERT INTO "User"(id, phone, "passwordHash", "firstName", "lastName", "countryCode", "updatedAt")
         VALUES ($1, $2, 'x', 'Test', 'Landlord', 'NG', now())`,
        [userId, `+234${Math.floor(Math.random() * 1e10)}`],
      );
      const city = await db.query(`SELECT id FROM "City" WHERE name = 'Benin City'`);
      const buildingId = randomUUID();
      await db.query(
        `INSERT INTO "Building"(id, "countryCode", "cityId", area, street, "addressKey", location, "createdById", "updatedAt")
         VALUES ($1, 'NG', $2, 'Ugbowo', 'Test Street', $3, ST_SetSRID(ST_MakePoint(5.6, 6.39), 4326)::geography, $4, now())`,
        [buildingId, city.rows[0].id, randomUUID(), userId],
      );
      const type = await db.query(`SELECT id FROM "PropertyType" WHERE code = 'flat'`);
      const unitId = randomUUID();
      await db.query(
        `INSERT INTO "Unit"(id, "buildingId", label, "propertyTypeId", "updatedAt") VALUES ($1, $2, 'Flat 1', $3, now())`,
        [unitId, buildingId, type.rows[0].id],
      );
      return { unitId, userId };
    }

    const insertListing = (unitId: string, userId: string, status = 'LIVE', rent = 100_000_000) =>
      db.query(
        `INSERT INTO "Listing"(id, "unitId", kind, status, title, description, currency, "rentMinor", "rentPeriod", "createdById", "updatedAt")
         VALUES ($1, $2, 'LONG_TERM', $3, 't', 'd', 'NGN', $4, 'YEAR', $5, now())`,
        [randomUUID(), unitId, status, rent, userId],
      );

    it('allows only one open listing per unit', async () => {
      const { unitId, userId } = await makeUnit();
      await insertListing(unitId, userId, 'LIVE');
      await expect(insertListing(unitId, userId, 'DRAFT')).rejects.toThrow(/Listing_one_open_per_unit/);
      // Closed listings do not block a new one.
      await insertListing(unitId, userId, 'RENTED');
    });

    it('refuses a zero rent', async () => {
      const { unitId, userId } = await makeUnit();
      await expect(insertListing(unitId, userId, 'DRAFT', 0)).rejects.toThrow(/Listing_amounts_not_negative/);
    });

    it('finds buildings by distance using the location index', async () => {
      const res = await db.query(
        `SELECT count(*)::int AS n FROM "Building"
         WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(5.6005, 6.3905), 4326)::geography, 200)`,
      );
      expect(res.rows[0].n).toBeGreaterThan(0);
    });
  });
});
