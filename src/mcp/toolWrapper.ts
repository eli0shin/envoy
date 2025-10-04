/**
 * Tool Wrapper Module
 * Provides tool wrapping functionality with logging, validation, and error handling
 */

import { tool } from 'ai';
import { z } from 'zod/v3';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TOOL_TIMEOUT_MS } from '../constants.js';
import { logMcpTool } from '../logger.js';

/**
 * Converts MCP tool schema to Zod schema for AI SDK compatibility
 */
export function convertMCPSchemaToZod(
  schema: Record<string, unknown> | null | undefined
): z.ZodType<unknown> {
  if (!schema) {
    return z.object({});
  }

  if (schema.type === 'object') {
    const shape: Record<string, z.ZodType<unknown>> = {};

    if (schema.properties) {
      for (const [key, prop] of Object.entries(
        schema.properties as Record<string, Record<string, unknown>>
      )) {
        shape[key] = convertMCPSchemaToZod(prop);
      }
    }

    const zodObject = z.object(shape);

    // Handle required fields
    if (schema.required && Array.isArray(schema.required)) {
      return zodObject.partial().required(
        schema.required.reduce((acc: Record<string, true>, key: string) => {
          acc[key] = true;
          return acc;
        }, {})
      );
    }

    return zodObject.partial();
  }

  switch (schema.type) {
    case 'string':
      return z.string();
    case 'number':
      return z.number();
    case 'integer':
      return z.number().int();
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(
        schema.items ?
          convertMCPSchemaToZod(schema.items as Record<string, unknown>)
        : z.unknown()
      );
    default:
      return z.unknown();
  }
}

/**
 * Creates a wrapped tool with logging functionality and argument validation
 */
export function createWrappedTool(
  mcpTool: Tool,
  client: Client,
  serverName: string
) {
  // Convert MCP tool schema to Zod schema for validation
  const inputSchema =
    mcpTool.inputSchema ?
      convertMCPSchemaToZod(mcpTool.inputSchema as Record<string, unknown>)
    : z.object({});

  const aiTool = tool({
    description: mcpTool.description || `Tool ${mcpTool.name} from ${serverName}`,
    inputSchema,
    execute: async (args) => {
      // Log the tool call
      logMcpTool(serverName, mcpTool.name, 'INFO', 'Tool called', {
        args,
        description: mcpTool.description,
      });

      try {
        // Execute the tool with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('Tool execution timeout')),
            TOOL_TIMEOUT_MS
          );
        });

        const executionPromise = client.callTool(
          {
            name: mcpTool.name,
            arguments: args as Record<string, unknown>,
          },
          undefined,
          {
            timeout: TOOL_TIMEOUT_MS,
            resetTimeoutOnProgress: true,
          }
        );

        const result = (await Promise.race([
          executionPromise,
          timeoutPromise,
        ])) as CallToolResult;

        if (result.isError) {
          const errorMsg = result.content[0]?.text || 'Tool execution failed';

          logMcpTool(serverName, mcpTool.name, 'ERROR', 'Tool execution failed', {
            error: errorMsg,
            args,
          });

          return 'Error: ' + errorMsg;
        }

        // Extract content from the result
        const content = (
          result.content as Array<{
            type: string;
            text?: string;
            data?: string;
            resource?: { uri: string };
          }>
        )
          .map((item) => {
            if (item.type === 'text') {
              return item.text;
            } else if (item.type === 'image') {
              return `[Image: ${item.data}]`;
            } else if (item.type === 'resource') {
              return `[Resource: ${item.resource?.uri}]`;
            }
            return '[Unknown content type]';
          })
          .join('\n');

        logMcpTool(serverName, mcpTool.name, 'INFO', 'Tool executed successfully', {
          args,
          resultLength: content.length,
        });

        return content;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        logMcpTool(serverName, mcpTool.name, 'ERROR', 'Tool execution exception', {
          error: errorMessage,
          args,
        });

        return 'Error: ' + errorMessage;
      }
    },
  });

  // Add metadata as properties on the tool object
  return Object.assign(aiTool, {
    serverName,
    toolName: mcpTool.name,
  });
}
