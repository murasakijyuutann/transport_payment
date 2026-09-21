/**
 * Vitest worker setup — point app code at the test DB.
 * Credentials come from DATABASE_URL (loaded by Vitest from .env) unless
 * TEST_DATABASE_URL is set explicitly.
 */
import { resolveTestDatabaseUrl } from './dbUrls.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-32chars!!!!!!';
process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.MAX_JOURNEY_DURATION_HOURS = process.env.MAX_JOURNEY_DURATION_HOURS ?? '4';
