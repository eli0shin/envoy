import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Only include interactive test files
    include: ['**/*.interactive.test.ts', '**/*.interactive.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Interactive tests need longer timeouts
    testTimeout: 60000,
    hookTimeout: 30000,
    // Run sequentially to avoid PTY conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Allow retries for flaky interactive tests
    retry: 1,
    // Verbose output for debugging
    reporters: ['verbose'],
  },
});
