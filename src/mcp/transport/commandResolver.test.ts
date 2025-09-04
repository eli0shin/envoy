/**
 * Tests for Command Resolver Module
 * Following strict TDD - tests written first before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { resolveCommand } from './commandResolver.js';
import { createMockChildProcess } from '../../test/helpers/createMocks.js';

// Mock child_process spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Type assertion helper for mocks
function createMockChild(mockChildOverrides: Record<string, unknown> = {}) {
  return createMockChildProcess(mockChildOverrides) as unknown as ReturnType<
    typeof spawn
  >;
}

describe('Command Resolver', () => {
  const mockSpawn = vi.mocked(spawn);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveCommand', () => {
    it('should return absolute paths as-is', async () => {
      const absolutePath = '/usr/bin/node';
      const result = await resolveCommand(absolutePath);
      expect(result).toBe(absolutePath);
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should resolve command using shell command -v successfully', async () => {
      const command = 'node';
      const resolvedPath = '/usr/local/bin/node';

      // Mock successful command -v execution
      const mockChild: Record<string, unknown> = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from(resolvedPath + '\n'));
            }
          }),
        },
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success exit code
          }
        }),
      };

      mockSpawn.mockReturnValue(createMockChild(mockChild));

      const result = await resolveCommand(command);

      expect(result).toBe(resolvedPath);
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String), // shell path
        ['-c', `command -v "${command}"`],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: process.env,
        }
      );
    });

    it('should fallback to which command when command -v fails', async () => {
      const command = 'python';
      const resolvedPath = '/usr/bin/python';

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // First call: command -v fails
          return createMockChild({
            stdout: { on: vi.fn() },
            stderr: { on: vi.fn() },
            on: vi.fn((event, callback) => {
              if (event === 'close') {
                callback(1); // Failure exit code
              }
            }),
          });
        } else {
          // Second call: which succeeds
          return createMockChild({
            stdout: {
              on: vi.fn((event, callback) => {
                if (event === 'data') {
                  callback(Buffer.from(resolvedPath + '\n'));
                }
              }),
            },
            on: vi.fn((event, callback) => {
              if (event === 'close') {
                callback(0); // Success exit code
              }
              if (event === 'error') {
                // No error for this test
              }
            }),
          });
        }
      });

      const result = await resolveCommand(command);

      expect(result).toBe(resolvedPath);
      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(mockSpawn).toHaveBeenNthCalledWith(2, 'which', [command], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    });

    it('should return original command when both command -v and which fail', async () => {
      const command = 'nonexistent';

      mockSpawn.mockImplementation(() => {
        return createMockChild({
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              callback(1); // Failure exit code for both calls
            }
            if (event === 'error') {
              // No error for this test
            }
          }),
        });
      });

      const result = await resolveCommand(command);

      expect(result).toBe(command);
      expect(mockSpawn).toHaveBeenCalledTimes(2);
    });

    it('should handle command -v process error gracefully', async () => {
      const command = 'test';

      const mockChild: Record<string, unknown> = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Process error'));
          }
        }),
      };

      mockSpawn.mockReturnValue(createMockChild(mockChild));

      const result = await resolveCommand(command);

      expect(result).toBe(command);
    });

    it('should handle which command error gracefully', async () => {
      const command = 'test';

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // First call: command -v fails
          return createMockChild({
            stdout: { on: vi.fn() },
            stderr: { on: vi.fn() },
            on: vi.fn((event, callback) => {
              if (event === 'close') {
                callback(1); // Failure exit code
              }
            }),
          });
        } else {
          // Second call: which has error
          return createMockChild({
            stdout: { on: vi.fn() },
            on: vi.fn((event, callback) => {
              if (event === 'error') {
                callback(new Error('Which error'));
              }
            }),
          });
        }
      });

      const result = await resolveCommand(command);

      expect(result).toBe(command);
    });

    it('should use SHELL environment variable or fallback to /bin/bash', async () => {
      const command = 'echo';
      const customShell = '/bin/zsh';

      // Set custom shell
      const originalShell = process.env.SHELL;
      process.env.SHELL = customShell;

      const mockChild: Record<string, unknown> = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('/bin/echo\n'));
            }
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(createMockChild(mockChild));

      await resolveCommand(command);

      expect(mockSpawn).toHaveBeenCalledWith(
        customShell,
        ['-c', `command -v "${command}"`],
        expect.any(Object)
      );

      // Restore original shell
      if (originalShell) {
        process.env.SHELL = originalShell;
      } else {
        delete process.env.SHELL;
      }
    });

    it('should handle empty stdout from command resolution', async () => {
      const command = 'test';

      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;

        if (callCount === 1) {
          // First call: command -v returns empty stdout
          return createMockChild({
            stdout: {
              on: vi.fn((event, callback) => {
                if (event === 'data') {
                  callback(Buffer.from('')); // Empty output
                }
              }),
            },
            stderr: { on: vi.fn() },
            on: vi.fn((event, callback) => {
              if (event === 'close') {
                callback(0); // Success but empty output
              }
            }),
          });
        } else {
          // Second call: which also returns empty
          return createMockChild({
            stdout: {
              on: vi.fn((event, callback) => {
                if (event === 'data') {
                  callback(Buffer.from(''));
                }
              }),
            },
            on: vi.fn((event, callback) => {
              if (event === 'close') {
                callback(0);
              }
              if (event === 'error') {
                // No error
              }
            }),
          });
        }
      });

      const result = await resolveCommand(command);

      expect(result).toBe(command); // Should return original command
    });
  });
});
