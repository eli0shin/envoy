/**
 * Tests for hook executor module
 */

import { describe, it, expect } from 'vitest';
import { executeHookCommand } from './executor.js';
import type { SessionStartInput, PostToolUseInput } from '../config/types.js';

describe('executeHookCommand', () => {
  const testCwd = process.cwd();

  describe('command parsing', () => {
    it('should parse simple command strings', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
      };

      const result = await executeHookCommand('node --version', input);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('v');
    });

    it('should parse commands with quoted paths', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
      };

      // Echo command with quoted string containing spaces
      const result = await executeHookCommand(
        'node -e "console.log(\'hello world\')"',
        input
      );

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello world');
    });

    it('should parse commands with quoted arguments', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
      };

      const result = await executeHookCommand(
        'node -e "console.log(process.argv[1])" "value with spaces"',
        input
      );

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('value with spaces');
    });

    it('should handle empty command string', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
      };

      const result = await executeHookCommand('', input);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBe('Empty command string');
    });
  });

  describe('stdin input', () => {
    it('should pass JSON input via stdin for SessionStart', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session-123',
        transcript_path: '/path/to/transcript.jsonl',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
        permission_mode: 'auto',
      };

      // Node script that reads stdin and outputs it
      const result = await executeHookCommand(
        "node -e \"let data=''; process.stdin.on('data', d => data+=d); process.stdin.on('end', () => console.log(data));\"",
        input
      );

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      const outputJson = JSON.parse(result.stdout.trim());
      expect(outputJson).toEqual(input);
    });

    it('should pass JSON input via stdin for PostToolUse', async () => {
      const input: PostToolUseInput = {
        session_id: 'test-session-456',
        transcript_path: '/path/to/transcript.jsonl',
        cwd: testCwd,
        hook_event_name: 'PostToolUse',
        tool_name: 'filesystem_write_file',
        tool_input: { path: '/test/file.ts', content: 'code' },
        tool_response: { success: true },
      };

      // Node script that reads stdin and outputs it
      const result = await executeHookCommand(
        "node -e \"let data=''; process.stdin.on('data', d => data+=d); process.stdin.on('end', () => console.log(data));\"",
        input
      );

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      const outputJson = JSON.parse(result.stdout.trim());
      expect(outputJson).toEqual(input);
    });
  });

  describe('output capture', () => {
    it('should capture raw stdout', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
      };

      const result = await executeHookCommand(
        'node -e "console.log(\'test output\')"',
        input
      );

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('test output');
    });

    it('should capture raw stderr', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
      };

      const result = await executeHookCommand(
        'node -e "console.error(\'error output\')"',
        input
      );

      expect(result.success).toBe(true);
      expect(result.stderr.trim()).toBe('error output');
    });

    it('should capture multiline output', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
      };

      const result = await executeHookCommand(
        "node -e \"console.log('line 1'); console.log('line 2'); console.log('line 3');\"",
        input
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('line 1\nline 2\nline 3\n');
    });
  });

  describe('error handling', () => {
    it('should handle command not found', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
      };

      const result = await executeHookCommand(
        'nonexistent-command-12345',
        input
      );

      expect(result.success).toBe(false);
      // Shell returns 127 for command not found
      expect(result.exitCode).toBe(127);
    });

    it('should handle non-zero exit codes', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
      };

      const result = await executeHookCommand(
        'node -e "process.exit(42)"',
        input
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(42);
    });

    it('should wait for command completion without timeout', async () => {
      const input: SessionStartInput = {
        session_id: 'test-session',
        cwd: testCwd,
        hook_event_name: 'SessionStart',
        source: 'startup',
      };

      // Command that takes a moment to complete
      const result = await executeHookCommand(
        'node -e "setTimeout(() => console.log(\'done\'), 100)"',
        input
      );

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('done');
    });
  });
});
