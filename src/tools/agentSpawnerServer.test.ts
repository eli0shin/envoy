/**
 * Tests for AgentSpawnerServer MCP Server
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAgentSpawnerServer } from './agentSpawnerServer.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Mock child_process
const mockChild = {
  stdout: {
    on: vi.fn(),
  },
  stderr: {
    on: vi.fn(),
  },
  on: vi.fn(),
  kill: vi.fn(),
};

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockChild),
}));

// Mock the MCP SDK
const mockServer = {
  tool: vi.fn(),
  connect: vi.fn(),
};

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn(() => mockServer),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

// Mock config and agent functions
vi.mock('./config/index.js', () => ({
  createRuntimeConfiguration: vi.fn().mockResolvedValue({
    config: {
      agent: {
        maxSteps: 100,
        systemPrompt: { mode: 'append', value: '' },
      },
    },
  }),
}));

vi.mock('../agent/index.js', () => ({
  runAgent: vi.fn().mockResolvedValue({
    output: 'Test output',
    executionTime: 100,
    exitCode: 0,
  }),
}));

vi.mock('../agentSession.js', () => ({
  initializeAgentSession: vi.fn(),
  cleanupAgentSession: vi.fn(),
}));

describe('AgentSpawnerServer', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Tool Registration', () => {
    it('should register spawn_agent tool', () => {
      createAgentSpawnerServer();

      expect(mockServer.tool).toHaveBeenCalledWith(
        'spawn_agent',
        expect.objectContaining({
          message: expect.any(Object),
          systemPrompt: expect.any(Object),
          timeout: expect.any(Object),
        }),
        expect.any(Function)
      );
    });
  });

  describe('spawn_agent tool', () => {
    it('should spawn agent with valid parameters', async () => {
      createAgentSpawnerServer();

      // Get the tool handler function
      const toolHandler = mockServer.tool.mock.calls[0][2];

      const result = await toolHandler({
        message: 'Test task',
        systemPrompt: 'You are a test assistant',
        timeout: 300,
      });

      expect(result.content[0].text).toContain('success');
      expect(result.content[0].text).toContain('result');
    });

    it('should handle validation errors for missing required parameters', async () => {
      createAgentSpawnerServer();

      // Get the tool handler function
      const toolHandler = mockServer.tool.mock.calls[0][2];

      try {
        await toolHandler({
          // missing message
          timeout: 300,
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Zod validation should throw
        expect(error).toBeDefined();
      }
    });
  });

  describe('Server lifecycle', () => {
    it('should connect to transport', async () => {
      const server = createAgentSpawnerServer();
      const transport = new StdioServerTransport();

      await server.connect(transport);

      expect(mockServer.connect).toHaveBeenCalledWith(transport);
    });
  });
});
