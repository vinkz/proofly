import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    // Keep vitest out of git worktrees under .claude/, which otherwise get
    // swept up as duplicate (and often stale) copies of the suite.
    exclude: ['**/node_modules/**', '**/.claude/**', '**/tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/mocks/server-only.ts'),
    },
  },
});
