/**
 * Capability Tool Factories Module
 * Creates tools for prompt and resource access from MCP servers
 */

import { tool } from 'ai';
import { z } from 'zod/v3';
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
) {
  const list_prompts = tool({
    description: `List available prompts from ${serverName}`,
    inputSchema: z.object({}),
    execute: async () => {
      return JSON.stringify(prompts, null, 2);
    },
  });

  const get_prompt = tool({
    description: `Get and execute a prompt from ${serverName}`,
    inputSchema: z.object({
      name: z.string().describe('Name of the prompt to execute'),
      arguments: z
        .record(z.any())
        .optional()
        .describe('Arguments for the prompt'),
    }),
    execute: async ({ name, arguments: argParams }) => {
      try {
        const result = await executePrompt(client, name, argParams);
        return JSON.stringify(result, null, 2);
      } catch (error) {
        return (
          'Error: ' +
          (error instanceof Error ?
            error.message
          : 'Failed to execute prompt')
        );
      }
    },
  });

  return {
    [`${serverName}_list_prompts`]: { ...list_prompts, serverName, toolName: 'list_prompts' },
    [`${serverName}_get_prompt`]: { ...get_prompt, serverName, toolName: 'get_prompt' },
  };
}

/**
 * Creates wrapped tools for resource access
 */
export function createResourceTools(
  client: Client,
  serverName: string,
  resources: MCPResource[]
) {
  const list_resources = tool({
    description: `List available resources from ${serverName}`,
    inputSchema: z.object({}),
    execute: async () => {
      return JSON.stringify(resources, null, 2);
    },
  });

  const read_resource = tool({
    description: `Read content from a resource in ${serverName}`,
    inputSchema: z.object({
      uri: z.string().describe('URI of the resource to read'),
    }),
    execute: async ({ uri }) => {
      try {
        const result = await readResourceContent(client, uri);
        return JSON.stringify(result, null, 2);
      } catch (error) {
        return (
          'Error: ' +
          (error instanceof Error ?
            error.message
          : 'Failed to read resource')
        );
      }
    },
  });

  return {
    [`${serverName}_list_resources`]: { ...list_resources, serverName, toolName: 'list_resources' },
    [`${serverName}_read_resource`]: { ...read_resource, serverName, toolName: 'read_resource' },
  };
}
