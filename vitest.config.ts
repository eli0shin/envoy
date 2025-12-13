import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      bun: resolve(__dirname, './src/test/mocks/bun-mock.ts'),
    },
  },
  test: {
    // Set Node.js as the test environment (equivalent to Jest's testEnvironment: 'node')
    environment: 'node',

    // Test file patterns - unit tests only (equivalent to Jest's testMatch)
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // Files to ignore (equivalent to Jest's testPathIgnorePatterns)
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      'e2e/**/*', // E2E tests use separate config
      '**/*.interactive.test.{ts,tsx}', // Interactive tests use separate config
    ],

    // Setup files to run before tests (equivalent to Jest's setupFilesAfterEnv)
    setupFiles: ['./vitest.setup.ts'],

    // Test timeout (10 seconds, equivalent to Jest's testTimeout)
    testTimeout: 10000,

    // Clear mocks between tests (equivalent to Jest's clearMocks)
    clearMocks: true,

    // Reset modules between tests (equivalent to Jest's resetModules)
    restoreMocks: true,

    // Use explicit imports instead of globals for better type safety
    globals: false,

    // Coverage configuration (equivalent to Jest's coverage settings)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/index.ts',
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
});
