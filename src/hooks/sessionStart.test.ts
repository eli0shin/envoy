/**
 * Tests for SessionStart hooks module
 */

import { describe, it, expect } from 'vitest';
import { executeSessionStartHooks } from './sessionStart.js';
import { createMockRuntimeConfiguration } from '../test/helpers/createMocks.js';
import type { RuntimeConfiguration } from '../config/types.js';

describe('executeSessionStartHooks', () => {
  const baseConfig = createMockRuntimeConfiguration();

  describe('hook filtering', () => {
    it('should execute hooks with no matcher for all sources', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              command: 'node -e "console.log(\'startup hook\')"',
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'startup'
      );

      expect(result.trim()).toBe('startup hook');

      const result2 = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'resume'
      );

      expect(result2.trim()).toBe('startup hook');

      const result3 = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'clear'
      );

      expect(result3.trim()).toBe('startup hook');
    });

    it('should filter hooks by matcher - startup', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              matcher: 'startup',
              command: 'node -e "console.log(\'startup hook\')"',
            },
            {
              matcher: 'resume',
              command: 'node -e "console.log(\'resume hook\')"',
            },
            {
              matcher: 'clear',
              command: 'node -e "console.log(\'clear hook\')"',
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'startup'
      );

      expect(result.trim()).toBe('startup hook');
    });

    it('should filter hooks by matcher - resume', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              matcher: 'startup',
              command: 'node -e "console.log(\'startup hook\')"',
            },
            {
              matcher: 'resume',
              command: 'node -e "console.log(\'resume hook\')"',
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'resume'
      );

      expect(result.trim()).toBe('resume hook');
    });

    it('should filter hooks by matcher - clear', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              matcher: 'startup',
              command: 'node -e "console.log(\'startup hook\')"',
            },
            {
              matcher: 'clear',
              command: 'node -e "console.log(\'clear hook\')"',
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'clear'
      );

      expect(result.trim()).toBe('clear hook');
    });

    it('should return empty string when no hooks match', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              matcher: 'startup',
              command: 'node -e "console.log(\'startup hook\')"',
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'resume'
      );

      expect(result).toBe('');
    });

    it('should return empty string when no hooks configured', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: undefined,
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'startup'
      );

      expect(result).toBe('');
    });
  });

  describe('sequential execution', () => {
    it('should execute multiple hooks sequentially in config order', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              command: 'node -e "console.log(\'hook 1\')"',
            },
            {
              command: 'node -e "console.log(\'hook 2\')"',
            },
            {
              command: 'node -e "console.log(\'hook 3\')"',
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'startup'
      );

      expect(result).toBe('hook 1\n\nhook 2\n\nhook 3\n');
    });
  });

  describe('output collection', () => {
    it('should combine stdout from hooks', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              command: 'node -e "console.log(\'output 1\')"',
            },
            {
              command: 'node -e "console.log(\'output 2\')"',
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'startup'
      );

      expect(result).toContain('output 1');
      expect(result).toContain('output 2');
    });

    it('should handle hooks with no output', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              command: 'node -e ""',
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'startup'
      );

      expect(result).toBe('');
    });
  });

  describe('error handling', () => {
    it('should handle hook failures gracefully and continue', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              command: 'node -e "console.log(\'hook 1\')"',
            },
            {
              command: 'node -e "process.exit(1)"', // Failing hook
            },
            {
              command: 'node -e "console.log(\'hook 3\')"',
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'startup'
      );

      // Should include output from hooks 1 and 3, but not 2
      expect(result).toContain('hook 1');
      expect(result).toContain('hook 3');
    });

    it('should handle command not found errors', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              command: 'nonexistent-command-xyz',
            },
            {
              command: 'node -e "console.log(\'after error\')"',
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'startup'
      );

      // Should continue and execute second hook
      expect(result.trim()).toBe('after error');
    });
  });

  describe('input data', () => {
    it('should pass session_id and source to hooks', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              command:
                "node -e \"let data=''; process.stdin.on('data', d => data+=d); process.stdin.on('end', () => { const input = JSON.parse(data); console.log(input.session_id, input.source); });\"",
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'my-session-123',
        undefined,
        'startup'
      );

      expect(result.trim()).toBe('my-session-123 startup');
    });

    it('should pass transcript_path when provided', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              command:
                "node -e \"let data=''; process.stdin.on('data', d => data+=d); process.stdin.on('end', () => { const input = JSON.parse(data); console.log(input.transcript_path || 'no-path'); });\"",
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        '/path/to/transcript.jsonl',
        'startup'
      );

      expect(result.trim()).toBe('/path/to/transcript.jsonl');
    });

    it('should omit transcript_path when not provided', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          SessionStart: [
            {
              command:
                "node -e \"let data=''; process.stdin.on('data', d => data+=d); process.stdin.on('end', () => { const input = JSON.parse(data); console.log(input.transcript_path || 'no-path'); });\"",
            },
          ],
        },
      };

      const result = await executeSessionStartHooks(
        config,
        'test-session',
        undefined,
        'startup'
      );

      expect(result.trim()).toBe('no-path');
    });
  });
});
