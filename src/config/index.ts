/**
 * Configuration module barrel exports
 * Provides backward compatibility for existing imports
 */

// Re-export all public functions from the modularized files
export {
  loadConfiguration,
  createRuntimeConfiguration,
  loadSystemPromptContent,
  getProviderFromConfig,
  getAgentConfigFromConfig,
} from './loader.js';

export { expandConfigEnvironmentVariables } from './environment.js';

export { getMCPServersFromConfig } from './mcpServers.js';

// Export everything that was previously exported from config.ts
export * from './loader.js';
