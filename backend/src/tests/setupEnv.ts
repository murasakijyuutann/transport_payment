/** Vitest setup — force test DB before any module imports env. */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-32chars!!!!!!';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://transport_user:your_password@localhost:5432/transport_abt_test';
process.env.MAX_JOURNEY_DURATION_HOURS = process.env.MAX_JOURNEY_DURATION_HOURS ?? '4';
