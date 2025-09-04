/**
 * Unit tests for Agent Spawning Tool Calls functionality
 * Tests the agent spawning server's ability to spawn agents and record tool calls
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { runAgent } from '../agent/index.js';
import { initializeAgentSession } from '../agentSession.js';
import { createRuntimeConfiguration } from '../config/index.js';
import { AgentResult } from '../types/index.js';

vi.mock('../agent/index.js', () => ({
  runAgent: vi.fn(),
}));

vi.mock('../agentSession.js', () => ({
  initializeAgentSession: vi.fn(),
  cleanupAgentSession: vi.fn(),
}));

vi.mock('../config/index.js', () => ({
  createRuntimeConfiguration: vi.fn(),
}));

const mockServer = {
  tool: vi.fn(),
};

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn(() => mockServer),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

// Import the function we're testing after mocking
import { createAgentSpawnerServer } from './agentSpawnerServer.js';

describe('Agent Spawning Tool Calls Test', () => {
  const mockRunAgent = runAgent as Mock;
  const mockInitializeAgentSession = initializeAgentSession as Mock;
  const mockCreateRuntimeConfiguration = createRuntimeConfiguration as Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful agent session initialization
    mockInitializeAgentSession.mockResolvedValue({
      model: 'mock-model',
      tools: {},
      systemPrompt: 'Test system prompt',
      mcpClients: [],
    });

    // Mock successful config creation
    mockCreateRuntimeConfiguration.mockResolvedValue({
      config: {
        agent: {
          maxSteps: 10,
          systemPrompt: {
            mode: 'replace',
            value: 'default prompt',
          },
        },
        providers: {
          default: 'openrouter',
        },
      },
    });
  });

  it('should record tool calls when spawning agents', async () => {
    // Mock successful agent execution with tool calls
    const mockAgentResult: AgentResult = {
      success: true,
      response: 'Agent spawned successfully and executed task',
      toolCallsCount: 3,
      executionTime: 1500,
    };

    mockRunAgent.mockResolvedValue(mockAgentResult);

    // Create the server and get the tool handler
    createAgentSpawnerServer();
    const toolHandler = mockServer.tool.mock.calls[0][2];

    // Call the tool handler (simulates MCP tool call)
    const result = await toolHandler({
      message: 'Use the spawn_agent tool to create a new agent instance',
    });

    const outerJson = JSON.parse(result.content[0].text);
    const innerJson = JSON.parse(outerJson.result);

    // Assertions on the inner response
    expect(outerJson.success).toBe(true);
    expect(outerJson.exitCode).toBe(0);
    expect(innerJson.success).toBe(true);
    expect(innerJson.toolCallsCount).toBe(3);
    expect(innerJson.toolCallsCount).toBeGreaterThan(0);
    expect(innerJson.executionTime).toBeGreaterThan(0);

    // Verify agent functions were called
    expect(mockInitializeAgentSession).toHaveBeenCalled();
    expect(mockRunAgent).toHaveBeenCalledWith(
      'Use the spawn_agent tool to create a new agent instance',
      expect.objectContaining({
        agent: expect.objectContaining({
          maxSteps: 10,
          systemPrompt: expect.objectContaining({
            mode: 'replace',
            value: 'default prompt',
          }),
        }),
        providers: expect.objectContaining({
          default: 'openrouter',
        }),
      }),
      expect.objectContaining({
        mcpClients: expect.any(Array),
        model: 'mock-model',
        systemPrompt: 'Test system prompt',
        tools: expect.any(Object),
      }),
      false
    );
  }, 10000); // 10 second timeout for unit test

  it('should track tool call details in agent responses', async () => {
    // Mock successful agent execution with multiple tool calls
    const mockAgentResult: AgentResult = {
      success: true,
      response: 'Two agents spawned successfully',
      toolCallsCount: 5, // Multiple tool calls for spawning two agents
      executionTime: 2000,
    };

    mockRunAgent.mockResolvedValue(mockAgentResult);

    // Create the server and get the tool handler
    createAgentSpawnerServer();
    const toolHandler = mockServer.tool.mock.calls[0][2];

    // Call the tool handler
    const result = await toolHandler({
      message:
        'Use spawn_agent tool twice to create two different agent instances',
    });

    const outerJson = JSON.parse(result.content[0].text);
    const innerJson = JSON.parse(outerJson.result);

    // Verify we have tool calls when agents are spawned
    expect(outerJson.success).toBe(true);
    expect(outerJson.exitCode).toBe(0);
    expect(innerJson.success).toBe(true);
    expect(innerJson.toolCallsCount).toBe(5);
    expect(innerJson.toolCallsCount).toBeGreaterThan(0);

    // Verify the agent was called with the correct message
    expect(mockRunAgent).toHaveBeenCalledWith(
      'Use spawn_agent tool twice to create two different agent instances',
      expect.objectContaining({
        agent: expect.objectContaining({
          maxSteps: 10,
          systemPrompt: expect.objectContaining({
            mode: 'replace',
            value: 'default prompt',
          }),
        }),
        providers: expect.objectContaining({
          default: 'openrouter',
        }),
      }),
      expect.objectContaining({
        mcpClients: expect.any(Array),
        model: 'mock-model',
        systemPrompt: 'Test system prompt',
        tools: expect.any(Object),
      }),
      false
    );
  }, 10000); // 10 second timeout for unit test

  it('should handle agent initialization failure', async () => {
    // Mock failed agent initialization
    mockInitializeAgentSession.mockRejectedValue(
      new Error('Agent initialization failed')
    );

    // Create the server and get the tool handler
    createAgentSpawnerServer();
    const toolHandler = mockServer.tool.mock.calls[0][2];

    const result = await toolHandler({
      message: 'Test task',
    });

    const outerJson = JSON.parse(result.content[0].text);
    const innerJson = JSON.parse(outerJson.result);

    // Should return error result (but outer is still success since the tool call worked)
    expect(outerJson.success).toBe(true);
    expect(outerJson.exitCode).toBe(1);
    expect(innerJson.success).toBe(false);
    expect(innerJson.error).toContain('Agent initialization failed');

    // runAgent should not be called if initialization fails
    expect(mockRunAgent).not.toHaveBeenCalled();
  }, 10000);

  it('should handle agent execution failure', async () => {
    // Mock successful initialization but failed execution
    mockRunAgent.mockResolvedValue({
      success: false,
      error: 'Task execution failed',
      toolCallsCount: 1,
      executionTime: 500,
    });

    // Create the server and get the tool handler
    createAgentSpawnerServer();
    const toolHandler = mockServer.tool.mock.calls[0][2];

    const result = await toolHandler({
      message: 'Test task that fails',
    });

    const outerJson = JSON.parse(result.content[0].text);
    const innerJson = JSON.parse(outerJson.result);
    expect(outerJson.success).toBe(true);
    expect(outerJson.exitCode).toBe(1);
    expect(innerJson.success).toBe(false);
    expect(innerJson.toolCallsCount).toBe(1);
  }, 10000);

  it('should apply custom system prompt when provided', async () => {
    const mockAgentResult: AgentResult = {
      success: true,
      response: 'Task completed with custom prompt',
      toolCallsCount: 2,
      executionTime: 1000,
    };

    mockRunAgent.mockResolvedValue(mockAgentResult);

    // Create the server and get the tool handler
    createAgentSpawnerServer();
    const toolHandler = mockServer.tool.mock.calls[0][2];

    await toolHandler({
      message: 'Test task',
      systemPrompt: 'You are a specialized test assistant',
    });

    // Verify runAgent was called with modified config that includes the custom prompt
    expect(mockRunAgent).toHaveBeenCalledWith(
      'Test task',
      expect.objectContaining({
        agent: expect.objectContaining({
          systemPrompt: {
            mode: 'append',
            value: 'You are a specialized test assistant',
          },
        }),
      }),
      expect.objectContaining({
        mcpClients: expect.any(Array),
        model: 'mock-model',
        systemPrompt: 'Test system prompt',
        tools: expect.any(Object),
      }),
      false
    );
  }, 10000);

  it('should handle timeout parameter', async () => {
    const mockAgentResult: AgentResult = {
      success: true,
      response: 'Task completed within timeout',
      toolCallsCount: 1,
      executionTime: 800,
    };

    mockRunAgent.mockResolvedValue(mockAgentResult);

    // Create the server and get the tool handler
    createAgentSpawnerServer();
    const toolHandler = mockServer.tool.mock.calls[0][2];

    await toolHandler({
      message: 'Test task',
      timeout: 300,
    });

    // Verify runAgent was called with modified config that includes the timeout as maxSteps
    expect(mockRunAgent).toHaveBeenCalledWith(
      'Test task',
      expect.objectContaining({
        agent: expect.objectContaining({
          maxSteps: 300,
        }),
      }),
      expect.objectContaining({
        mcpClients: expect.any(Array),
        model: 'mock-model',
        systemPrompt: 'Test system prompt',
        tools: expect.any(Object),
      }),
      false
    );
  }, 10000);
});
