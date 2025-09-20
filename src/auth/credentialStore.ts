/**
 * Secure credential storage system
 * Handles persistent storage of authentication credentials
 */

import { z } from 'zod/v3';
import { promises as fs } from 'fs';
import * as os from 'os';
import {
  readJsonFile,
  writeJsonFile,
  ensureDirectory,
  getUserConfigPath,
} from '../shared/fileOperations.js';

// Credential schemas for validation
export const OAuthCredentials = z.object({
  type: z.literal('oauth'),
  access: z.string(),
  refresh: z.string(),
  expires: z.number(),
});

export const ApiKeyCredentials = z.object({
  type: z.literal('api'),
  key: z.string(),
});

export const AuthInfo = z.discriminatedUnion('type', [
  OAuthCredentials,
  ApiKeyCredentials,
]);

export type AuthInfo = z.infer<typeof AuthInfo>;

// Storage configuration
const AUTH_FILE = getUserConfigPath('auth.json');
const FILE_MODE = 0o600; // Read/write for owner only

/**
 * Ensure config directory exists with proper permissions
 */
async function ensureConfigDir(): Promise<void> {
  const configDir = getUserConfigPath();
  await ensureDirectory(configDir, { mode: 0o700 });
}

/**
 * Load all credentials from storage
 * @returns Record of provider credentials
 */
async function loadCredentials(): Promise<Record<string, AuthInfo>> {
  const data = await readJsonFile<Record<string, unknown>>(AUTH_FILE);

  if (data === null) {
    // File doesn't exist yet
    return {};
  }

  // Validate each credential entry
  const result: Record<string, AuthInfo> = {};
  for (const [provider, credentials] of Object.entries(data)) {
    try {
      result[provider] = AuthInfo.parse(credentials);
    } catch {
      process.stderr.write(
        `Invalid credentials for provider ${provider}, skipping\\n`
      );
    }
  }

  return result;
}

/**
 * Save credentials to storage with secure permissions
 * @param credentials All provider credentials
 */
async function saveCredentials(
  credentials: Record<string, AuthInfo>
): Promise<void> {
  await ensureConfigDir();
  await writeJsonFile(AUTH_FILE, credentials, { mode: FILE_MODE });
}

/**
 * Get credentials for a specific provider
 * @param provider Provider name (e.g., 'anthropic')
 * @returns Provider credentials or undefined if not found
 */
export async function get(provider: string): Promise<AuthInfo | undefined> {
  const credentials = await loadCredentials();
  return credentials[provider];
}

/**
 * Set credentials for a specific provider
 * @param provider Provider name
 * @param info Credential information
 */
export async function set(provider: string, info: AuthInfo): Promise<void> {
  // Validate credentials before storing
  const validatedInfo = AuthInfo.parse(info);

  const credentials = await loadCredentials();
  credentials[provider] = validatedInfo;

  await saveCredentials(credentials);
}

/**
 * Remove credentials for a specific provider
 * @param provider Provider name
 */
export async function remove(provider: string): Promise<void> {
  const credentials = await loadCredentials();
  delete credentials[provider];

  await saveCredentials(credentials);
}

/**
 * List all stored credentials
 * @returns Record of all provider credentials
 */
export async function list(): Promise<Record<string, AuthInfo>> {
  return await loadCredentials();
}

/**
 * Clear all stored credentials
 */
export async function clear(): Promise<void> {
  try {
    await fs.unlink(AUTH_FILE);
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Get the path to the auth file for display purposes
 * @returns Path to auth file with home directory abbreviated
 */
export function getAuthFilePath(): string {
  const homeDir = os.homedir();
  return AUTH_FILE.startsWith(homeDir) ?
      AUTH_FILE.replace(homeDir, '~')
    : AUTH_FILE;
}

/**
 * Check if credentials exist for a provider
 * @param provider Provider name
 * @returns True if credentials exist
 */
export async function has(provider: string): Promise<boolean> {
  const credentials = await loadCredentials();
  return provider in credentials;
}
