import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://transport_user:your_password@localhost:5432/transport_abt_test';

const ADMIN_URL =
  process.env.ADMIN_DATABASE_URL ??
  'postgresql://transport_user:your_password@localhost:5432/postgres';

export async function setup() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-32chars!!!!!!';

  const admin = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await admin.connect();
  } catch (err) {
    console.error(`
Postgres is not reachable at localhost:5432 (needed for integration tests).

  1. Start Docker Desktop
  2. From the repo root:  docker compose up -d postgres
  3. Wait until the container is healthy, then re-run:  npm test

Unit-only (no DB):  npm run test:unit
`);
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
