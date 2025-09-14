/**
 * File system operations for configuration loading
 * Handles configuration file paths and loading operations
 */

import { readFile } from 'fs/promises';
import { join, isAbsolute } from 'path';
import { homedir } from 'os';
import {
  readJsonFile,
  getUserConfigPath,
  handleFileError,
} from '../shared/fileOperations.js';
import type { Configuration } from './types.js';
import { validateConfig } from './schema.js';
import { expandEnvironmentVariables } from './environment.js';

/**
 * Gets potential configuration file paths in order of precedence
 */
export function getConfigFilePaths(): string[] {
  const paths: string[] = [];

  // Project level (highest precedence)
  paths.push(join(process.cwd(), '.envoy.json'));

  // User level
  paths.push(getUserConfigPath('config.json'));
  paths.push(join(homedir(), '.envoy.json'));

  return paths;
}

/**
 * Loads a single configuration file
 */
export async function loadConfigFile(filePath: string): Promise<{
  config?: Configuration;
  error?: string;
}> {
  try {
    const config = await readJsonFile<Configuration>(
      filePath,
      (data: unknown) => {
        const validation = validateConfig(data);
        if (!validation.valid) {
          throw new Error(
            `Invalid configuration in ${filePath}: ${validation.errors.join(', ')}`
          );
        }
        return data as Configuration;
      }
    );

    if (config === null) {
      // File doesn't exist, which is fine
      return {};
    }

    return { config };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Loads system prompt content from a file path
 * Supports relative paths and environment variable expansion
 */
export async function loadSystemPromptFile(filePath: string): Promise<string> {
  try {
    // Expand environment variables in file path
    const expandedPath = expandEnvironmentVariables(filePath);

    // Resolve relative paths from current working directory
    const resolvedPath =
      isAbsolute(expandedPath) ? expandedPath : (
        join(process.cwd(), expandedPath)
      );

    const content = await readFile(resolvedPath, 'utf-8');
    return content.trim();
  } catch (error) {
    throw handleFileError(error, 'load system prompt file', filePath);
  }
}

/**
 * Determines if a string value is likely a file path
 */
export function isFilePath(value: string): boolean {
  const lowerValue = value.toLowerCase();
  return (
    value.includes('/') ||
    value.includes('\\') ||
    lowerValue.endsWith('.txt') ||
    lowerValue.endsWith('.md') ||
    lowerValue.endsWith('.prompt')
  );
}
