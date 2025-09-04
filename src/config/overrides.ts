/**
 * CLI overrides application utilities
 * Handles application of CLI argument overrides to configuration
 */

import type { Configuration, CLIConfigOverrides } from './types.js';
import { logger } from '../logger.js';

/**
 * Applies CLI overrides to configuration
 */
export function applyCLIOverrides(
  config: Configuration,
  overrides: CLIConfigOverrides
): Configuration {
  const result = { ...config };

  if (overrides.provider) {
    logger.debug('Applying CLI provider override', {
      originalProvider: result.providers?.default,
      cliProvider: overrides.provider,
      source: 'CLI argument',
    });
    result.providers = {
      ...result.providers,
      default: overrides.provider,
    };
  }

  if (overrides.model) {
    const defaultProvider = result.providers?.default || 'openrouter';
    const existingProvider =
      result.providers?.[defaultProvider as keyof typeof result.providers];
    const providerConfig =
      typeof existingProvider === 'object' ? existingProvider : {};

    result.providers = {
      ...result.providers,
      [defaultProvider]: {
        ...providerConfig,
        model: overrides.model,
      },
    };
  }

  if (overrides.logLevel !== undefined) {
    result.agent = {
      ...result.agent,
      logLevel: overrides.logLevel,
    };
  }

  if (overrides.logProgress !== undefined) {
    result.agent = {
      ...result.agent,
      logProgress: overrides.logProgress,
    };
  }

  if (overrides.maxSteps !== undefined) {
    result.agent = {
      ...result.agent,
      maxSteps: overrides.maxSteps,
    };
  }

  // Handle system prompt overrides
  if (overrides.systemPrompt || overrides.systemPromptFile) {
    const mode = overrides.systemPromptMode || 'replace';
    const value = overrides.systemPromptFile || overrides.systemPrompt!;

    result.agent = {
      ...result.agent,
      systemPrompt: {
        mode,
        value,
      },
    };
  }

  // Handle conversation persistence overrides
  if (
    overrides.enablePersistence !== undefined ||
    overrides.disablePersistence !== undefined ||
    overrides.persistenceProjectPath !== undefined
  ) {
    const currentPersistence = result.agent?.conversationPersistence || {};

    // Determine enabled state: disablePersistence takes precedence over enablePersistence
    let enabled = currentPersistence.enabled;
    if (overrides.disablePersistence === true) {
      enabled = false;
    } else if (overrides.enablePersistence === true) {
      enabled = true;
    }

    // Auto-enable if project path is provided (unless explicitly disabled)
    if (
      overrides.persistenceProjectPath &&
      overrides.disablePersistence !== true
    ) {
      enabled = true;
    }

    result.agent = {
      ...result.agent,
      conversationPersistence: {
        ...currentPersistence,
        ...(enabled !== undefined && { enabled }),
        ...(overrides.persistenceProjectPath && {
          projectPath: overrides.persistenceProjectPath,
        }),
      },
    };
  }

  return result;
}
