/**
 * Vitest setup file
 * Global configuration and utilities for all tests
 */

import { vi, beforeEach, afterEach, expect } from 'vitest';
import {
  createMockLogger,
  createFsPromisesMock,
  createFsMock,
} from './src/test/helpers/createMocks.js';

// Global test timeout for individual tests (equivalent to Jest's jest.setTimeout)
vi.setConfig({ testTimeout: 30000 });

// Mock console methods to avoid noise in test output
// but allow them to be spied on in individual tests
globalThis.console = {
  ...console,
  // Suppress console output during tests
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Mock process.stdout.write for JSON output tests
process.stdout.write = vi
  .fn()
  .mockImplementation(() => true) as typeof process.stdout.write;

// Mock react-reconciler to avoid bun: protocol issues
vi.mock('react-reconciler/constants', () => ({
  __esModule: true,
  default: {},
}));

// Mock ink to avoid React dependency issues
vi.mock('ink', () => ({
  render: vi.fn(),
  Box: vi.fn(() => null),
  Text: vi.fn(() => null),
  useApp: vi.fn(() => ({ exit: vi.fn() })),
  useStdin: vi.fn(() => ({ stdin: {}, setRawMode: vi.fn() })),
}));

// Mock all OpenTUI modules to avoid bun: protocol issues
vi.mock('@opentui/core', () => ({
  StyledText: vi.fn(),
  fg: vi.fn(),
  bg: vi.fn(),
  bold: vi.fn(),
  italic: vi.fn(),
  useTerminalDimensions: vi.fn(),
}));

vi.mock('@opentui/react', () => ({
  useKeyboard: vi.fn(),
  render: vi.fn(),
  Text: vi.fn(() => null),
  Box: vi.fn(() => null),
  useTerminalDimensions: vi.fn(),
  useRenderer: vi.fn(),
}));

// Global logger mock for infrastructure tests
// Tests that need to assert on logger calls should use manual mocking
vi.mock('./src/logger.js', () => createMockLogger());

// Global file system mocks for all tests
vi.mock('fs/promises', () => createFsPromisesMock());
vi.mock('fs', () => createFsMock());

// Don't globally mock mcpLoader - it breaks tests that actually test the loader

// Global test utilities
globalThis.testUtils = {
  // Helper to wait for a specified amount of time
  delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Helper to create a promise that resolves after a delay
  delayedResolve: <T>(value: T, ms = 100) =>
    new Promise<T>((resolve) => setTimeout(() => resolve(value), ms)),

  // Helper to create a promise that rejects after a delay
  delayedReject: (error: unknown, ms = 100) =>
    new Promise((_, reject) => setTimeout(() => reject(error), ms)),
};

// Mock environment variables for tests
process.env.NODE_ENV = 'test';

// Ensure we don't accidentally use real API keys in tests
if (!process.env.CI) {
  process.env.OPENAI_API_KEY = 'test-key-mock';
}

// Global beforeEach for all tests (equivalent to Jest's global beforeEach)
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

// Global afterEach for all tests (equivalent to Jest's global afterEach)
afterEach(() => {
  // Reset modules after each test to ensure clean state
  vi.resetModules();
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  process.stderr.write(
    `Unhandled Rejection at: ${promise}, reason: ${reason}\\n`
  );
  // Don't exit in tests, but log the error
});

// Extend Vitest matchers with custom ones (equivalent to Jest's expect.extend)
expect.extend({
  // Custom matcher to check if a string contains tool call format
  toContainToolCall(received: string, toolName: string) {
    const pass = received.includes(`[tool-call] ${toolName}`);

    if (pass) {
      return {
        message: () =>
          `expected "${received}" not to contain tool call for "${toolName}"`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected "${received}" to contain tool call for "${toolName}"`,
        pass: false,
      };
    }
  },

  // Custom matcher to check if a string contains assistant step format
  toContainAssistantStep(received: string, text: string) {
    const pass = received.includes(`[assistant-step] ${text}`);

    if (pass) {
      return {
        message: () =>
          `expected "${received}" not to contain assistant step "${text}"`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected "${received}" to contain assistant step "${text}"`,
        pass: false,
      };
    }
  },

  // Custom matcher to check if a string contains final assistant response
  toContainAssistantResponse(received: string, text: string) {
    const pass = received.includes(`[assistant] ${text}`);

    if (pass) {
      return {
        message: () =>
          `expected "${received}" not to contain assistant response "${text}"`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected "${received}" to contain assistant response "${text}"`,
        pass: false,
      };
    }
  },

  // Custom matcher to check if execution time is reasonable
  toHaveReasonableExecutionTime(received: number, maxMs = 5000) {
    const pass = received <= maxMs;

    if (pass) {
      return {
        message: () =>
          `expected execution time ${received}ms to be greater than ${maxMs}ms`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected execution time ${received}ms to be less than or equal to ${maxMs}ms`,
        pass: false,
      };
    }
  },
});

// Declare global types for test utilities
declare global {
  var testUtils: {
    delay: (ms: number) => Promise<void>;
    delayedResolve: <T>(value: T, ms?: number) => Promise<T>;
    delayedReject: (error: unknown, ms?: number) => Promise<never>;
  };
}
