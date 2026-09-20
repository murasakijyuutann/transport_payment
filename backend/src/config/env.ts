import 'dotenv/config';
import { z } from 'zod';

const boolFromEnv = z.preprocess((val) => {
  if (val === undefined || val === '') return undefined;
  if (val === true || val === 'true' || val === '1') return true;
  if (val === false || val === 'false' || val === '0') return false;
  return val;
}, z.boolean().optional());

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16).default('dev-only-change-me-32chars!!'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MAX_JOURNEY_DURATION_HOURS: z.coerce.number().positive().default(4),
  /** When unset: on in development, off in production/test. */
  ENABLE_CRON: boolFromEnv,
});

const parsed = schema.parse(process.env);

export const env = {
  ...parsed,
  ENABLE_CRON:
    parsed.ENABLE_CRON ?? (parsed.NODE_ENV === 'development'),
};
