import { defineConfig, configDefaults } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    // Playwright specs under tests/e2e run with @playwright/test, not Vitest.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` / `client-only` are Next.js build markers with no runtime; stub
      // them so server modules (e.g. src/lib/env.ts) can be imported under Vitest.
      'server-only': path.resolve(__dirname, './tests/mocks/empty-module.ts'),
      'client-only': path.resolve(__dirname, './tests/mocks/empty-module.ts'),
    },
  },
});
