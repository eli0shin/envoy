/**
 * Tool Filtering Module
 * Provides functionality to filter and disable tools based on configuration
 */

import type { WrappedTool, MCPServerConfig } from '../types/index.js';
import type { RuntimeConfiguration } from '../config/types.js';
import { logger } from '../logger.js';

/**
 * Central tool filtering function that handles both server-level and global filtering
 */
export function isToolDisabled(
  toolKey: string,
  tool: WrappedTool,
  serverConfig: MCPServerConfig,
  runtimeConfig: RuntimeConfiguration
): boolean {
  // Check server-level disabled tools (FR1)
  const serverDisabledTools = serverConfig.disabledTools || [];
  if (serverDisabledTools.includes(tool.toolName)) {
    logger.debug(
      `Tool '${tool.toolName}' disabled by server '${serverConfig.name}' configuration`,
      { toolKey, serverName: serverConfig.name, reason: 'server_config' }
    );
    return true;
  }

  // Check global disabled tools (FR2)
  const globalDisabledTools = runtimeConfig.tools?.disabledInternalTools || [];
  const isGloballyDisabled = globalDisabledTools.some((pattern) => {
    // Exact match: "filesystem_write_file"
    if (toolKey === pattern) return true;

    // Unprefixed match: "write_file" matches "filesystem_write_file"
    if (tool.toolName === pattern) return true;

    // Suffix match: "*_write_file"
    if (toolKey.endsWith(`_${pattern}`)) return true;

    return false;
  });

  if (isGloballyDisabled) {
    logger.debug(`Tool '${toolKey}' disabled by global configuration`, {
      toolKey,
      serverName: serverConfig.name,
      reason: 'global_config',
    });
    return true;
  }

  return false;
}
