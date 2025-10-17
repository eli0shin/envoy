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
 * Combined result from all PostToolUse hooks
 */
export type CombinedPostToolUseResult = {
  shouldContinue: boolean; // false if any hook said continue: false
  stopReason?: string; // from first hook that stopped
  additionalContexts: string[]; // all additionalContext values from hookSpecificOutput
  systemMessages: string[]; // all systemMessage values
  observationalOutput: string[]; // plain text outputs (only if !suppressOutput)
};

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
      systemMessages: [],
      observationalOutput: [],
    };
  }

  // Find hooks with matchers that match the tool name (regex test)
  const matchingHooks = hooks.filter((hook) => {
    try {
      const regex = new RegExp(hook.matcher);
      return regex.test(toolName);
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
      systemMessages: [],
      observationalOutput: [],
    };
  }

  logger.debug(
    `Executing ${matchingHooks.length} PostToolUse hook(s) for tool: ${toolName}`
  );

  const result: CombinedPostToolUseResult = {
    shouldContinue: true,
    additionalContexts: [],
    systemMessages: [],
    observationalOutput: [],
  };

  // Execute hooks sequentially in config order
  for (const hook of matchingHooks) {
    const input: PostToolUseInput = {
      session_id: sessionId,
      transcript_path: conversationPath,
      cwd: process.cwd(),
      hook_event_name: 'PostToolUse',
      tool_name: toolName,
      tool_input: toolInput,
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
      // Handle structured JSON output

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

      // Collect additionalContext from hookSpecificOutput
      if (
        parsedOutput.hookSpecificOutput?.hookEventName === 'PostToolUse' &&
        parsedOutput.hookSpecificOutput.additionalContext
      ) {
        result.additionalContexts.push(
          parsedOutput.hookSpecificOutput.additionalContext
        );
      }

      // Collect systemMessage
      if (parsedOutput.systemMessage) {
        result.systemMessages.push(parsedOutput.systemMessage);
      }

      // Add to observational output if not suppressed
      if (!parsedOutput.suppressOutput && execResult.stdout.trim()) {
        result.observationalOutput.push(execResult.stdout.trim());
      }
    } else {
      // Plain text output - add to observational output
      if (execResult.stdout.trim()) {
        result.observationalOutput.push(execResult.stdout.trim());
      }
    }
  }

  return result;
}
