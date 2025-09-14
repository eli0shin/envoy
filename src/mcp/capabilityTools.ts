/**
 * Capability Tool Factories Module
 * Creates tools for prompt and resource access from MCP servers
 */

import { z } from 'zod';
import type {
  GetPromptResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  MCPPrompt,
  MCPResource,
  PromptResult,
  ResourceContent,
  WrappedTool,
} from '../types/index.js';

/**
 * Executes a prompt with the given name and arguments
 */
export async function executePrompt(
  client: Client,
  promptName: string,
  args?: Record<string, unknown>
): Promise<PromptResult> {
  const result: GetPromptResult = await client.getPrompt({
    name: promptName,
    arguments: args as { [key: string]: string } | undefined,
  });

  return {
    description: result.description,
    messages: result.messages as PromptResult['messages'],
  };
}

/**
 * Reads content from a resource using its URI
 */
export async function readResourceContent(
  client: Client,
  uri: string
): Promise<ResourceContent> {
  const result: ReadResourceResult = await client.readResource({ uri });

  return {
    contents: result.contents as ResourceContent['contents'],
  };
}

/**
 * Creates wrapped tools for prompt access
 */
export function createPromptTools(
  client: Client,
  serverName: string,
  prompts: MCPPrompt[]
): WrappedTool[] {
  const tools: WrappedTool[] = [];

  // List prompts tool
  tools.push({
    description: `List available prompts from ${serverName}`,
    parameters: z.object({}) as z.ZodType<unknown>,
    execute: async () => {
      return { result: JSON.stringify(prompts, null, 2) };
    },
    originalExecute: async () => ({ result: JSON.stringify(prompts, null, 2) }),
    serverName,
    toolName: 'list_prompts',
  });

  // Get/execute prompt tool
  tools.push({
    description: `Get and execute a prompt from ${serverName}`,
    parameters: z.object({
      name: z.string().describe('Name of the prompt to execute'),
      arguments: z
        .record(z.any())
        .optional()
        .describe('Arguments for the prompt'),
    }),
    execute: async (args: unknown) => {
      const { name, arguments: argParams } = args as {
        name: string;
        arguments?: Record<string, unknown>;
      };
      try {
        const result = await executePrompt(client, name, argParams);
        return { result: JSON.stringify(result, null, 2) };
      } catch (error) {
        return {
          result:
            'Error: ' +
            (error instanceof Error ?
              error.message
            : 'Failed to execute prompt'),
        };
      }
    },
    originalExecute: async (args: unknown) => {
      const { name, arguments: argParams } = args as {
        name: string;
        arguments?: Record<string, unknown>;
      };
      const result = await executePrompt(client, name, argParams);
      return { result: JSON.stringify(result, null, 2) };
    },
    serverName,
    toolName: 'get_prompt',
  });

  return tools;
}

/**
 * Creates wrapped tools for resource access
 */
export function createResourceTools(
  client: Client,
  serverName: string,
  resources: MCPResource[]
): WrappedTool[] {
  const tools: WrappedTool[] = [];

  // List resources tool
  tools.push({
    description: `List available resources from ${serverName}`,
    parameters: z.object({}) as z.ZodType<unknown>,
    execute: async () => {
      return { result: JSON.stringify(resources, null, 2) };
    },
    originalExecute: async () => ({
      result: JSON.stringify(resources, null, 2),
    }),
    serverName,
    toolName: 'list_resources',
  });

  // Read resource tool
  tools.push({
    description: `Read content from a resource in ${serverName}`,
    parameters: z.object({
      uri: z.string().describe('URI of the resource to read'),
    }),
    execute: async (args: unknown) => {
      const { uri } = args as { uri: string };
      try {
        const result = await readResourceContent(client, uri);
        return { result: JSON.stringify(result, null, 2) };
      } catch (error) {
        return {
          result:
            'Error: ' +
            (error instanceof Error ?
              error.message
            : 'Failed to read resource'),
        };
      }
    },
    originalExecute: async (args: unknown) => {
      const { uri } = args as { uri: string };
      const result = await readResourceContent(client, uri);
      return { result: JSON.stringify(result, null, 2) };
    },
    serverName,
    toolName: 'read_resource',
  });

  return tools;
}
