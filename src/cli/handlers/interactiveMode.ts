/**
 * Interactive mode detection utilities
 * Handles logic for determining when to activate interactive CLI mode
 */

import type { CLIOptions } from "../../types/index.js";
import type { RuntimeConfiguration } from "../../config/types.js";

/**
 * Determines if interactive mode should be activated
 */
export function shouldActivateInteractiveMode(
  config: RuntimeConfiguration,
  options: CLIOptions,
): boolean {
  // Don't activate interactive mode in test environment
  // unless explicitly enabled for E2E testing
  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return process.env.ENABLE_INTERACTIVE_E2E_TESTING === "true";
  }

  // Activate interactive mode if:
  // 1. No message provided
  // 2. Not reading from stdin
  // 3. Not executing special commands (prompts, resources, sessions, etc.)
  // 4. Not using --resources or --auto-resources (which require a message)
  return (
    !config.message &&
    !config.stdin &&
    !options.listPrompts &&
    !options.listResources &&
    !options.prompt &&
    !options.interactivePrompt &&
    !options.resources &&
    !options.autoResources &&
    !options.listSessions
  );
}
