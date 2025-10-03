import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Only include interactive test files from interactive-tests directory
    include: ['interactive-tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Interactive tests need longer timeouts for CLI startup and API responses
    testTimeout: 60000,
    hookTimeout: 30000,
    // Run sequentially to avoid tmux session conflicts
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
