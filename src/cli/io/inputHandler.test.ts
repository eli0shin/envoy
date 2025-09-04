/**
 * Tests for inputHandler.ts module
 * Tests stdin reading and message validation functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readStdin, validateMessage } from './inputHandler.js';

// Mock process.stdin
const mockStdin = {
  setEncoding: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
};

Object.defineProperty(process, 'stdin', {
  value: mockStdin,
  writable: true,
});

describe('inputHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStdin.setEncoding.mockClear();
    mockStdin.on.mockClear();
    mockStdin.removeAllListeners.mockClear();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('readStdin', () => {
    it('should read and return trimmed input from stdin', async () => {
      const inputData = '  Hello from stdin  ';

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          // Simulate data event
          setTimeout(() => callback(inputData), 10);
        } else if (event === 'end') {
          // Simulate end event
          setTimeout(() => callback(), 20);
        }
      });

      const promise = readStdin();
      vi.advanceTimersByTime(30);

      const result = await promise;
      expect(result).toBe('Hello from stdin');
      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8');
    });

    it('should accumulate multiple data chunks', async () => {
      const chunks = ['Hello ', 'from ', 'stdin'];

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          // Simulate data coming in chunks
          setTimeout(() => callback(chunks[0]), 10);
          setTimeout(() => callback(chunks[1]), 20);
          setTimeout(() => callback(chunks[2]), 30);
        } else if (event === 'end') {
          setTimeout(() => callback(), 40);
        }
      });

      const promise = readStdin();
      vi.advanceTimersByTime(50);

      const result = await promise;
      expect(result).toBe('Hello from stdin');
    });

    it('should handle empty input with timeout', async () => {
      mockStdin.on.mockImplementation((event, _callback) => {
        if (event === 'data') {
          // No data events triggered
        } else if (event === 'end') {
          // No end event triggered
        }
      });

      const promise = readStdin();

      // Advance past the timeout
      vi.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow('No input provided via stdin');
    });

    it('should clear timeout when data is received', async () => {
      const inputData = 'Test input';

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          // Simulate data event that should clear timeout
          setTimeout(() => {
            callback(inputData);
          }, 500);
        } else if (event === 'end') {
          setTimeout(() => callback(), 600);
        }
      });

      const promise = readStdin();

      // Advance past when data arrives but before original timeout
      vi.advanceTimersByTime(700);

      const result = await promise;
      expect(result).toBe('Test input');
    });

    it('should handle stdin errors', async () => {
      const error = new Error('Stdin read error');

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(error), 10);
        }
      });

      const promise = readStdin();
      vi.advanceTimersByTime(20);

      await expect(promise).rejects.toThrow('Stdin read error');
    });

    it('should handle whitespace-only input', async () => {
      const inputData = '   \n\t   ';

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(inputData), 10);
        } else if (event === 'end') {
          setTimeout(() => callback(), 20);
        }
      });

      const promise = readStdin();
      vi.advanceTimersByTime(30);

      const result = await promise;
      expect(result).toBe('');
    });

    it('should handle large input', async () => {
      const largeInput = 'A'.repeat(10000);

      mockStdin.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(largeInput), 10);
        } else if (event === 'end') {
          setTimeout(() => callback(), 20);
        }
      });

      const promise = readStdin();
      vi.advanceTimersByTime(30);

      const result = await promise;
      expect(result).toBe(largeInput);
    });
  });

  describe('validateMessage', () => {
    it('should return true for non-empty message', () => {
      expect(validateMessage('Hello world')).toBe(true);
      expect(validateMessage('Test message')).toBe(true);
      expect(validateMessage('A')).toBe(true);
    });

    it('should return false for empty message', () => {
      expect(validateMessage('')).toBe(false);
    });

    it('should return false for undefined message', () => {
      expect(validateMessage(undefined)).toBe(false);
    });

    it('should return false for null message', () => {
      expect(validateMessage(null as unknown as string)).toBe(false);
    });

    it('should return false for whitespace-only message', () => {
      expect(validateMessage('   ')).toBe(false);
      expect(validateMessage('\n\t ')).toBe(false);
      expect(validateMessage('\r\n')).toBe(false);
    });

    it('should return true for message with meaningful content and whitespace', () => {
      expect(validateMessage('  Hello world  ')).toBe(true);
      expect(validateMessage('\n\tTest message\n')).toBe(true);
    });

    it('should handle special characters', () => {
      expect(validateMessage('Hello 世界')).toBe(true);
      expect(validateMessage('🚀 Test message')).toBe(true);
      expect(validateMessage('Test@example.com')).toBe(true);
    });

    it('should handle numbers and symbols', () => {
      expect(validateMessage('123')).toBe(true);
      expect(validateMessage('$100')).toBe(true);
      expect(validateMessage('2 + 2 = 4')).toBe(true);
    });
  });
});
