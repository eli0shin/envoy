/**
 * MCP client creation and tool aggregation module
 * Handles both stdio and SSE MCP server connections with logging wrappers
 */

import {
  MCPServerConfig,
  ToolLoadResult,
  MCPLoadResult,
  WrappedTool,
  MCPClientWrapper,
  ServerInitResult,
} from '../types/index.js';
import type { RuntimeConfiguration } from '../config/types.js';
import { logger } from '../logger.js';
import { isToolDisabled } from './toolFiltering.js';
import { loadCapabilitiesAndCreateWrapper } from './capabilityLoader.js';
import { initializeServerWithCapabilities } from './client/initialization.js';

// Client initialization functions moved to './mcp/client/initialization.js'

// Re-export individual capability loading functions for backward compatibility
export {
  loadToolsFromServer,
  loadPromptsFromServer,
  loadResourcesFromServer,
} from './capabilities/capabilityLoader.js';

/**
 * Main function to load and merge tools from all configured MCP servers
 */
/**
 * New integrated function that loads both tools and creates client wrappers
 * Eliminates duplication by doing capability detection only once per server
 */
export async function loadMCPServersWithClients(
  serverConfigs: readonly MCPServerConfig[] | Readonly<MCPServerConfig[]>,
  runtimeConfig?: RuntimeConfiguration
): Promise<MCPLoadResult> {
  const allTools = new Map<string, WrappedTool>();
  const allClients: MCPClientWrapper[] = [];
  const errors: Array<{ serverName: string; error: string }> = [];

  logger.debug(
    `Starting integrated parallel initialization of ${serverConfigs.length} MCP servers`
  );

  // Phase 1: Initialize all servers in parallel with capability detection
  const initPromises = serverConfigs.map((config) =>
    initializeServerWithCapabilities(config)
  );

  const initResults = await Promise.allSettled(initPromises);

  // Filter successful initializations
  const successfulInits: ServerInitResult[] = [];
  for (let i = 0; i < initResults.length; i++) {
    const result = initResults[i];
    const config = serverConfigs[i];

    if (result.status === 'fulfilled' && result.value !== null) {
      successfulInits.push(result.value);
    } else {
      const error =
        result.status === 'rejected' ?
          result.reason instanceof Error ?
            result.reason.message
          : 'Unknown error'
        : 'Server initialization returned null';
      errors.push({
        serverName: config.name,
        error: `Failed to initialize: ${error}`,
      });
    }
  }

  logger.debug(
    `Successfully initialized ${successfulInits.length}/${serverConfigs.length} servers`
  );

  // Phase 2: Load capabilities and create wrappers in parallel
  const wrapperPromises = successfulInits.map((serverInit) =>
    loadCapabilitiesAndCreateWrapper(serverInit)
  );

  const wrapperResults = await Promise.allSettled(wrapperPromises);

  // Phase 3: Merge all tools, collect wrappers, and handle errors
  for (let i = 0; i < wrapperResults.length; i++) {
    const result = wrapperResults[i];
    const serverInit = successfulInits[i];

    if (result.status === 'fulfilled') {
      const { tools: _tools, wrapper, errors: loadErrors } = result.value;

      // Add any errors from capability loading
      for (const error of loadErrors) {
        errors.push({
          serverName: serverInit.config.name,
          error,
        });
      }

      // Add the wrapper to the collection
      allClients.push(wrapper);

      // Add all tools from the wrapper (includes regular, prompt, and resource tools)
      // Regular tools need server prefix, prompt/resource tools already have it
      for (const [toolKey, tool] of Array.from(wrapper.tools.entries())) {
        let finalToolKey = toolKey;

        // If the toolKey doesn't start with server name, add server prefix for regular tools
        if (!toolKey.startsWith(`${serverInit.config.name}_`)) {
          finalToolKey = `${serverInit.config.name}_${toolKey}`;
        }

        // NEW: Central tool filtering
        if (
          runtimeConfig &&
          isToolDisabled(finalToolKey, tool, serverInit.config, runtimeConfig)
        ) {
          continue; // Skip disabled tools (logging handled in isToolDisabled)
        }

        if (allTools.has(finalToolKey)) {
          errors.push({
            serverName: serverInit.config.name,
            error: `Tool name conflict: ${toolKey} already exists`,
          });
          continue;
        }

        allTools.set(finalToolKey, tool);
      }
    } else {
      const error =
        result.reason instanceof Error ?
          result.reason.message
        : 'Unknown error';
      errors.push({
        serverName: serverInit.config.name,
        error: `Failed to load capabilities: ${error}`,
      });
    }
  }

  logger.debug(
    `Loaded ${allTools.size} tools and ${allClients.length} client wrappers from ${successfulInits.length} servers`
  );

  return {
    tools: allTools,
    clients: allClients,
    errors,
  };
}

/**
 * Legacy function for backward compatibility - now uses the integrated approach
 */
export async function loadMCPTools(
  serverConfigs: readonly MCPServerConfig[] | Readonly<MCPServerConfig[]>
): Promise<ToolLoadResult> {
  const result = await loadMCPServersWithClients(serverConfigs);

  return {
    tools: result.tools,
    errors: result.errors,
  };
}

/**
 * Converts the tool map to the format expected by the AI SDK
 */
export function convertToolsForAISDK(
  tools: Map<string, WrappedTool>
): Record<string, WrappedTool> {
  const aiSDKTools: Record<string, WrappedTool> = {};

  for (const [toolKey, tool] of Array.from(tools.entries())) {
    aiSDKTools[toolKey] = {
      description: tool.description,
      parameters: tool.parameters,
      execute: tool.execute,
      originalExecute: tool.originalExecute,
      serverName: tool.serverName,
      toolName: tool.toolName,
    };
  }

  return aiSDKTools;
}

/**
 * Creates a client wrapper that manages connection lifecycle
 */
/**
 * Creates an MCP client wrapper (legacy function for backward compatibility)
 * Returns a wrapper even if connection fails - connection is attempted on connect()
 */
export async function createMCPClientWrapper(
  config: MCPServerConfig
): Promise<MCPClientWrapper> {
  logger.debug(
    `Creating MCP client wrapper for ${config.name} (legacy method)`
  );

  try {
    // Use the integrated approach for a single server
    const result = await loadMCPServersWithClients([config]);

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        logger.warn(`MCPClientWrapper - ${error.serverName}: ${error.error}`);
      }
    }

    if (result.clients.length === 0) {
      // Get the error message if available
      const errorMessage =
        result.errors.length > 0 ? result.errors[0].error : undefined;
      return createFailedWrapper(config, errorMessage);
    }

    return result.clients[0];
  } catch (error) {
    // If initialization completely fails, return a wrapper that will fail on connect
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.warn(
      `Failed to initialize MCP client wrapper for ${config.name}: ${errorMessage}`
    );
    return createFailedWrapper(config, errorMessage);
  }
}

/**
 * Creates a wrapper for failed server initialization
 */
function createFailedWrapper(
  config: MCPServerConfig,
  _originalError?: string
): MCPClientWrapper {
  const wrapper: MCPClientWrapper = {
    serverName: config.name,
    serverConfig: config,
    tools: new Map(),
    prompts: new Map(),
    resources: new Map(),
    isConnected: false,
    client: null, // No client for failed wrapper

    async listPrompts() {
      return [];
    },

    async getPrompt(_name: string, _args?: Record<string, unknown>) {
      throw new Error('Client not connected');
    },

    async listResources() {
      return [];
    },

    async readResource(_uri: string) {
      throw new Error('Client not connected');
    },
  };

  return wrapper;
}
