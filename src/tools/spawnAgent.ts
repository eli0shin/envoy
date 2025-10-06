/**
 * Built-in Spawn Agent Tool
 * Provides agent spawning functionality as a native AI SDK tool
 */

import { tool } from 'ai';
import { z } from 'zod/v3';
import { runAgent } from '../agent/index.js';
import {
  initializeAgentSession,
  cleanupAgentSession,
} from '../agentSession.js';
import type { RuntimeConfiguration } from '../config/types.js';

/**
 * Creates the spawn agent tool using AI SDK's tool() helper
 */
export function createSpawnAgentTool(runtimeConfig: RuntimeConfiguration) {
  const spawnAgent = tool({
    description:
      'Use the spawn_agent tool to execute additional agent instances for complex multi-step tasks or when you need parallel processing. The spawned agent uses the same system prompt and configuration as the parent agent. Ideal for breaking down complex workflows, parallel research tasks, or delegating subtasks.',
    inputSchema: z.object({
      message: z.string().min(1, 'Message cannot be empty'),
    }),
    execute: async ({ message }) => {
      const startTime = Date.now();

      try {
        // Initialize agent session with runtime config
        const agentSession = await initializeAgentSession(runtimeConfig);

        let result;
        try {
          // Run the agent with initialized session
          result = await runAgent(
            message,
            runtimeConfig,
            agentSession,
            false,
            undefined,
            undefined
          );
        } finally {
          // Always cleanup
          await cleanupAgentSession(agentSession);
        }

        const executionTime = Date.now() - startTime;

        return JSON.stringify({
          success: result.success,
          response: result.response,
          toolCallsCount: result.toolCallsCount,
          executionTime,
        });
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        return JSON.stringify({
          success: false,
          error: errorMessage,
          executionTime,
        });
      }
    },
  });

  return {
    spawn_agent: spawnAgent,
  };
}
