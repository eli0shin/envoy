/**
 * SessionStart hooks module
 * Executes hooks on session start, resume, or clear events
 */

import { logger } from '../logger.js';
import { executeHookCommand } from './executor.js';
import type {
  RuntimeConfiguration,
  SessionStartInput,
} from '../config/types.js';

/**
 * Execute all SessionStart hooks that match the given source
 *
 * @param config - Runtime configuration containing hooks
 * @param sessionId - Current session ID
 * @param conversationPath - Absolute path to conversation JSONL file (optional)
 * @param source - Event source (startup, resume, clear)
 * @returns Combined stdout from all successful hooks
 */
export async function executeSessionStartHooks(
  config: RuntimeConfiguration,
  sessionId: string,
  conversationPath: string | undefined,
  source: 'startup' | 'resume' | 'clear'
): Promise<string> {
  const hooks = config.hooks?.SessionStart;

  if (!hooks || hooks.length === 0) {
    return '';
  }

  // Filter hooks by matcher
  const matchingHooks = hooks.filter((hook) => {
    // If no matcher specified, hook matches all events
    if (!hook.matcher) {
      return true;
    }
    // Otherwise, matcher must match the source
    return hook.matcher === source;
  });

  if (matchingHooks.length === 0) {
    return '';
  }

  logger.debug(
    `Executing ${matchingHooks.length} SessionStart hook(s) for ${source} event`
  );

  const outputs: string[] = [];

  // Execute hooks sequentially in config order
  for (const hook of matchingHooks) {
    const input: SessionStartInput = {
      session_id: sessionId,
      transcript_path: conversationPath,
      cwd: process.cwd(),
      hook_event_name: 'SessionStart',
      source,
    };

    logger.debug('Executing SessionStart hook', { command: hook.command });

    const startTime = Date.now();
    const result = await executeHookCommand(hook.command, input);
    const duration = Date.now() - startTime;

    if (result.success) {
      logger.debug('SessionStart hook completed', {
        command: hook.command,
        exitCode: result.exitCode,
        duration,
      });

      // Collect stdout from successful hooks
      if (result.stdout) {
        outputs.push(result.stdout);
      }
    } else {
      // Log warning but continue with remaining hooks
      logger.warn('SessionStart hook failed', {
        command: hook.command,
        exitCode: result.exitCode,
        error: result.error,
        stderr: result.stderr,
        duration,
      });
    }
  }

  // Combine all outputs with newlines
  return outputs.join('\n');
}
