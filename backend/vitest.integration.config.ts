import { defineConfig } from 'vitest/config';

/** Integration tests — requires Postgres (`transport_abt_test`). */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['./src/tests/setupEnv.ts'],
    globalSetup: ['./src/tests/globalSetup.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
