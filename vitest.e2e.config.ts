import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Set Node.js as the test environment for CLI testing
    environment: 'node',

    // Test file patterns - only E2E tests
    include: ['e2e/**/*.{test,spec}.ts'],

    // Files to ignore
    exclude: ['node_modules', 'dist', 'coverage', 'src/**/*'],

    // Setup files to run before tests
    setupFiles: ['./vitest.setup.ts'],

    // Extended timeout for interactive E2E tests (30 seconds)
    testTimeout: 30000,

    // Clear mocks between tests
    clearMocks: true,

    // Reset modules between tests
    restoreMocks: true,

    // Use explicit imports instead of globals for better type safety
    globals: false,

    // Environment-specific configuration for interactive tests
    environmentOptions: {
      // Allow TTY simulation
      tty: true,
    },

    // Coverage configuration for E2E tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage-e2e',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/index.ts',
        'e2e/**/*', // Don't include test files in coverage
      ],
      thresholds: {
        // Lower thresholds for E2E coverage since we're testing integration
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50,
      },
    },

    // Run tests sequentially for E2E to avoid conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Retry failed tests once (useful for flaky E2E tests)
    retry: 1,
  },
});
