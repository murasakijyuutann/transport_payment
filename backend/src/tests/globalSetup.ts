import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatPostgresSetupError,
  resolveAdminDatabaseUrl,
  resolveTestDatabaseUrl,
} from './dbUrls.js';

export async function setup() {
  const TEST_URL = resolveTestDatabaseUrl();
  const ADMIN_URL = resolveAdminDatabaseUrl();

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-32chars!!!!!!';

  const admin = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await admin.connect();
  } catch (err) {
    console.error(formatPostgresSetupError(err));
    throw err;
  }

  try {
    const exists = await admin.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
      'transport_abt_test',
    ]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE transport_abt_test OWNER transport_user`);
    }
  } finally {
    await admin.end();
  }

  const pool = new pg.Pool({ connectionString: TEST_URL });
  const db = drizzle(pool);
  const root = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.resolve(root, '../db/migrations');
  await migrate(db, { migrationsFolder });
  await pool.end();
}
