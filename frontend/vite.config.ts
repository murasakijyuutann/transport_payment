import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        register: resolve(root, 'register.html'),
        dashboard: resolve(root, 'dashboard.html'),
        tap: resolve(root, 'tap.html'),
        journeys: resolve(root, 'journeys.html'),
        journey: resolve(root, 'journey.html'),
        wallet: resolve(root, 'wallet.html'),
      },
    },
  },
});
