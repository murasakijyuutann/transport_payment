import { afterAll, beforeAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { seedNetworkAndRules } from '../db/seedCore.js';

beforeAll(async () => {
  await seedNetworkAndRules();
});

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      wallet_ledger_entries,
      payment_transactions,
      fare_charges,
      fare_calculations,
      fare_accumulators,
      journeys,
      tap_events,
      fare_media,
      wallets,
      transit_accounts,
      users
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await pool.end();
});
