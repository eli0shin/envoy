/**
 * PostToolUse hooks module
 * Executes hooks after tool use and processes their output
 */

import { logger } from '../logger.js';
import { executeHookCommand } from './executor.js';
import type {
  RuntimeConfiguration,
  PostToolUseInput,
  PostToolUseOutput,
} from '../config/types.js';

/**
 * Maps Claude Code tool names to envoy tool names
 * This allows hooks to use Claude Code tool names in matchers for cross-compatibility
 */
const CLAUDE_CODE_TOOL_ALIASES: Record<string, string[]> = {
  filesystem_write_file: ['Write'],
  filesystem_edit_file: ['Edit'],
  filesystem_read_text_file: ['Read'],
  filesystem_read_media_file: ['Read'],
  filesystem_read_multiple_files: ['Read'],
  filesystem_list_directory: ['Glob'],
  filesystem_list_directory_with_sizes: ['Glob'],
  filesystem_search_files: ['Grep'],
  shell_run_command: ['Bash'],
  'brave-search_brave_web_search': ['WebSearch'],
  todo_write: ['TodoWrite'],
  spawn_agent: ['Task'],
};

/**
 * Combined result from all PostToolUse hooks
 */
export type CombinedPostToolUseResult = {
  shouldContinue: boolean; // false if any hook said continue: false
  stopReason?: string; // from first hook that stopped
  additionalContexts: string[]; // all hook output to send to Claude
};

/**
 * Normalize tool input to ensure both 'path' and 'file_path' are available
 * AI SDK filesystem tools use 'path' but Claude Code expects 'file_path'
 * This ensures hooks work regardless of which format they expect
 */
function normalizeToolInput(toolInput: unknown): unknown {
  if (!toolInput || typeof toolInput !== 'object') {
    return toolInput;
  }

  const input = toolInput as Record<string, unknown>;
  const hasPath = 'path' in input;
  const hasFilePath = 'file_path' in input;

  // If we have one but not the other, add the missing one
  if (hasPath && !hasFilePath) {
    return {
      ...input,
      file_path: input.path,
    };
  }

  if (hasFilePath && !hasPath) {
    return {
      ...input,
      path: input.file_path,
    };
  }

  return toolInput;
}

/**
 * Execute all PostToolUse hooks that match the given tool name
 *
 * @param config - Runtime configuration containing hooks
 * @param sessionId - Current session ID
 * @param conversationPath - Absolute path to conversation JSONL file (optional)
 * @param toolName - Name of the tool that was just used
 * @param toolInput - Input parameters passed to the tool
 * @param toolResponse - Response returned by the tool
 * @returns Combined result from all hooks
 */
export async function executePostToolUseHooks(
  config: RuntimeConfiguration,
  sessionId: string,
  conversationPath: string | undefined,
  toolName: string,
  toolInput: unknown,
  toolResponse: unknown
): Promise<CombinedPostToolUseResult> {
  const hooks = config.hooks?.PostToolUse;

  if (!hooks || hooks.length === 0) {
    return {
      shouldContinue: true,
      additionalContexts: [],
    };
  }

  // Find hooks with matchers that match the tool name (regex test)
  // Test against both the actual tool name and its Claude Code aliases
  const matchingHooks = hooks.filter((hook) => {
    try {
      const regex = new RegExp(hook.matcher);

      // Test against actual tool name
      if (regex.test(toolName)) {
        return true;
      }

      // Test against Claude Code aliases
      const aliases = CLAUDE_CODE_TOOL_ALIASES[toolName] || [];
      return aliases.some((alias) => regex.test(alias));
    } catch {
      // Invalid regex (should have been caught by config validation)
      logger.warn('Invalid regex in PostToolUse hook matcher', {
        matcher: hook.matcher,
      });
      return false;
    }
  });

  if (matchingHooks.length === 0) {
    return {
      shouldContinue: true,
      additionalContexts: [],
    };
  }

  logger.debug(
    `Executing ${matchingHooks.length} PostToolUse hook(s) for tool: ${toolName}`
  );

  const result: CombinedPostToolUseResult = {
    shouldContinue: true,
    additionalContexts: [],
  };

  // Execute hooks sequentially in config order
  for (const hook of matchingHooks) {
    // Normalize tool_input for hooks that expect Claude Code format
    // AI SDK filesystem tools use 'path' but Claude Code uses 'file_path'
    const normalizedToolInput = normalizeToolInput(toolInput);

    const input: PostToolUseInput = {
      session_id: sessionId,
      transcript_path: conversationPath,
      cwd: process.cwd(),
      hook_event_name: 'PostToolUse',
      tool_name: toolName,
      tool_input: normalizedToolInput,
      tool_response: toolResponse,
    };

    logger.debug('Executing PostToolUse hook', { command: hook.command });

    const startTime = Date.now();
    const execResult = await executeHookCommand(hook.command, input);
    const duration = Date.now() - startTime;

    if (!execResult.success) {
      // Log warning but continue with remaining hooks
      logger.warn('PostToolUse hook failed', {
        command: hook.command,
        exitCode: execResult.exitCode,
        error: execResult.error,
        stderr: execResult.stderr,
        duration,
      });
      continue;
    }

    logger.debug('PostToolUse hook completed', {
      command: hook.command,
      exitCode: execResult.exitCode,
      duration,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
    });

    // Try to parse stdout as JSON
    let parsedOutput: PostToolUseOutput | null = null;
    try {
      if (execResult.stdout.trim()) {
        parsedOutput = JSON.parse(execResult.stdout.trim());
      }
    } catch {
      // Not valid JSON - treat as plain text observational output
      logger.debug(
        'PostToolUse hook output is not JSON, treating as plain text'
      );
    }

    if (parsedOutput) {
      // Handle structured JSON output according to Claude Code hooks spec

      // Check if we should continue
      if (parsedOutput.continue === false) {
        result.shouldContinue = false;
        result.stopReason = parsedOutput.stopReason || 'Stopped by hook';
        logger.info('PostToolUse hook requested stop', {
          command: hook.command,
          stopReason: result.stopReason,
        });
        // Stop processing remaining hooks
        break;
      }

      // When decision is "block", the reason is automatically sent to Claude
      if (parsedOutput.decision === 'block' && parsedOutput.reason) {
        result.additionalContexts.push(parsedOutput.reason);
      }

      // Collect additionalContext from hookSpecificOutput
      if (parsedOutput.hookSpecificOutput?.additionalContext) {
        result.additionalContexts.push(
          parsedOutput.hookSpecificOutput.additionalContext
        );
      }
    } else {
      // Plain text output - send to Claude as additional context
      if (execResult.stdout.trim()) {
        result.additionalContexts.push(execResult.stdout.trim());
      }
    }
  }

  return result;
}
