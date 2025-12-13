/**
 * Unit tests for built-in spawn agent tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ToolCallOptions } from 'ai';
import { createSpawnAgentTool } from './spawnAgent.js';
import type { RuntimeConfiguration } from '../config/types.js';
import type { Tool } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

// Mock the dependencies
vi.mock('../agent/index.js', () => ({
  runAgent: vi.fn(),
}));

vi.mock('../agentSession.js', () => ({
  initializeAgentSession: vi.fn(),
  cleanupAgentSession: vi.fn(),
}));

import { runAgent } from '../agent/index.js';
import {
  initializeAgentSession,
  cleanupAgentSession,
} from '../agentSession.js';

describe('spawn agent tool', () => {
  let tools: Record<string, Tool>;
  let mockConfig: RuntimeConfiguration;

  beforeEach(() => {
    // Create mock config
    mockConfig = {
      agent: {
        maxSteps: 50,
      },
    } as RuntimeConfiguration;

    // Create tools
    tools = createSpawnAgentTool(mockConfig);

    // Reset mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(initializeAgentSession).mockResolvedValue({
      model: {} as LanguageModelV2,
      tools: {},
      systemPrompt: '',
      mcpClients: [],
      authInfo: {
        method: 'api-key',
        source: 'environment',
        details: {},
      },
      provider: {
        name: 'anthropic',
      },
    });

    vi.mocked(runAgent).mockResolvedValue({
      success: true,
      response: 'Test response',
      toolCallsCount: 0,
      executionTime: 100,
    });

    vi.mocked(cleanupAgentSession).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('spawn_agent', () => {
    it('should execute with basic message', async () => {
      const spawnAgent = tools.spawn_agent;
      const result = await spawnAgent.execute?.(
        {
          message: 'Test message',
        },
        {} as ToolCallOptions
      );

      // Parse JSON result
      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(true);
      expect(parsed.response).toBe('Test response');
      expect(parsed.toolCallsCount).toBe(0);
      expect(parsed.executionTime).toBeGreaterThanOrEqual(0);

      // Verify agent was initialized and cleaned up
      expect(initializeAgentSession).toHaveBeenCalledTimes(1);
      expect(runAgent).toHaveBeenCalledTimes(1);
      expect(cleanupAgentSession).toHaveBeenCalledTimes(1);
    });

    it('should use the same system prompt as parent', async () => {
      const spawnAgent = tools.spawn_agent;
      await spawnAgent.execute?.(
        {
          message: 'Test message',
        },
        {} as ToolCallOptions
      );

      // Verify system prompt is unchanged from parent config
      const configArg = vi.mocked(initializeAgentSession).mock.calls[0][0];
      expect(configArg.agent.systemPrompt).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(runAgent).mockRejectedValue(new Error('Test error'));

      const spawnAgent = tools.spawn_agent;
      const result = await spawnAgent.execute?.(
        {
          message: 'Test message',
        },
        {} as ToolCallOptions
      );

      // Parse JSON result
      const parsed = JSON.parse(result as string);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Test error');
      expect(parsed.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup even on error', async () => {
      vi.mocked(runAgent).mockRejectedValue(new Error('Test error'));

      const spawnAgent = tools.spawn_agent;
      await spawnAgent.execute?.(
        {
          message: 'Test message',
        },
        {} as ToolCallOptions
      );

      // Verify cleanup was called despite error
      expect(cleanupAgentSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('tool structure', () => {
    it('should have spawn_agent tool', () => {
      expect('spawn_agent' in tools).toBe(true);
    });

    it('should have proper structure', () => {
      const tool = tools.spawn_agent;
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(tool).toHaveProperty('execute');
    });

    it('should NOT have MCP metadata', () => {
      const tool = tools.spawn_agent as Tool & {
        serverName?: string;
        toolName?: string;
      };
      expect(tool.serverName).toBeUndefined();
      expect(tool.toolName).toBeUndefined();
    });
  });
});
