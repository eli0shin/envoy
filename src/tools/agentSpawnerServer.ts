#!/usr/bin/env node

/**
 * Agent Spawner MCP Server
 * Provides MCP tool for spawning agent instances
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runAgent } from '../agent/index.js';
import {
  initializeAgentSession,
  cleanupAgentSession,
} from '../agentSession.js';
import { createRuntimeConfiguration } from '../config/index.js';
import { SpawnAgentParams } from '../types/index.js';
import { CLIOptions } from '../types/index.js';
import { RuntimeConfiguration } from '../config/types.js';

/**
 * Gets the runtime configuration from environment variables
 * Falls back to using the same configuration resolution as the main process
 */
async function getRuntimeConfiguration(): Promise<RuntimeConfiguration> {
  const configJson = process.env.AGENT_RUNTIME_CONFIG;

  if (configJson) {
    try {
      return JSON.parse(configJson) as RuntimeConfiguration;
    } catch (error) {
      process.stderr.write(
        `Failed to parse AGENT_RUNTIME_CONFIG, falling back to configuration resolution: ${error}\n`
      );
    }
  }

  // Fallback to using the same configuration resolution as the main process
  // This ensures consistency by using the user's configuration files
  // This should only happen in test scenarios or edge cases
  const configResult = await createRuntimeConfiguration({
    logLevel: 'SILENT',
    logProgress: 'none',
    json: true,
    stdin: false,
    maxSteps: 10,
  } as CLIOptions);
  return configResult.config;
}

/**
 * Creates and configures the MCP server
 */
function createAgentSpawnerServer(): McpServer {
  const server = new McpServer(
    {
      name: 'agent-spawner',
      version: '1.0.0',
    },
    {
      instructions:
        'Use the spawn_agent tool to execute additional agent instances for complex multi-step tasks or when you need parallel processing. Provide a clear message, optionally customize the systemPrompt for specialized behavior, and set timeout if needed. Ideal for breaking down complex workflows, parallel research tasks, or when you need different agent configurations for different subtasks.',
    }
  );

  // Add the spawn_agent tool using the modern pattern
  server.tool(
    'spawn_agent',
    {
      message: z.string().min(1, 'Message cannot be empty'),
      systemPrompt: z.string().optional(),
      timeout: z.number().int().positive().optional(),
    },
    async ({ message, systemPrompt, timeout }) => {
      try {
        const result = await spawnAndRunAgent({
          message,
          systemPrompt,
          timeout,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                result: result.output,
                executionTime: result.executionTime,
                exitCode: result.exitCode,
              }),
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to spawn agent';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: errorMessage,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

/**
 * Runs an agent directly using the runAgent function instead of spawning a new process.
 * This is more efficient than process spawning and avoids CLI parsing overhead.
 */
async function spawnAndRunAgent(params: SpawnAgentParams): Promise<{
  output: string;
  executionTime: number;
  exitCode: number;
}> {
  const startTime = Date.now();

  try {
    // Get the runtime configuration from environment or use defaults
    let runtimeConfig = await getRuntimeConfiguration();

    // Apply custom system prompt if provided
    if (params.systemPrompt) {
      runtimeConfig = {
        ...runtimeConfig,
        agent: {
          ...runtimeConfig.agent,
          systemPrompt: {
            mode: 'append',
            value: params.systemPrompt,
          },
        },
      };
    }

    // Set up maxSteps based on timeout, or use default
    const maxSteps = params.timeout || runtimeConfig.agent.maxSteps || 100;
    runtimeConfig = {
      ...runtimeConfig,
      agent: {
        ...runtimeConfig.agent,
        maxSteps: maxSteps,
      },
    };

    // Initialize agent session
    const agentSession = await initializeAgentSession(runtimeConfig);

    let result;
    try {
      // Run the agent with initialized session
      result = await runAgent(
        params.message,
        runtimeConfig,
        agentSession,
        false
      );
    } finally {
      // Cleanup session resources
      await cleanupAgentSession(agentSession);
    }

    const executionTime = Date.now() - startTime;

    // Format output as JSON (similar to CLI JSON output)
    const output = JSON.stringify({
      success: result.success,
      response: result.response,
      toolCallsCount: result.toolCallsCount,
      executionTime: result.executionTime,
    });

    return {
      output,
      executionTime,
      exitCode: result.success ? 0 : 1,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Return error in JSON format
    const output = JSON.stringify({
      success: false,
      error: errorMessage,
      executionTime,
    });

    return {
      output,
      executionTime,
      exitCode: 1,
    };
  }
}

/**
 * Main execution
 */
async function main() {
  const server = createAgentSpawnerServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('Agent Spawner MCP Server started\n');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(
      `Failed to start Agent Spawner MCP Server: ${error}\n`
    );
    process.exit(1);
  });
}

export { createAgentSpawnerServer };
