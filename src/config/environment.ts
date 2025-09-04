/**
 * Environment variable expansion utilities
 * Handles expansion of environment variables in configuration
 */

import type { Configuration } from './types.js';

/**
 * Expands environment variables in a string
 * Only allows expansion of existing environment variables for security
 */
export function expandEnvironmentVariables(value: string): string {
  return value.replace(/\${([^}]+)}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      // Keep the original placeholder if env var doesn't exist
      return match;
    }
    return envValue;
  });
}

/**
 * Recursively expands environment variables in configuration objects
 */
export function expandConfigEnvironmentVariables(
  config: Configuration
): Configuration {
  function expandValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return expandEnvironmentVariables(value);
    }
    if (Array.isArray(value)) {
      return value.map(expandValue);
    }
    if (typeof value === 'object' && value !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = expandValue(val);
      }
      return result;
    }
    return value;
  }

  return expandValue(config) as Configuration;
}
