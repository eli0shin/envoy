/**
 * SSE Transport Module
 * Creates MCP clients for Server-Sent Events transport
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { ChildProcess } from 'child_process';
import type { SSEMCPServerConfig } from '../../types/index.js';

/**
 * Creates an MCP client for SSE transport (no child process for SSE)
 */
export async function createSSEClient(
  config: SSEMCPServerConfig
): Promise<{ client: Client; childProcess?: ChildProcess }> {
  const transport = new SSEClientTransport(new URL(config.url));

  const client = new Client(
    {
      name: `envoy-${config.name}`,
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  );

  await client.connect(transport);
  // SSE transport doesn't have a child process, so childProcess is undefined
  return { client, childProcess: undefined };
}
