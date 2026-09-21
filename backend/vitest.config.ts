import { defineConfig } from 'vitest/config';

/** Unit tests — no Postgres required. */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/domain/**/*.test.ts'],
    fileParallelism: true,
  },
});
