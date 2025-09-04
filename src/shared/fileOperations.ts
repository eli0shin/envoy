import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Options for writing JSON files
 */
export type WriteJsonOptions = {
  mode?: number;
  indent?: number;
};

/**
 * Options for ensuring directories
 */
export type EnsureDirectoryOptions = {
  mode?: number;
  recursive?: boolean;
};

/**
 * Read and parse a JSON file with unified error handling
 * @param filePath Path to the JSON file
 * @param validator Optional validation function to parse/validate the JSON data
 * @returns The parsed and optionally validated JSON data, or null if file doesn't exist
 * @throws Error if file exists but cannot be read or parsed
 */
export async function readJsonFile<T = unknown>(
  filePath: string,
  validator?: (data: unknown) => T
): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      throw handleFileError(
        parseError,
        'parse JSON',
        filePath,
        `Invalid JSON in ${filePath}: ${parseError instanceof Error ? parseError.message : 'Parse error'}`
      );
    }

    // Apply validation if provided
    if (validator) {
      try {
        return validator(parsed);
      } catch (validationError) {
        throw handleFileError(
          validationError,
          'validate JSON',
          filePath,
          `Invalid data in ${filePath}: ${validationError instanceof Error ? validationError.message : 'Validation error'}`
        );
      }
    }

    return parsed as T;
  } catch (error) {
    // If file doesn't exist, return null (this is expected behavior)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    // Re-throw other errors (including validation errors from above)
    if (error instanceof Error && error.message.includes(filePath)) {
      throw error;
    }

    throw handleFileError(error, 'read file', filePath);
  }
}

/**
 * Write data to a JSON file with unified error handling and safety
 * @param filePath Path to write the JSON file
 * @param data Data to serialize and write
 * @param options Write options including file permissions and indentation
 */
export async function writeJsonFile(
  filePath: string,
  data: unknown,
  options: WriteJsonOptions = {}
): Promise<void> {
  const { mode = 0o600, indent = 2 } = options;

  try {
    const jsonContent = JSON.stringify(data, null, indent);
    await fs.writeFile(filePath, jsonContent, { mode });
  } catch (error) {
    throw handleFileError(error, 'write JSON file', filePath);
  }
}

/**
 * Ensure a directory exists with unified error handling and permissions
 * @param dirPath Path to the directory
 * @param options Directory creation options
 */
export async function ensureDirectory(
  dirPath: string,
  options: EnsureDirectoryOptions = {}
): Promise<void> {
  const { mode = 0o755, recursive = true } = options;

  try {
    await fs.mkdir(dirPath, { recursive, mode });
  } catch (error) {
    // Directory might already exist
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw handleFileError(error, 'create directory', dirPath);
    }
  }
}

/**
 * Standardized error handling for file operations
 * @param error Original error
 * @param operation Description of the operation that failed
 * @param path File or directory path involved
 * @param customMessage Optional custom error message
 * @returns A standardized Error with descriptive message
 */
export function handleFileError(
  error: unknown,
  operation: string,
  path: string,
  customMessage?: string
): Error {
  if (customMessage) {
    return new Error(customMessage);
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return new Error(`Failed to ${operation} ${path}: ${errorMessage}`);
}

/**
 * Get a path relative to the user's configuration directory
 * Provides unified path construction for user config files
 * @param segments Path segments to join to the config directory
 * @returns Full path to the config file/directory
 */
export function getUserConfigPath(...segments: string[]): string {
  return join(homedir(), '.config', 'envoy', ...segments);
}

/**
 * Get a path relative to the user's application support directory
 * Alternative to config directory for application data
 * @param segments Path segments to join to the app support directory
 * @returns Full path to the app support file/directory
 */
export function getUserDataPath(...segments: string[]): string {
  const platform = process.platform;

  let baseDir: string;
  if (platform === 'darwin') {
    baseDir = join(homedir(), 'Library', 'Application Support', 'envoy');
  } else if (platform === 'win32') {
    baseDir = join(homedir(), 'AppData', 'Roaming', 'envoy');
  } else {
    // Linux and other Unix-like systems
    baseDir = join(homedir(), '.local', 'share', 'envoy');
  }

  return join(baseDir, ...segments);
}
