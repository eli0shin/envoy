/**
 * Capability Loading Module
 * Handles loading of individual capabilities (tools, prompts, resources) from MCP servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ChildProcess } from 'child_process';
import type {
  ListToolsResult,
  Tool,
  ListPromptsResult,
  ListResourcesResult,
} from '@modelcontextprotocol/sdk/types.js';

import {
  MCPServerConfig,
  WrappedTool,
  MCPPrompt,
  MCPResource,
} from '../../types/index.js';
import { createWrappedTool } from '../toolWrapper.js';
import { createStdioClient } from '../transport/stdioTransport.js';
import { createSSEClient } from '../transport/sseTransport.js';

/**
 * Creates an MCP client based on the server configuration
 */
async function createMCPClient(
  config: MCPServerConfig
): Promise<{ client: Client; childProcess?: ChildProcess }> {
  switch (config.type) {
    case 'stdio':
      return createStdioClient(config);
    case 'sse':
      return createSSEClient(config);
    default:
      throw new Error(
        `Unsupported MCP server type: ${(config as { type: string }).type}`
      );
  }
}

/**
 * Loads tools from a single MCP server
 */
export async function loadToolsFromServer(config: MCPServerConfig): Promise<{
  tools: WrappedTool[];
  error?: string;
}> {
  try {
    const { client } = await createMCPClient(config);

    const toolsResult: ListToolsResult = await client.listTools();

    const wrappedTools = toolsResult.tools.map((tool: Tool) =>
      createWrappedTool(tool, client, config.name)
    );

    return { tools: wrappedTools };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      tools: [],
      error: `Failed to load tools from ${config.name}: ${errorMessage}`,
    };
  }
}

/**
 * Loads prompts from a single MCP server
 */
export async function loadPromptsFromServer(
  client: Client,
  serverName: string
): Promise<{
  prompts: MCPPrompt[];
  error?: string;
}> {
  try {
    const promptsResult: ListPromptsResult = await client.listPrompts();
    return { prompts: (promptsResult.prompts || []) as MCPPrompt[] };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      prompts: [],
      error: `Failed to load prompts from ${serverName}: ${errorMessage}`,
    };
  }
}

/**
 * Loads resources from a single MCP server
 */
export async function loadResourcesFromServer(
  client: Client,
  serverName: string
): Promise<{
  resources: MCPResource[];
  error?: string;
}> {
  try {
    const resourcesResult: ListResourcesResult = await client.listResources();
    return { resources: (resourcesResult.resources || []) as MCPResource[] };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      resources: [],
      error: `Failed to load resources from ${serverName}: ${errorMessage}`,
    };
  }
}
