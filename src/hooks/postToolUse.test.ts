/**
 * Tests for PostToolUse hooks module
 */

import { describe, it, expect } from 'vitest';
import { executePostToolUseHooks } from './postToolUse.js';
import { createMockRuntimeConfiguration } from '../test/helpers/createMocks.js';
import type { RuntimeConfiguration } from '../config/types.js';

describe('executePostToolUseHooks', () => {
  const baseConfig = createMockRuntimeConfiguration();

  describe('regex matching', () => {
    it('should match hooks by regex pattern against tool names', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: 'filesystem_write_file',
              command: 'node -e "console.log(\'matched\')"',
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'filesystem_write_file',
        {},
        {}
      );

      expect(result.observationalOutput).toContain('matched');
    });

    it('should support regex patterns in matcher', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: 'filesystem_(write|edit)_file',
              command: 'node -e "console.log(\'matched\')"',
            },
          ],
        },
      };

      const result1 = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'filesystem_write_file',
        {},
        {}
      );

      expect(result1.observationalOutput).toContain('matched');

      const result2 = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'filesystem_edit_file',
        {},
        {}
      );

      expect(result2.observationalOutput).toContain('matched');
    });

    it('should not match tools that do not match the pattern', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: 'filesystem_write_file',
              command: 'node -e "console.log(\'matched\')"',
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'other_tool',
        {},
        {}
      );

      expect(result.observationalOutput).toHaveLength(0);
    });
  });

  describe('sequential execution', () => {
    it('should execute multiple hooks sequentially in config order', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command: 'node -e "console.log(\'hook 1\')"',
            },
            {
              matcher: '.*',
              command: 'node -e "console.log(\'hook 2\')"',
            },
            {
              matcher: '.*',
              command: 'node -e "console.log(\'hook 3\')"',
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      expect(result.observationalOutput).toHaveLength(3);
      expect(result.observationalOutput[0]).toContain('hook 1');
      expect(result.observationalOutput[1]).toContain('hook 2');
      expect(result.observationalOutput[2]).toContain('hook 3');
    });
  });

  describe('JSON parsing', () => {
    it('should parse JSON responses from stdout', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command:
                "node -e \"console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'test context' } }))\"",
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      expect(result.additionalContexts).toHaveLength(1);
      expect(result.additionalContexts[0]).toBe('test context');
    });

    it('should treat non-JSON output as plain text', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command: 'node -e "console.log(\'plain text output\')"',
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      expect(result.observationalOutput).toHaveLength(1);
      expect(result.observationalOutput[0]).toBe('plain text output');
    });
  });

  describe('additionalContext collection', () => {
    it('should collect additionalContext from hookSpecificOutput', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command:
                "node -e \"console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'context 1' } }))\"",
            },
            {
              matcher: '.*',
              command:
                "node -e \"console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'context 2' } }))\"",
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      expect(result.additionalContexts).toHaveLength(2);
      expect(result.additionalContexts[0]).toBe('context 1');
      expect(result.additionalContexts[1]).toBe('context 2');
    });
  });

  describe('systemMessage collection', () => {
    it('should collect systemMessage values', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command:
                'node -e "console.log(JSON.stringify({ systemMessage: \'Warning 1\' }))"',
            },
            {
              matcher: '.*',
              command:
                'node -e "console.log(JSON.stringify({ systemMessage: \'Warning 2\' }))"',
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      expect(result.systemMessages).toHaveLength(2);
      expect(result.systemMessages[0]).toBe('Warning 1');
      expect(result.systemMessages[1]).toBe('Warning 2');
    });
  });

  describe('continue: false handling', () => {
    it('should detect continue: false and stop processing', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command: 'node -e "console.log(\'hook 1\')"',
            },
            {
              matcher: '.*',
              command:
                'node -e "console.log(JSON.stringify({ continue: false, stopReason: \'Test stop\' }))"',
            },
            {
              matcher: '.*',
              command: 'node -e "console.log(\'hook 3\')"',
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      expect(result.shouldContinue).toBe(false);
      expect(result.stopReason).toBe('Test stop');
      // Should only have output from first two hooks, not third
      expect(result.observationalOutput).toHaveLength(1);
      expect(result.observationalOutput[0]).toContain('hook 1');
    });

    it('should use default stopReason if not provided', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command:
                'node -e "console.log(JSON.stringify({ continue: false }))"',
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      expect(result.shouldContinue).toBe(false);
      expect(result.stopReason).toBe('Stopped by hook');
    });
  });

  describe('suppressOutput flag', () => {
    it('should respect suppressOutput flag', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command:
                "node -e \"console.log(JSON.stringify({ suppressOutput: true, hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'context' } }))\"",
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      // Should have additionalContext but no observational output
      expect(result.additionalContexts).toHaveLength(1);
      expect(result.observationalOutput).toHaveLength(0);
    });

    it('should include output when suppressOutput is false', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command:
                "node -e \"console.log(JSON.stringify({ suppressOutput: false, hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'context' } }))\"",
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      expect(result.additionalContexts).toHaveLength(1);
      expect(result.observationalOutput).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle hook failures gracefully and continue', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command: 'node -e "console.log(\'hook 1\')"',
            },
            {
              matcher: '.*',
              command: 'node -e "process.exit(1)"', // Failing hook
            },
            {
              matcher: '.*',
              command: 'node -e "console.log(\'hook 3\')"',
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      // Should have output from hooks 1 and 3
      expect(result.observationalOutput).toHaveLength(2);
      expect(result.observationalOutput[0]).toContain('hook 1');
      expect(result.observationalOutput[1]).toContain('hook 3');
    });

    it('should handle command not found errors', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command: 'nonexistent-command-xyz',
            },
            {
              matcher: '.*',
              command: 'node -e "console.log(\'after error\')"',
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      // Should continue and execute second hook
      expect(result.observationalOutput).toHaveLength(1);
      expect(result.observationalOutput[0]).toContain('after error');
    });
  });

  describe('input data', () => {
    it('should pass tool_name, tool_input, and tool_response to hooks', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: '.*',
              command:
                "node -e \"let data=''; process.stdin.on('data', d => data+=d); process.stdin.on('end', () => { const input = JSON.parse(data); console.log(input.tool_name, JSON.stringify(input.tool_input), JSON.stringify(input.tool_response)); });\"",
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        { arg: 'value' },
        { result: 'success' }
      );

      expect(result.observationalOutput).toHaveLength(1);
      expect(result.observationalOutput[0]).toContain('test_tool');
      expect(result.observationalOutput[0]).toContain('{"arg":"value"}');
      expect(result.observationalOutput[0]).toContain('{"result":"success"}');
    });
  });

  describe('empty hooks', () => {
    it('should return default result when no hooks configured', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: undefined,
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      expect(result.shouldContinue).toBe(true);
      expect(result.additionalContexts).toHaveLength(0);
      expect(result.systemMessages).toHaveLength(0);
      expect(result.observationalOutput).toHaveLength(0);
    });

    it('should return default result when no hooks match', async () => {
      const config: RuntimeConfiguration = {
        ...baseConfig,
        hooks: {
          PostToolUse: [
            {
              matcher: 'other_tool',
              command: 'node -e "console.log(\'matched\')"',
            },
          ],
        },
      };

      const result = await executePostToolUseHooks(
        config,
        'test-session',
        undefined,
        'test_tool',
        {},
        {}
      );

      expect(result.shouldContinue).toBe(true);
      expect(result.additionalContexts).toHaveLength(0);
      expect(result.systemMessages).toHaveLength(0);
      expect(result.observationalOutput).toHaveLength(0);
    });
  });
});
