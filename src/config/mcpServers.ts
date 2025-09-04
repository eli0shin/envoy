/**
 * MCP server configuration utilities
 * Handles MCP server type inference and format conversion
 */

import type {
  Configuration,
  EnhancedMCPServerConfig,
  RuntimeConfiguration,
} from './types.js';
import type {
  MCPServerConfig,
  StdioMCPServerConfig,
  SSEMCPServerConfig,
} from '../types/index.js';
import { createMCPServersWithConfig } from '../constants.js';

/**
 * Infers and adds the type field to MCP server configurations that are missing it
 */
export function inferMCPServerType(config: unknown): EnhancedMCPServerConfig {
  // Type guard to ensure we're working with an object
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid MCP server configuration: expected object');
  }

  const configObj = config as Record<string, unknown>;

  // If type is already specified, return as-is
  if ('type' in configObj && configObj.type) {
    return configObj as unknown as EnhancedMCPServerConfig;
  }

  // Infer type from presence of command or url
  if ('command' in configObj) {
    return { ...configObj, type: 'stdio' } as EnhancedMCPServerConfig;
  } else if ('url' in configObj) {
    return { ...configObj, type: 'sse' } as EnhancedMCPServerConfig;
  }

  // If neither command nor url is present, throw an error
  throw new Error(
    'Invalid MCP server configuration: missing type, command, or url'
  );
}

/**
 * Converts enhanced MCP server configs back to legacy format
 */
export function convertToLegacyMCPServers(
  mcpServers: Record<string, EnhancedMCPServerConfig>
): MCPServerConfig[] {
  const result: MCPServerConfig[] = [];

  for (const [name, config] of Object.entries(mcpServers)) {
    if (config.disabled) {
      continue; // Skip disabled servers
    }

    const baseConfig = {
      name,
      description: config.description,
    };

    if (config.type === 'stdio') {
      const stdioConfig = config as StdioMCPServerConfig &
        EnhancedMCPServerConfig;
      result.push({
        ...baseConfig,
        type: 'stdio',
        command: stdioConfig.command,
        args: stdioConfig.args,
        env: stdioConfig.env,
        cwd: stdioConfig.cwd,
        timeout: stdioConfig.timeout,
        initTimeout: stdioConfig.initTimeout,
        disabledTools: stdioConfig.disabledTools,
        autoApprove: stdioConfig.autoApprove,
      });
    } else if (config.type === 'sse') {
      const sseConfig = config as SSEMCPServerConfig & EnhancedMCPServerConfig;
      result.push({
        ...baseConfig,
        type: 'sse',
        url: sseConfig.url,
        headers: sseConfig.headers,
        timeout: sseConfig.timeout,
        disabledTools: sseConfig.disabledTools,
        autoApprove: sseConfig.autoApprove,
      });
    }
  }

  return result;
}

/**
 * Helper function to get MCP servers from configuration
 * For RuntimeConfiguration, it includes the agent spawner with the runtime config
 */
export function getMCPServersFromConfig(
  config: Configuration | RuntimeConfiguration
): MCPServerConfig[] {
  // Check if this is a RuntimeConfiguration by looking for runtime-specific properties
  const isRuntimeConfig = 'json' in config || 'stdin' in config;

  if (isRuntimeConfig) {
    // For runtime configuration, use the dynamic server creation to include agent spawner
    return createMCPServersWithConfig(config as RuntimeConfiguration);
  }

  // For regular Configuration, use the file-based servers
  if (!config.mcpServers) {
    return [];
  }
  return convertToLegacyMCPServers(config.mcpServers);
}
