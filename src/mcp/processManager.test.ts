/**
 * Unit tests for ProcessManager
 * Tests process registration, cleanup, and edge cases
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { ProcessManager } from './processManager.js';
import { logger } from '../logger.js';

// Mock ChildProcess type for testing - cast to ChildProcess to bypass typing issues
function createMockProcess(
  overrides: Record<string, unknown> = {}
): ChildProcess {
  return {
    pid: 12345,
    killed: false,
    exitCode: null,
    stdin: null,
    stdout: null,
    stderr: null,
    stdio: [null, null, null, null, null],
    kill: vi.fn(),
    on: vi.fn(),
    ...overrides,
  } as unknown as ChildProcess;
}

// Mock logger to avoid console output during tests
vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProcessManager', () => {
  let processManager: ProcessManager;

  beforeEach(() => {
    // Get a fresh instance for each test
    processManager = ProcessManager.getInstance();
    // Reset the state to ensure test isolation
    processManager.reset();
  });

  afterEach(() => {
    // Clean up any processes created during tests
    processManager.cleanupAll();
    // Reset state for next test
    processManager.reset();
  });

  describe('singleton behavior', () => {
    test('should return the same instance', () => {
      const instance1 = ProcessManager.getInstance();
      const instance2 = ProcessManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('process registration', () => {
    test('should register and track processes', () => {
      const mockProcess = spawn('sleep', ['10']);

      processManager.registerProcess('test-server', mockProcess);

      expect(processManager.getActiveProcessCount()).toBe(1);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registered MCP server process: test-server')
      );

      // Clean up
      mockProcess.kill();
    });

    test('should handle multiple process registrations', () => {
      const process1 = spawn('sleep', ['10']);
      const process2 = spawn('sleep', ['10']);

      processManager.registerProcess('server-1', process1);
      processManager.registerProcess('server-2', process2);

      expect(processManager.getActiveProcessCount()).toBe(2);

      // Clean up
      process1.kill();
      process2.kill();
    });
  });

  describe('individual process cleanup', () => {
    test('should cleanup individual processes', async () => {
      const mockProcess = spawn('sleep', ['10']);
      processManager.registerProcess('test-server', mockProcess);

      expect(processManager.getActiveProcessCount()).toBe(1);

      processManager.cleanupProcess('test-server');

      expect(processManager.getActiveProcessCount()).toBe(0);

      // Wait a bit for process to be terminated
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockProcess.killed).toBe(true);
    });

    test('should handle cleanup of non-existent processes', () => {
      expect(() => processManager.cleanupProcess('non-existent')).not.toThrow();
      expect(processManager.getActiveProcessCount()).toBe(0);
    });
  });

  describe('bulk cleanup', () => {
    test('should cleanup all processes', async () => {
      const process1 = spawn('sleep', ['10']);
      const process2 = spawn('sleep', ['10']);

      processManager.registerProcess('server-1', process1);
      processManager.registerProcess('server-2', process2);

      expect(processManager.getActiveProcessCount()).toBe(2);

      processManager.cleanupAll();

      expect(logger.info).toHaveBeenCalledWith(
        'Cleaning up 2 MCP server processes'
      );

      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    test('should handle cleanup when no processes exist', () => {
      expect(() => processManager.cleanupAll()).not.toThrow();
      expect(logger.info).toHaveBeenCalledWith(
        'Cleaning up 0 MCP server processes'
      );
    });

    test('should prevent duplicate cleanup calls', () => {
      const process1 = spawn('sleep', ['10']);
      processManager.registerProcess('server-1', process1);

      // First cleanup call
      processManager.cleanupAll();

      // Clear the mock to count only subsequent calls
      vi.clearAllMocks();

      // Second cleanup call should be ignored (no additional logging)
      processManager.cleanupAll();

      // Should not log anything for the second call
      expect(logger.info).not.toHaveBeenCalled();

      process1.kill();
    });
  });

  describe('error handling', () => {
    test('should handle already dead processes', () => {
      // Create a mock process that throws ESRCH when killed
      const deadProcess = createMockProcess({
        kill: vi.fn().mockImplementation(() => {
          const error = new Error('kill ESRCH');
          error.message = 'kill ESRCH';
          throw error;
        }),
      });

      processManager.registerProcess('dead-server', deadProcess);

      // Should not throw when trying to clean up dead process
      expect(() => processManager.cleanupProcess('dead-server')).not.toThrow();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('dead-server already terminated')
      );
    });

    test('should handle permission errors gracefully', () => {
      // Create a mock process that will throw EPERM
      const mockProcess = createMockProcess({
        kill: vi.fn().mockImplementation(() => {
          const error = new Error('kill EPERM');
          error.message = 'kill EPERM';
          throw error;
        }),
      });

      processManager.registerProcess('perm-test-server', mockProcess);

      expect(() =>
        processManager.cleanupProcess('perm-test-server')
      ).not.toThrow();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Permission denied when terminating MCP server perm-test-server'
        )
      );
    });

    test('should handle ESRCH errors gracefully', () => {
      // Create a mock process that will throw ESRCH
      const mockProcess = createMockProcess({
        kill: vi.fn().mockImplementation(() => {
          const error = new Error('kill ESRCH');
          error.message = 'kill ESRCH';
          throw error;
        }),
      });

      processManager.registerProcess('esrch-test-server', mockProcess);

      expect(() =>
        processManager.cleanupProcess('esrch-test-server')
      ).not.toThrow();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('esrch-test-server already terminated')
      );
    });
  });

  describe('signal handling', () => {
    test('should send SIGTERM first', () => {
      const mockProcess = createMockProcess();

      processManager.registerProcess('signal-test-server', mockProcess);
      processManager.cleanupProcess('signal-test-server');

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Sent SIGTERM to MCP server signal-test-server')
      );
    });

    test('should not send signals to processes without PID', () => {
      const mockProcess = createMockProcess({ pid: undefined });

      processManager.registerProcess('no-pid-server', mockProcess);
      processManager.cleanupProcess('no-pid-server');

      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    test('should not send signals to already killed processes', () => {
      const mockProcess = createMockProcess({ killed: true });

      processManager.registerProcess('killed-server', mockProcess);
      processManager.cleanupProcess('killed-server');

      expect(mockProcess.kill).not.toHaveBeenCalled();
    });
  });
});
