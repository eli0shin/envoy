/**
 * Client Wrapper Factory Module
 * Creates MCPClientWrapper instances from pre-loaded data with process management
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  GetPromptResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import type { ChildProcess } from 'child_process';
import type {
  MCPClientWrapper,
  MCPServerConfig,
  ServerCapabilities,
  WrappedTool,
  MCPPrompt,
  MCPResource,
} from '../types/index.js';
import { createPromptTools, createResourceTools } from './capabilityTools.js';
import { ProcessManager } from './processManager.js';

/**
 * Creates an MCPClientWrapper from pre-loaded data with optional child process tracking
 */
export function createMCPClientWrapperFromData(
  client: Client,
  config: MCPServerConfig,
  capabilities: ServerCapabilities,
  tools: WrappedTool[],
  prompts: MCPPrompt[],
  resources: MCPResource[],
  childProcess?: ChildProcess
): MCPClientWrapper {
  const toolsObj: Record<string, WrappedTool> = {};
  const promptsMap = new Map<string, MCPPrompt>();
  const resourcesMap = new Map<string, MCPResource>();

  // Populate tools object (keep first tool in case of duplicates)
  for (const tool of tools) {
    if (!(tool.toolName in toolsObj)) {
      toolsObj[tool.toolName] = tool;
    }
  }

  // Populate prompts map
  for (const prompt of prompts) {
    promptsMap.set(prompt.name, prompt);
  }

  // Populate resources map
  for (const resource of resources) {
    resourcesMap.set(resource.uri, resource);
  }

  const promptTools = capabilities.prompts ? createPromptTools(client, config.name, prompts) : {};
  const resourceTools = capabilities.resources ? createResourceTools(client, config.name, resources) : {};

  const allTools = {
    ...toolsObj,
    ...promptTools,
    ...resourceTools,
  };

  // Register child process immediately when wrapper is created
  if (childProcess) {
    ProcessManager.getInstance().registerProcess(config.name, childProcess);
  }

  const wrapper: MCPClientWrapper = {
    serverName: config.name,
    serverConfig: config,
    tools: allTools,
    prompts: promptsMap,
    resources: resourcesMap,
    isConnected: true, // Client is already connected from initialization
    childProcess, // Store child process reference for cleanup
    client, // Expose underlying MCP client for notification handlers

    async listPrompts() {
      return Array.from(promptsMap.values());
    },

    async getPrompt(name: string, args?: Record<string, unknown>) {
      if (!this.isConnected) throw new Error('Client not connected');
      const result: GetPromptResult = await client.getPrompt({
        name,
        arguments: args as { [key: string]: string } | undefined,
      });

      return {
        description: result.description,
        messages: result.messages,
      };
    },

    async listResources() {
      return Array.from(resourcesMap.values());
    },

    async readResource(uri: string) {
      if (!this.isConnected) throw new Error('Client not connected');
      const result: ReadResourceResult = await client.readResource({ uri });

      return {
        contents: result.contents,
      };
    },
  };

  return wrapper;
}
