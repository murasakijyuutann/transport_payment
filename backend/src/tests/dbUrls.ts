/** Shared helpers for Vitest DB URLs — keep credentials aligned with backend/.env */

const DEFAULT_URL =
  'postgresql://transport_user:your_password@localhost:5432/transport_abt';

export function withDatabase(connectionString: string, database: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${database}`;
  return url.toString();
}

/** Prefer explicit TEST_/ADMIN_ overrides; else derive from DATABASE_URL in .env */
export function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL ?? DEFAULT_URL;
  return withDatabase(base, 'transport_abt_test');
}

export function resolveAdminDatabaseUrl(): string {
  if (process.env.ADMIN_DATABASE_URL) return process.env.ADMIN_DATABASE_URL;
  const base = process.env.DATABASE_URL ?? DEFAULT_URL;
  return withDatabase(base, 'postgres');
}

export function formatPostgresSetupError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : '';

  if (code === '28P01') {
    return `
Postgres rejected the password for user "transport_user" (auth failed).

Integration tests now reuse credentials from backend/.env DATABASE_URL
(rewriting the DB name to transport_abt_test / postgres).

  1. Ensure backend/.env password matches docker-compose.yml
     (default: your_password)
  2. If you changed the password after the first docker volume was created,
     either update .env to the original password, or reset the volume:
       docker compose down
       docker volume rm transport_payment_postgres-data
       docker compose up -d postgres
  3. Confirm nothing else owns :5432 (local Postgres install, etc.)

Unit-only (no DB):  npm run test:unit
`;
  }

  if (code === 'ECONNREFUSED') {
    return `
Postgres is not reachable at localhost:5432 (needed for integration tests).

  1. Start Docker Desktop
  2. From the repo root:  docker compose up -d postgres
  3. Wait until healthy, then:  npm test

Unit-only (no DB):  npm run test:unit
`;
  }

  return `
Could not connect to Postgres for integration tests (${code || 'unknown error'}).

  Check Docker Desktop, docker compose up -d postgres, and backend/.env DATABASE_URL.

Unit-only (no DB):  npm run test:unit
`;
}
