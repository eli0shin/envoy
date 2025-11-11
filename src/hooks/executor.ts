/**
 * Hook executor module
 * Spawns external commands and passes JSON input via stdin
 */

import { $ } from 'bun';
import type { SessionStartInput, PostToolUseInput } from '../config/types.js';

/**
 * Result of hook execution
 */
export type HookExecutionResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
};

/**
 * Execute a hook command with JSON input via stdin
 *
 * @param commandString - Command string to execute
 * @param input - JSON input to pass via stdin
 * @returns Hook execution result with stdout, stderr, and exit code
 */
export async function executeHookCommand(
  commandString: string,
  input: SessionStartInput | PostToolUseInput
): Promise<HookExecutionResult> {
  try {
    if (!commandString.trim()) {
      return {
        success: false,
        stdout: '',
        stderr: '',
        exitCode: 1,
        error: 'Empty command string',
      };
    }

    const stdinData = JSON.stringify(input);
    const stdinResponse = new Response(stdinData);

    const proc = await $`${{ raw: commandString }} < ${stdinResponse}`
      .cwd(input.cwd)
      .env({ ...process.env, CLAUDE_PLUGIN_ROOT: input.cwd })
      .quiet()
      .nothrow();

    return {
      success: proc.exitCode === 0,
      stdout: proc.stdout.toString(),
      stderr: proc.stderr.toString(),
      exitCode: proc.exitCode,
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      exitCode: 1,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
