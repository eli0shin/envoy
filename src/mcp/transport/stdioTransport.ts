/**
 * Stdio Transport Module
 * Creates MCP clients for stdio transport with stderr logging support and child process tracking
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ChildProcess } from 'child_process';
import type { StdioMCPServerConfig } from '../../types/index.js';
import { resolveCommand } from './commandResolver.js';
import { logMcpTool } from '../../logger.js';

/**
 * Sets up stderr logging for a child process
 * Extracted for testability
 */
export function setupStderrLogging(
  childProcess: ChildProcess,
  serverName: string
): void {
  if (!childProcess?.stderr) {
    return;
  }

  const stderrStream = childProcess.stderr;
  let stderrBuffer = '';

  stderrStream.on('data', (data: Buffer) => {
    stderrBuffer += data.toString();

    // Log complete lines to avoid partial messages
    const lines = stderrBuffer.split('\n');
    stderrBuffer = lines.pop() || ''; // Keep the last incomplete line

    for (const line of lines) {
      if (line.trim()) {
        logMcpTool(serverName, 'stderr', 'INFO', line.trim());
      }
    }
  });

  stderrStream.on('end', () => {
    // Log any remaining buffer content
    if (stderrBuffer.trim()) {
      logMcpTool(serverName, 'stderr', 'INFO', stderrBuffer.trim());
    }
  });
}

/**
 * Creates client info from server config
 * Extracted for testability
 */
export function createClientInfo(config: StdioMCPServerConfig) {
  return {
    name: `envoy-${config.name}`,
    version: '1.0.0',
  };
}

/**
 * Creates client capabilities
 * Extracted for testability
 */
export function createClientCapabilities() {
  return {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
    },
  };
}

/**
 * Creates transport configuration from server config and resolved command
 * Extracted for testability
 */
export function createTransportConfig(
  config: StdioMCPServerConfig,
  resolvedCommand: string
) {
  return {
    command: resolvedCommand,
    args: config.args || [],
    env: config.env,
    cwd: config.cwd,
    stderr: 'pipe' as const,
  };
}

/**
 * Extracts child process from transport
 * Extracted for testability
 */
export function extractChildProcess(
  transport: StdioClientTransport
): ChildProcess | undefined {
  const transportWithProcess = transport as unknown as {
    _process?: ChildProcess & { stderr?: NodeJS.ReadableStream };
  };
  return transportWithProcess._process;
}

/**
 * Creates an MCP client for stdio transport and returns the child process for cleanup tracking
 */
export async function createStdioClient(
  config: StdioMCPServerConfig
): Promise<{ client: Client; childProcess?: ChildProcess }> {
  // Resolve command to full path using shell environment
  const resolvedCommand = await resolveCommand(config.command);

  // Create transport
  const transportConfig = createTransportConfig(config, resolvedCommand);
  const transport = new StdioClientTransport(transportConfig);

  // Create client
  const clientInfo = createClientInfo(config);
  const clientCapabilities = createClientCapabilities();
  const client = new Client(clientInfo, clientCapabilities);

  // Connect
  await client.connect(transport);

  // Extract child process reference for cleanup tracking
  const childProcess = extractChildProcess(transport);

  // Set up stderr logging
  if (childProcess) {
    setupStderrLogging(childProcess, config.name);
  }

  return { client, childProcess };
}
