/**
 * MCP Client Initialization Module
 * Handles server initialization and capability detection
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  MCPServerConfig,
  ServerCapabilities,
  ServerInitResult,
} from '../../types/index.js';
import { logger } from '../../logger.js';
import { createStdioClient } from '../transport/stdioTransport.js';
import { createSSEClient } from '../transport/sseTransport.js';

/**
 * Creates an MCP client based on the server configuration
 * Returns both client and child process (for stdio) for proper cleanup tracking
 */
export async function createMCPClient(config: MCPServerConfig): Promise<{
  client: Client;
  childProcess?: import('child_process').ChildProcess;
}> {
  switch (config.type) {
    case 'stdio':
      return createStdioClient(config);
    case 'sse': {
      return createSSEClient(config); // SSE doesn't have child processes
    }
    default:
      throw new Error(
        `Unsupported MCP server type: ${(config as { type: string }).type}`
      );
  }
}

/**
 * Gets server capabilities from the MCP initialize response (proper approach)
 * No more trial-and-error network calls!
 */
export function getServerCapabilities(client: Client): ServerCapabilities {
  // Use the MCP SDK's built-in method to get server capabilities from initialize response
  const serverCapabilities = client.getServerCapabilities();

  if (!serverCapabilities) {
    logger.warn(
      'Server capabilities not available - server may not have completed initialization'
    );
    return {};
  }

  logger.debug(
    'Server capabilities from initialize response:',
    serverCapabilities
  );
  return serverCapabilities;
}

/**
 * Initializes a single MCP server with capability detection
 */
export async function initializeServerWithCapabilities(
  config: MCPServerConfig
): Promise<ServerInitResult | null> {
  const startTime = Date.now();

  try {
    logger.debug(`Initializing server: ${config.name}`);

    // Create and connect the client (returns both client and optional child process)
    const { client, childProcess } = await createMCPClient(config);

    // Get server capabilities from initialize response (no network calls needed)
    const capabilities = getServerCapabilities(client);

    const initTime = Date.now() - startTime;
    const supportedCapabilities = Object.keys(capabilities);

    logger.debug(
      `Server ${config.name} initialized in ${initTime}ms. Capabilities: ${
        supportedCapabilities.length > 0 ?
          supportedCapabilities.join(', ')
        : 'none detected'
      }`
    );

    return {
      client,
      capabilities,
      config,
      childProcess, // Pass through child process for stdio servers
      serverInfo: {
        name: config.name,
        version: '1.0.0', // Default version
      },
    };
  } catch (error) {
    const initTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Different log levels based on error type
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNREFUSED')
    ) {
      logger.warn(
        `Server ${config.name} connection failed after ${initTime}ms: ${errorMessage}`
      );
    } else {
      logger.error(
        `Server ${config.name} initialization failed after ${initTime}ms: ${errorMessage}`
      );
    }

    // Re-throw the original error to preserve the error message
    throw error;
  }
}
