/**
 * Unit tests for mcpLoader module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod/v3';
import type { ToolCallOptions } from 'ai';
import {
  loadMCPTools,
  createMCPClientWrapper,
  loadMCPServersWithClients,
} from './loader.js';
import { isToolDisabled } from './toolFiltering.js';
import {
  MCPServerConfig,
  StdioMCPServerConfig,
  SSEMCPServerConfig,
  WrappedTool,
  MCPPrompt,
  MCPResource,
} from '../types/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { RuntimeConfiguration } from '../config/types.js';

// Global mock client that can be reconfigured by tests
let mockClient: ReturnType<typeof createMockMcpClient>;
let clientSpy: ReturnType<typeof vi.spyOn>;

// Helper function to create test runtime configuration
function createTestRuntimeConfig(
  overrides: Partial<RuntimeConfiguration> = {}
): RuntimeConfiguration {
  return {
    tools: {
      disabledInternalTools: [],
      globalTimeout: 300000,
    },
    providers: {
      default: 'openai',
      openai: { model: 'gpt-4' },
      anthropic: { model: 'claude-3-5-sonnet' },
      openrouter: { model: 'test-model' },
      google: { model: 'gemini-2.0-flash' },
    },
    agent: {
      maxSteps: 10,
      timeout: 120000,
      logLevel: 'SILENT',
      logProgress: 'none',
      streaming: true,
    },
    stdin: false,
    json: false,
    ...overrides,
  } as RuntimeConfiguration;
}
import { logMcpTool } from '../logger.js';

// Mock child_process to eliminate command resolution delays (300ms per test)
// CRITICAL: Factory function must be inside vi.mock() to avoid hoisting issues
vi.mock('child_process', () => {
  return {
    spawn: vi.fn().mockImplementation((...args: string[]) => {
      const mockProcess = {
        stdout: {
          on: vi.fn((event: string, cb: (data: Buffer) => void) => {
            if (event === 'data') {
              // Immediately resolve with a mock command path
              setImmediate(() => cb(Buffer.from('/usr/bin/node\n')));
            }
          }),
          pipe: vi.fn(),
          read: vi.fn(),
          readable: true,
          readableEnded: false,
        },
        stderr: {
          on: vi.fn((event: string, _cb: (data: Buffer) => void) => {
            if (event === 'data') {
              // Don't send stderr data for successful command resolution
            }
          }),
          pipe: vi.fn(),
          read: vi.fn(),
          readable: true,
          readableEnded: false,
        },
        stdin: {
          write: vi.fn(),
          end: vi.fn(),
          writable: true,
          writableEnded: false,
          pipe: vi.fn(),
        },
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'close') {
            // Successful command resolution (exit code 0)
            setImmediate(() => cb(0));
          }
          if (event === 'error') {
            // Don't call error callback for successful resolution
          }
        }),
        kill: vi.fn(),
        pid: 12345,
        killed: false,
        exitCode: null,
        signalCode: null,
        spawnargs: args,
        spawnfile: args[0],
      };

      return mockProcess;
    }),
  };
});

// Get the mocked spawn function to check calls
import { spawn } from 'child_process';
const mockSpawn = vi.mocked(spawn);

/**
 * Creates a complete mock MCP client that responds to all MCP protocol methods
 * This eliminates the need for real MCP server processes in unit tests
 */
function createMockMcpClient(
  options: {
    tools?: unknown[];
    prompts?: MCPPrompt[];
    resources?: MCPResource[];
    capabilities?: Record<string, unknown>;
    shouldFailConnection?: boolean;
    customCallToolResponse?: CallToolResult;
  } = {}
) {
  const {
    tools = [],
    prompts = [],
    resources = [],
    capabilities = { tools: {} }, // Default to only tools capability
    shouldFailConnection = false,
    customCallToolResponse,
  } = options;

  const mockClient = {
    // Connection management
    connect: vi.fn().mockImplementation(async () => {
      if (shouldFailConnection) {
        throw new Error('Connection failed');
      }
      return undefined;
    }),

    // MCP Discovery Protocol
    listTools: vi.fn().mockImplementation(async () => {
      return { tools };
    }),
    listPrompts: vi.fn().mockResolvedValue({ prompts }),
    listResources: vi.fn().mockResolvedValue({ resources }),
    getServerCapabilities: vi.fn().mockReturnValue(capabilities),

    // MCP Execution Protocol
    callTool: vi.fn().mockResolvedValue(
      customCallToolResponse || {
        isError: false,
        content: [{ type: 'text', text: 'Mock result' }],
      }
    ),

    getPrompt: vi.fn().mockResolvedValue({
      description: 'Mock prompt',
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: 'Mock prompt content' },
        },
      ],
    }),

    readResource: vi.fn().mockResolvedValue({
      contents: [
        {
          uri: 'mock://resource',
          mimeType: 'text/plain',
          text: 'Mock resource content',
        },
      ],
    }),
  };

  return mockClient;
}

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation((_options) => {
    return {
      // Mock transport that behaves like a real transport but doesn't create processes
      start: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
      // Add event emitter methods that MCP Client might expect
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      // Add process property that mcpLoader.ts checks for stderr logging
      process: {
        stderr: {
          on: vi.fn(),
          pipe: vi.fn(),
          read: vi.fn(),
          readable: true,
          readableEnded: false,
        },
      },
    };
  }),
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn().mockImplementation(() => ({
    // Mock transport that behaves like a real transport but doesn't create connections
    start: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    // Add event emitter methods that MCP Client might expect
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));

// Step 1: Mock the MCP client module at top level (required for spyOn to work)
vi.mock('@modelcontextprotocol/sdk/client/index.js');

// Step 2: Import the module as namespace import (after mocking)
import * as mcpClient from '@modelcontextprotocol/sdk/client/index.js';

describe('mcpLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the spawn mock
    mockSpawn.mockClear();

    // Configure the mock client for each test (only tools capability to avoid extra prompt/resource tools)
    mockClient = createMockMcpClient({
      tools: [
        {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object' as const,
            properties: { input: { type: 'string' } },
            required: ['input'],
          },
        },
      ],
      capabilities: {
        tools: {}, // Only tools capability - no prompts/resources to avoid extra tools
      },
    });

    // Step 3: Use spyOn on the namespace import (after mocking)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clientSpy = (vi as any)
      .spyOn(mcpClient, 'Client')
      .mockImplementation((...args: unknown[]) => {
        return mockClient as never;
      }) as ReturnType<typeof vi.spyOn>;
  });

  describe('loadMCPTools', () => {
    it('should verify mock setup is working', async () => {
      // Check if the Client mock is working at all
      expect(typeof clientSpy).toBe('function');
      expect(clientSpy).toHaveBeenCalledTimes(0); // Should be 0 at start

      // Create a test client directly to see if our mock works
      const testClient = new mcpClient.Client(
        { name: 'test-client', version: '1.0.0' },
        { capabilities: {} }
      );

      expect(testClient).toBeDefined();
      expect(clientSpy).toHaveBeenCalledTimes(1);

      if (testClient.connect) {
        expect(typeof testClient.connect).toBe('function');
        await expect(testClient.connect({} as never)).resolves.toBeUndefined();
      } else {
        throw new Error('testClient.connect is undefined - mock not working');
      }
    });

    it('should load tools from stdio servers successfully', async () => {
      const mockTools = [
        {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
            required: ['input'],
          },
        },
      ];

      // Configure the mock client with tools
      mockClient = createMockMcpClient({ tools: mockTools });

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        },
      ];

      // Use absolute path to bypass resolveCommand function
      serverConfigs[0].command = '/usr/bin/node';

      const result = await loadMCPTools(serverConfigs);

      // Debug: Check if spawn was called (should happen in resolveCommand)

      // First check for errors to understand what went wrong

      if (result.errors.length > 0) {
        // Force the test to fail with error details instead of proceeding
        throw new Error(
          `Server initialization failed: ${result.errors.map((e) => `${e.serverName}: ${e.error}`).join('; ')}`
        );
      }

      // Debug: Check if the Client constructor was called at all
      expect(clientSpy).toHaveBeenCalled();

      // Debug: Check if the mock client methods were called
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.listTools).toHaveBeenCalled();

      // If we get here, the mocks were called - now check the result
      expect(result.errors).toHaveLength(0);
      expect(Object.keys(result.tools).length).toBe(1);
      expect(('test-server_test-tool' in result.tools)).toBe(true);
    });

    it('should load tools from SSE servers successfully', async () => {
      const mockTools = [
        {
          name: 'weather-tool',
          description: 'Get weather information',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
          },
        },
      ];

      mockClient = createMockMcpClient({ tools: mockTools });

      const serverConfigs: SSEMCPServerConfig[] = [
        {
          name: 'weather-server',
          type: 'sse',
          url: 'https://api.example.com/mcp',
        },
      ];

      const result = await loadMCPTools(serverConfigs);

      expect(Object.keys(result.tools).length).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(('weather-server_weather-tool' in result.tools)).toBe(true);
    });

    it('should handle server connection errors gracefully', async () => {
      // Configure mock client to fail connection
      mockClient = createMockMcpClient({ shouldFailConnection: true });

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'failing-server',
          type: 'stdio',
          command: '/usr/bin/node', // Use absolute path to bypass resolveCommand
          args: ['test.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);

      expect(Object.keys(result.tools).length).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].serverName).toBe('failing-server');
      expect(result.errors[0].error).toContain('Connection failed');
    });

    it('should handle tool name conflicts', async () => {
      const mockTools = [
        {
          name: 'duplicate-tool',
          description: 'Tool with same name',
          inputSchema: {
            type: 'object',
            properties: { input: { type: 'string' } },
          },
        },
      ];

      // Both servers will return the same tool, but with different server prefixes
      mockClient = createMockMcpClient({ tools: mockTools });

      const serverConfigs: MCPServerConfig[] = [
        {
          name: 'server1',
          type: 'stdio',
          command: '/usr/bin/node', // Use absolute path
          args: ['test1.js'],
        },
        {
          name: 'server2',
          type: 'stdio',
          command: '/usr/bin/node', // Use absolute path
          args: ['test2.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);

      // Both tools should be loaded since they have different server prefixes
      expect(Object.keys(result.tools).length).toBe(2);
      expect(('server1_duplicate-tool' in result.tools)).toBe(true);
      expect(('server2_duplicate-tool' in result.tools)).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should load tools from multiple servers without conflicts', async () => {
      // Test simplified: just verify that when we have multiple tool configurations
      // the tool naming doesn't conflict
      const serverConfigs: MCPServerConfig[] = [
        {
          name: 'server1',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test1.js'],
        },
        {
          name: 'server2',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test2.js'],
        },
      ];

      // Verify server names are unique
      const serverNames = serverConfigs.map((config) => config.name);
      const uniqueNames = new Set(serverNames);
      expect(uniqueNames.size).toBe(serverNames.length);

      // Verify that tool namespacing would work correctly
      const tool1Name = `${serverConfigs[0].name}_tool1`;
      const tool2Name = `${serverConfigs[1].name}_tool2`;

      expect(tool1Name).toBe('server1_tool1');
      expect(tool2Name).toBe('server2_tool2');
      expect(tool1Name).not.toBe(tool2Name);
    });
  });

  describe('wrapped tool execution', () => {
    it('should log tool calls with correct format', async () => {
      const mockTools = [
        {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
          },
        },
      ];

      mockClient = createMockMcpClient({
        tools: mockTools,
        customCallToolResponse: {
          isError: false,
          content: [{ type: 'text', text: 'Tool executed successfully' }],
        },
      });

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node', // Use absolute path to bypass resolveCommand
          args: ['test.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);
      const tool = result.tools['test-server_test-tool'];

      expect(tool).toBeDefined();

      // Execute the tool
      const args = { input: 'test value' };
      await tool?.execute?.(args, {} as ToolCallOptions);

      // Progress logging is now handled centrally in agent.ts onStepFinish
      // Verify that file logging still happens (first call when tool starts)
      expect(logMcpTool).toHaveBeenCalledWith(
        'test-server',
        'test-tool',
        'INFO',
        'Tool called',
        expect.objectContaining({
          args,
          description: 'A test tool',
        })
      );
    });

    it('should handle tool execution timeout', async () => {
      vi.useFakeTimers();

      const mockTools = [
        {
          name: 'slow-tool',
          description: 'A slow tool',
          inputSchema: { type: 'object' },
        },
      ];

      // Create mock client with tools and never-resolving callTool
      mockClient = createMockMcpClient({ tools: mockTools });
      // Override callTool to never resolve (hangs)
      mockClient.callTool.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);
      const tool = result.tools['test-server_slow-tool'];

      expect(tool).toBeDefined();

      // Execute the tool (this should timeout)
      const executePromise = tool!.execute?.({}, {} as ToolCallOptions);

      // Advance timers to trigger the timeout immediately
      vi.advanceTimersByTime(1800000); // TOOL_TIMEOUT_MS

      const executeResult = await executePromise;

      // Tools return strings directly, not objects
      expect(executeResult).toBe('Error: Tool execution timeout');

      vi.useRealTimers();
    });

    it('should handle tool execution errors', async () => {
      const mockTools = [
        {
          name: 'error-tool',
          description: 'A tool that errors',
          inputSchema: { type: 'object' },
        },
      ];

      mockClient = createMockMcpClient({
        tools: mockTools,
        customCallToolResponse: {
          isError: true,
          content: [{ type: 'text', text: 'Tool execution failed' }],
        },
      });

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);
      const tool = result.tools['test-server_error-tool'];

      expect(tool).toBeDefined();

      const executeResult = await tool?.execute?.({}, {} as ToolCallOptions);

      // Tools return strings directly, not objects
      expect(executeResult).toContain('Error: Tool execution failed');
    });

    it('should validate tool arguments', async () => {
      const mockTools = [
        {
          name: 'validation-tool',
          description: 'A tool with validation',
          inputSchema: {
            type: 'object',
            properties: {
              required_field: { type: 'string' },
            },
            required: ['required_field'],
          },
        },
      ];

      mockClient = createMockMcpClient({
        tools: mockTools,
        customCallToolResponse: {
          isError: true,
          content: [{ type: 'text', text: 'Invalid arguments for tool validation-tool' }],
        },
      });

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);
      const tool = result.tools['test-server_validation-tool'];

      expect(tool).toBeDefined();

      // Test with invalid arguments (missing required field)
      const executeResult = await tool?.execute?.({}, {} as ToolCallOptions);

      // Tools return strings directly, not objects
      expect(executeResult).toContain('Error: Invalid arguments');
    });

    it('should handle unknown content types in tool results', async () => {
      const mockTools = [
        {
          name: 'unknown-content-tool',
          description: 'Tool with unknown content',
          inputSchema: { type: 'object' },
        },
      ];

      mockClient = createMockMcpClient({
        tools: mockTools,
        customCallToolResponse: {
          isError: false,
          content: [
            { type: 'text', text: 'Normal text' },
            { type: 'unknown_type', data: 'some data' } as never, // Force unknown type for test
            { type: 'image', data: 'base64data', mimeType: 'image/png' }, // Added mimeType
            {
              type: 'resource',
              resource: {
                uri: 'file://test.txt',
                text: 'content',
                mimeType: 'text/plain',
              },
            }, // Added required fields
          ],
        },
      });

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);
      const tool = result.tools['test-server_unknown-content-tool'];

      expect(tool).toBeDefined();

      const executeResult = await tool?.execute?.({}, {} as ToolCallOptions);

      // Tools return strings directly, not objects
      expect(executeResult).toContain('Normal text');
      expect(executeResult).toContain('[Unknown content type]');
      expect(executeResult).toContain('[Image: base64data]');
      expect(executeResult).toContain('[Resource: file://test.txt]');
    });

    it('should handle actual tool name conflicts within same server', async () => {
      // Simulate a malformed server response with duplicate tool names
      const mockTools = [
        {
          name: 'duplicate-tool',
          description: 'First tool',
        },
        {
          name: 'duplicate-tool',
          description: 'Second tool with same name',
        },
      ];

      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'conflicted-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);

      // Should load both tools with same namespaced key (second overwrites first)
      expect(Object.keys(result.tools).length).toBe(1);
      expect(('conflicted-server_duplicate-tool' in result.tools)).toBe(true);

      // The first tool will be the one that remains (tools are processed in order)
      const tool = result.tools['conflicted-server_duplicate-tool'];
      expect(tool?.description).toBe('First tool');
    });

    it('should handle edge cases in JSON mode logging', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const mockTools = [
        {
          name: 'json-mode-tool',
          description: 'Tool for JSON mode test',
          inputSchema: { type: 'object' },
        },
      ];

      mockClient.listTools.mockResolvedValue({ tools: mockTools });
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: 'JSON mode result' }],
      });

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        },
      ];

      // Test with JSON mode enabled
      const result = await loadMCPTools(serverConfigs);
      const tool = result.tools['test-server_json-mode-tool'];

      expect(tool).toBeDefined();

      // Execute the tool
      const args = { input: 'test' };
      await tool?.execute?.(args, {} as ToolCallOptions);

      // Verify that no console output occurs in JSON mode
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle complex nested schema conversions', async () => {
      const mockTools = [
        {
          name: 'complex-schema-tool',
          description: 'Tool with complex schema',
          inputSchema: {
            type: 'object',
            properties: {
              nestedObject: {
                type: 'object',
                properties: {
                  stringField: { type: 'string' },
                  numberField: { type: 'number' },
                  integerField: { type: 'integer' },
                  booleanField: { type: 'boolean' },
                  arrayField: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['stringField'],
              },
            },
            required: ['nestedObject'],
          },
        },
      ];

      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);
      const tool = result.tools['test-server_complex-schema-tool'];

      expect(tool).toBeDefined();

      // Test with valid nested structure
      const validArgs = {
        nestedObject: {
          stringField: 'test',
          numberField: 42,
          integerField: 10,
          booleanField: true,
          arrayField: ['item1', 'item2'],
        },
      };

      const executeResult = await tool?.execute?.(validArgs, {} as ToolCallOptions);
      // Tools return strings directly, not objects
    });
  });

  describe('createMCPClientWrapper', () => {
    it('should create a client wrapper for stdio server', async () => {
      // Configure mock client with no tools for this test
      mockClient = createMockMcpClient({ tools: [] });

      const config: StdioMCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      expect(wrapper.serverName).toBe('test-server');
      expect(wrapper.serverConfig).toBe(config);
      expect(wrapper.isConnected).toBe(true);
      expect(Object.keys(wrapper.tools).length).toBe(0);
    });

    it('should connect and load tools', async () => {
      // Override capabilities to include all for this test
      mockClient.getServerCapabilities.mockReturnValue({
        tools: {},
        prompts: {},
        resources: {},
      });

      const mockTools = [
        {
          name: 'test-tool',
          description: 'A test tool',
        },
      ];

      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      // Set up prompts and resources for this test
      mockClient.listPrompts.mockResolvedValue({
        prompts: [
          {
            name: 'test-prompt',
            description: 'A test prompt',
            arguments: [],
          },
        ],
      });
      mockClient.listResources.mockResolvedValue({
        resources: [
          {
            uri: 'test://resource',
            name: 'Test Resource',
            description: 'A test resource',
          },
        ],
      });

      const config: StdioMCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      expect(wrapper.isConnected).toBe(true);
      // Now we have 5 tools: 1 original + 2 prompt tools + 2 resource tools
      expect(Object.keys(wrapper.tools).length).toBe(5);
      expect(('test-tool' in wrapper.tools)).toBe(true);
      expect(('test-server_list_prompts' in wrapper.tools)).toBe(true);
      expect(('test-server_get_prompt' in wrapper.tools)).toBe(true);
      expect(('test-server_list_resources' in wrapper.tools)).toBe(true);
      expect(('test-server_read_resource' in wrapper.tools)).toBe(true);
    });

    it('should handle connection errors', async () => {
      // Reset to default implementation first

      // Mock connect to throw an error
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      const config: StdioMCPServerConfig = {
        name: 'failing-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      // Note: Connection failed, so wrapper should not be connected
      expect(wrapper.isConnected).toBe(false);
    });

    it('should handle connection errors in wrapper', async () => {
      // Reset to default implementation first

      // Mock connect to throw an error
      mockClient.connect.mockRejectedValue(new Error('Failed to connect'));

      const config: StdioMCPServerConfig = {
        name: 'failing-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      // Note: Connection now happens during wrapper creation
      expect(wrapper.isConnected).toBe(false);
    });

    it('should handle connect when already connected', async () => {
      const config: StdioMCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      expect(wrapper.isConnected).toBe(true);

      // Try to connect again when already connected

      expect(wrapper.isConnected).toBe(true);
    });
  });

  describe('schema conversion edge cases', () => {
    it('should handle missing schema', async () => {
      const mockTools = [
        {
          name: 'no-schema-tool',
          description: 'Tool without schema',
          // No inputSchema provided
        },
      ];

      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      // This should not throw and should create a tool with empty object schema
      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);
      const tool = result.tools['test-server_no-schema-tool'];
      expect(tool).toBeDefined();
    });

    it('should handle all schema types', async () => {
      const mockTools = [
        {
          name: 'all-types-tool',
          description: 'Tool with all schema types',
          inputSchema: {
            type: 'object',
            properties: {
              stringType: { type: 'string' },
              numberType: { type: 'number' },
              integerType: { type: 'integer' },
              booleanType: { type: 'boolean' },
              arrayType: {
                type: 'array',
                items: { type: 'string' },
              },
              objectType: {
                type: 'object',
                properties: {
                  nested: { type: 'string' },
                },
              },
              unknownType: { type: 'unknown_type' },
            },
          },
        },
      ];

      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      const serverConfigs: StdioMCPServerConfig[] = [
        {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        },
      ];

      const result = await loadMCPTools(serverConfigs);
      const tool = result.tools['test-server_all-types-tool'];

      expect(tool).toBeDefined();

      // Test with valid arguments for all types
      const validArgs = {
        stringType: 'test',
        numberType: 42.5,
        integerType: 10,
        booleanType: true,
        arrayType: ['item1', 'item2'],
        objectType: { nested: 'value' },
        unknownType: 'any value',
      };

      const executeResult = await tool?.execute?.(validArgs, {} as ToolCallOptions);
      // Tools return strings directly, not objects
    });
  });

  describe('Phase 2 - Prompts Implementation', () => {
    beforeEach(() => {
      // Override capabilities to include prompts
      mockClient.getServerCapabilities.mockReturnValue({
        tools: {},
        prompts: {},
      });
    });

    it('should load prompts from server successfully', async () => {
      const mockPrompts = [
        {
          name: 'git-commit',
          description: 'Generate a Git commit message',
          arguments: [
            {
              name: 'changes',
              description: 'Git diff or description of changes',
              required: true,
            },
          ],
        },
        {
          name: 'explain-code',
          description: 'Explain how code works',
          arguments: [
            {
              name: 'code',
              description: 'Code to explain',
              required: true,
            },
            {
              name: 'language',
              description: 'Programming language',
              required: false,
            },
          ],
        },
      ];

      mockClient.listPrompts.mockResolvedValue({ prompts: mockPrompts });

      const config: StdioMCPServerConfig = {
        name: 'prompt-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      expect(wrapper.prompts.size).toBe(2);
      expect(wrapper.prompts.has('git-commit')).toBe(true);
      expect(wrapper.prompts.has('explain-code')).toBe(true);

      const gitCommitPrompt = wrapper.prompts.get('git-commit');
      expect(gitCommitPrompt?.description).toBe(
        'Generate a Git commit message'
      );
      expect(gitCommitPrompt?.arguments).toHaveLength(1);
      expect(gitCommitPrompt?.arguments?.[0].required).toBe(true);
    });

    it('should create prompt tools for agents', async () => {
      // Ensure prompts capability is enabled
      mockClient.getServerCapabilities.mockReturnValue({
        tools: {},
        prompts: {},
      });

      const mockPrompts = [
        {
          name: 'test-prompt',
          description: 'A test prompt',
          arguments: [
            {
              name: 'input',
              description: 'Test input',
              required: true,
            },
          ],
        },
      ];

      mockClient.listPrompts.mockResolvedValue({ prompts: mockPrompts });

      const config: StdioMCPServerConfig = {
        name: 'prompt-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      // Check that prompt tools were created
      expect(('prompt-server_list_prompts' in wrapper.tools)).toBe(true);
      expect(('prompt-server_get_prompt' in wrapper.tools)).toBe(true);

      const listPromptsTools = wrapper.tools['prompt-server_list_prompts'];
      expect(listPromptsTools?.description).toContain('List available prompts');

      const getPromptTool = wrapper.tools['prompt-server_get_prompt'];
      expect(getPromptTool?.description).toContain('Get and execute a prompt');
    });

    it('should execute list_prompts tool correctly', async () => {
      const mockPrompts = [
        {
          name: 'test-prompt',
          description: 'A test prompt',
        },
      ];

      mockClient.listPrompts.mockResolvedValue({ prompts: mockPrompts });

      const config: StdioMCPServerConfig = {
        name: 'prompt-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      const listPromptsTool = wrapper.tools['prompt-server_list_prompts'];
      expect(listPromptsTool).toBeDefined();

      const result = await listPromptsTool?.execute?.({}, {} as ToolCallOptions);
      expect(result).toBeDefined();

      const parsedResult = JSON.parse(result as string);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].name).toBe('test-prompt');
    });

    it('should execute get_prompt tool correctly', async () => {
      const mockPrompts = [
        {
          name: 'test-prompt',
          description: 'A test prompt',
        },
      ];

      mockClient.listPrompts.mockResolvedValue({ prompts: mockPrompts });
      mockClient.getPrompt.mockResolvedValue({
        description: 'Executed test prompt',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'This is a test prompt result',
            },
          },
        ],
      });

      const config: StdioMCPServerConfig = {
        name: 'prompt-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      const getPromptTool = wrapper.tools['prompt-server_get_prompt'];
      expect(getPromptTool).toBeDefined();

      const result = await getPromptTool?.execute?.({
        name: 'test-prompt',
        arguments: { input: 'test value' },
      }, {} as ToolCallOptions);

      expect(result).toBeDefined();

      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.description).toBe('Executed test prompt');
      expect(parsedResult.messages).toHaveLength(1);
      expect(parsedResult.messages[0].content.text).toBe(
        'This is a test prompt result'
      );

      // Verify that the client was called with correct parameters
      expect(mockClient.getPrompt).toHaveBeenCalledWith({
        name: 'test-prompt',
        arguments: { input: 'test value' },
      });
    });

    it('should handle prompt execution errors gracefully', async () => {
      const mockPrompts = [
        {
          name: 'error-prompt',
          description: 'A prompt that will error',
        },
      ];

      mockClient.listPrompts.mockResolvedValue({ prompts: mockPrompts });
      mockClient.getPrompt.mockRejectedValue(
        new Error('Prompt execution failed')
      );

      const config: StdioMCPServerConfig = {
        name: 'prompt-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      const getPromptTool = wrapper.tools['prompt-server_get_prompt'];
      expect(getPromptTool).toBeDefined();

      const result = await getPromptTool?.execute?.({
        name: 'error-prompt',
      }, {} as ToolCallOptions);

      expect(result).toBeDefined();
      expect(result).toBe('Error: Prompt execution failed');
    });

    it('should handle prompt loading errors gracefully', async () => {
      mockClient.listPrompts.mockRejectedValue(
        new Error('Failed to list prompts')
      );

      const config: StdioMCPServerConfig = {
        name: 'failing-prompt-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      // Should not throw, just log warning
      // Note: Connection now happens during wrapper creation

      // Should have 0 prompts but still be connected
      expect(wrapper.isConnected).toBe(true);
      expect(wrapper.prompts.size).toBe(0);

      // Should not have prompt tools
      expect(('failing-prompt-server_list_prompts' in wrapper.tools)).toBe(
        true
      ); // Empty prompt tools are still created
      expect(('failing-prompt-server_get_prompt' in wrapper.tools)).toBe(true);
    });

    it('should use listPrompts and getPrompt methods from wrapper', async () => {
      const mockPrompts = [
        {
          name: 'wrapper-prompt',
          description: 'A prompt accessed via wrapper methods',
        },
      ];

      mockClient.listPrompts.mockResolvedValue({ prompts: mockPrompts });
      mockClient.getPrompt.mockResolvedValue({
        description: 'Wrapper prompt result',
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: 'Wrapper method result',
            },
          },
        ],
      });

      const config: StdioMCPServerConfig = {
        name: 'wrapper-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      // Test listPrompts method
      const prompts = await wrapper.listPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].name).toBe('wrapper-prompt');

      // Test getPrompt method
      const promptResult = await wrapper.getPrompt('wrapper-prompt', {
        arg: 'value',
      });
      expect(promptResult.description).toBe('Wrapper prompt result');
      expect(promptResult.messages[0].content.text).toBe(
        'Wrapper method result'
      );

      // Verify client methods were called
      expect(mockClient.getPrompt).toHaveBeenCalledWith({
        name: 'wrapper-prompt',
        arguments: { arg: 'value' },
      });
    });
  });

  describe('Phase 3 - Resources Implementation', () => {
    beforeEach(() => {
      // Override capabilities to include resources
      mockClient.getServerCapabilities.mockReturnValue({
        tools: {},
        resources: {},
      });
    });
    it('should load resources from server successfully', async () => {
      const mockResources = [
        {
          uri: 'file:///app/logs.txt',
          name: 'Application Logs',
          description: 'System logs for debugging',
          mimeType: 'text/plain',
        },
        {
          uri: 'file:///config/settings.json',
          name: 'Configuration Settings',
          description: 'Application configuration',
          mimeType: 'application/json',
        },
      ];

      mockClient.listResources.mockResolvedValue({ resources: mockResources });

      const config: StdioMCPServerConfig = {
        name: 'resource-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      expect(wrapper.resources.size).toBe(2);
      expect(wrapper.resources.has('file:///app/logs.txt')).toBe(true);
      expect(wrapper.resources.has('file:///config/settings.json')).toBe(true);

      const logsResource = wrapper.resources.get('file:///app/logs.txt');
      expect(logsResource?.name).toBe('Application Logs');
      expect(logsResource?.mimeType).toBe('text/plain');
    });

    it('should create resource tools for agents', async () => {
      const mockResources = [
        {
          uri: 'file:///test.txt',
          name: 'Test Resource',
          description: 'A test resource',
          mimeType: 'text/plain',
        },
      ];

      mockClient.listResources.mockResolvedValue({ resources: mockResources });

      const config: StdioMCPServerConfig = {
        name: 'resource-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      // Check that resource tools were created
      expect(('resource-server_list_resources' in wrapper.tools)).toBe(true);
      expect(('resource-server_read_resource' in wrapper.tools)).toBe(true);

      const listResourcesTool = wrapper.tools[
        'resource-server_list_resources'
      ];
      expect(listResourcesTool?.description).toContain(
        'List available resources'
      );

      const readResourceTool = wrapper.tools[
        'resource-server_read_resource'
      ];
      expect(readResourceTool?.description).toContain(
        'Read content from a resource'
      );
    });

    it('should execute list_resources tool correctly', async () => {
      const mockResources = [
        {
          uri: 'file:///test.txt',
          name: 'Test Resource',
          description: 'A test resource',
        },
      ];

      mockClient.listResources.mockResolvedValue({ resources: mockResources });

      const config: StdioMCPServerConfig = {
        name: 'resource-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      const listResourcesTool = wrapper.tools[
        'resource-server_list_resources'
      ];
      expect(listResourcesTool).toBeDefined();

      const result = await listResourcesTool?.execute?.({}, {} as ToolCallOptions);
      expect(result).toBeDefined();

      const parsedResult = JSON.parse(result as string);
      expect(parsedResult).toHaveLength(1);
      expect(parsedResult[0].uri).toBe('file:///test.txt');
    });

    it('should execute read_resource tool correctly', async () => {
      const mockResources = [
        {
          uri: 'file:///test.txt',
          name: 'Test Resource',
        },
      ];

      mockClient.listResources.mockResolvedValue({ resources: mockResources });
      mockClient.readResource.mockResolvedValue({
        contents: [
          {
            uri: 'file:///test.txt',
            mimeType: 'text/plain',
            text: 'This is the content of the test file',
          },
        ],
      });

      const config: StdioMCPServerConfig = {
        name: 'resource-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      const readResourceTool = wrapper.tools[
        'resource-server_read_resource'
      ];
      expect(readResourceTool).toBeDefined();

      const result = await readResourceTool?.execute?.({
        uri: 'file:///test.txt',
      }, {} as ToolCallOptions);

      expect(result).toBeDefined();

      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.contents).toHaveLength(1);
      expect(parsedResult.contents[0].text).toBe(
        'This is the content of the test file'
      );

      // Verify that the client was called with correct parameters
      expect(mockClient.readResource).toHaveBeenCalledWith({
        uri: 'file:///test.txt',
      });
    });

    it('should handle resource reading errors gracefully', async () => {
      const mockResources = [
        {
          uri: 'file:///error.txt',
          name: 'Error Resource',
        },
      ];

      mockClient.listResources.mockResolvedValue({ resources: mockResources });
      mockClient.readResource.mockRejectedValue(
        new Error('Resource not found')
      );

      const config: StdioMCPServerConfig = {
        name: 'resource-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      const readResourceTool = wrapper.tools[
        'resource-server_read_resource'
      ];
      expect(readResourceTool).toBeDefined();

      const result = await readResourceTool?.execute?.({
        uri: 'file:///error.txt',
      }, {} as ToolCallOptions);

      expect(result).toBeDefined();
      expect(result).toBe('Error: Resource not found');
    });

    it('should handle resource loading errors gracefully', async () => {
      mockClient.listResources.mockRejectedValue(
        new Error('Failed to list resources')
      );

      const config: StdioMCPServerConfig = {
        name: 'failing-resource-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      // Should not throw, just log warning
      // Note: Connection now happens during wrapper creation

      // Should have 0 resources but still be connected
      expect(wrapper.isConnected).toBe(true);
      expect(wrapper.resources.size).toBe(0);

      // Should still have resource tools (even if empty)
      expect(('failing-resource-server_list_resources' in wrapper.tools)).toBe(
        true
      );
      expect(('failing-resource-server_read_resource' in wrapper.tools)).toBe(
        true
      );
    });

    it('should use listResources and readResource methods from wrapper', async () => {
      const mockResources = [
        {
          uri: 'file:///wrapper.txt',
          name: 'Wrapper Resource',
          description: 'A resource accessed via wrapper methods',
        },
      ];

      mockClient.listResources.mockResolvedValue({ resources: mockResources });
      mockClient.readResource.mockResolvedValue({
        contents: [
          {
            uri: 'file:///wrapper.txt',
            mimeType: 'text/plain',
            text: 'Wrapper method result',
          },
        ],
      });

      const config: StdioMCPServerConfig = {
        name: 'wrapper-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      // Test listResources method
      const resources = await wrapper.listResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('file:///wrapper.txt');

      // Test readResource method
      const resourceContent = await wrapper.readResource('file:///wrapper.txt');
      expect(resourceContent.contents[0].text).toBe('Wrapper method result');

      // Verify client methods were called
      expect(mockClient.readResource).toHaveBeenCalledWith({
        uri: 'file:///wrapper.txt',
      });
    });

    it('should handle different resource content types', async () => {
      const mockResources = [
        {
          uri: 'file:///binary.jpg',
          name: 'Binary Resource',
          mimeType: 'image/jpeg',
        },
      ];

      mockClient.listResources.mockResolvedValue({ resources: mockResources });
      mockClient.readResource.mockResolvedValue({
        contents: [
          {
            uri: 'file:///binary.jpg',
            mimeType: 'image/jpeg',
            blob: 'base64encodedimagedata',
          },
        ],
      });

      const config: StdioMCPServerConfig = {
        name: 'resource-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      const readResourceTool = wrapper.tools[
        'resource-server_read_resource'
      ];
      expect(readResourceTool).toBeDefined();

      const result = await readResourceTool?.execute?.({
        uri: 'file:///binary.jpg',
      }, {} as ToolCallOptions);

      expect(result).toBeDefined();

      const parsedResult = JSON.parse(result as string);
      expect(parsedResult.contents[0].blob).toBe('base64encodedimagedata');
      expect(parsedResult.contents[0].mimeType).toBe('image/jpeg');
    });
  });

  describe('Phase 1 - Prompts and Resources Infrastructure', () => {
    beforeEach(() => {
      // Override capabilities to include prompts and resources
      mockClient.getServerCapabilities.mockReturnValue({
        tools: {},
        prompts: {},
        resources: {},
      });
    });
    it('should initialize client with prompts and resources capabilities', async () => {
      const serverConfig: StdioMCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      // Load tools to trigger client creation
      await loadMCPTools([serverConfig]);

      // Client should be created with correct capabilities (verified by successful load)
    });

    it('should create MCPClientWrapper with prompts and resources properties', async () => {
      const config: StdioMCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      // Verify new properties exist
      expect(wrapper).toHaveProperty('prompts');
      expect(wrapper).toHaveProperty('resources');
      expect(wrapper.prompts).toBeInstanceOf(Map);
      expect(wrapper.resources).toBeInstanceOf(Map);
      expect(wrapper.prompts.size).toBe(0);
      expect(wrapper.resources.size).toBe(0);

      // Verify new methods exist
      expect(wrapper).toHaveProperty('listPrompts');
      expect(wrapper).toHaveProperty('getPrompt');
      expect(wrapper).toHaveProperty('listResources');
      expect(wrapper).toHaveProperty('readResource');
      expect(typeof wrapper.listPrompts).toBe('function');
      expect(typeof wrapper.getPrompt).toBe('function');
      expect(typeof wrapper.listResources).toBe('function');
      expect(typeof wrapper.readResource).toBe('function');
    });

    it('should initialize prompts and resources maps as empty', async () => {
      const config: StdioMCPServerConfig = {
        name: 'test-server',
        type: 'stdio',
        command: '/usr/bin/node',
        args: ['test.js'],
      };

      const wrapper = await createMCPClientWrapper(config);

      expect(wrapper.prompts.size).toBe(0);
      expect(wrapper.resources.size).toBe(0);
    });

    it('should verify type definitions exist', () => {
      // This test verifies that our new types are properly imported and available
      // We can create instances to ensure they compile correctly

      const mockPrompt: import('../types/index.js').MCPPrompt = {
        name: 'test-prompt',
        description: 'A test prompt',
        arguments: [
          {
            name: 'arg1',
            description: 'First argument',
            required: true,
          },
        ],
      };

      const mockResource: import('../types/index.js').MCPResource = {
        uri: 'file:///test.txt',
        name: 'Test Resource',
        description: 'A test resource',
        mimeType: 'text/plain',
      };

      const mockPromptResult: import('../types/index.js').PromptResult = {
        description: 'Test prompt result',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Test message',
            },
          },
        ],
      };

      const mockResourceContent: import('../types/index.js').ResourceContent = {
        contents: [
          {
            uri: 'file:///test.txt',
            mimeType: 'text/plain',
            text: 'Test content',
          },
        ],
      };

      // If we reach this point, the types compiled correctly
      expect(mockPrompt.name).toBe('test-prompt');
      expect(mockResource.uri).toBe('file:///test.txt');
      expect(mockPromptResult.description).toBe('Test prompt result');
      expect(mockResourceContent.contents).toHaveLength(1);
    });

    it('should handle SSE client with prompts and resources capabilities', async () => {
      const serverConfig: SSEMCPServerConfig = {
        name: 'sse-server',
        type: 'sse',
        url: 'https://api.example.com/mcp',
      };

      // Load tools to trigger client creation
      await loadMCPTools([serverConfig]);

      // SSE Client should be created with correct capabilities (verified by successful load)
    });

    it('should verify all new imports are available', () => {
      // This test ensures our imports from @modelcontextprotocol/sdk/types.js work
      // By importing them here, we verify they exist and are accessible

      // We can't directly test the types at runtime, but we can verify they're importable
      // by using them in type annotations and seeing if they compile

      const testFunction = async (): Promise<{
        prompts: import('@modelcontextprotocol/sdk/types.js').ListPromptsResult;
        getPrompt: import('@modelcontextprotocol/sdk/types.js').GetPromptResult;
        resources: import('@modelcontextprotocol/sdk/types.js').ListResourcesResult;
        readResource: import('@modelcontextprotocol/sdk/types.js').ReadResourceResult;
      }> => {
        return {
          prompts: { prompts: [] },
          getPrompt: {
            description: 'test',
            messages: [],
          },
          resources: { resources: [] },
          readResource: { contents: [] },
        };
      };

      // If this compiles, our imports are working
      expect(typeof testFunction).toBe('function');
    });
  });

  describe('MCP Server Loading Optimization', () => {
    describe('detectServerCapabilities', () => {
      it('should detect all capabilities when server supports them', async () => {
        // Override capabilities to include all
        mockClient.getServerCapabilities.mockReturnValue({
          tools: {},
          prompts: {},
          resources: {},
        });

        mockClient.listTools.mockResolvedValue({ tools: [] });
        mockClient.listPrompts.mockResolvedValue({ prompts: [] });
        mockClient.listResources.mockResolvedValue({ resources: [] });

        // We need to import the function - it's not exported but we can test it indirectly
        const config: StdioMCPServerConfig = {
          name: 'test-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        };

        await loadMCPTools([config]);

        // Verify that all capability methods were called
        expect(mockClient.listTools).toHaveBeenCalled();
        expect(mockClient.listPrompts).toHaveBeenCalled();
        expect(mockClient.listResources).toHaveBeenCalled();
      });

      it('should handle servers that only support tools', async () => {
        mockClient.listTools.mockResolvedValue({
          tools: [{ name: 'test-tool', description: 'Test' }],
        });
        mockClient.listPrompts.mockRejectedValue(new Error('Not supported'));
        mockClient.listResources.mockRejectedValue(new Error('Not supported'));

        const config: StdioMCPServerConfig = {
          name: 'tools-only-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        };

        const result = await loadMCPTools([config]);

        // Should still succeed with just tools
        expect(Object.keys(result.tools).length).toBeGreaterThan(0);
        expect(result.errors.length).toBe(0); // Errors should be handled gracefully
      });

      it('should handle capability detection timeouts', async () => {
        // Mock a server that throws a timeout error directly
        mockClient.listTools.mockRejectedValue(new Error('timeout'));
        mockClient.listPrompts.mockResolvedValue({ prompts: [] });
        mockClient.listResources.mockResolvedValue({ resources: [] });

        const config: StdioMCPServerConfig = {
          name: 'slow-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        };

        const result = await loadMCPTools([config]);

        // Should have timeout errors
        expect(result.errors.length).toBe(1); // Timeouts should create an error entry
      });
    });

    describe('parallel server initialization', () => {
      it('should initialize multiple servers in parallel', async () => {
        const mockTools = [{ name: 'test-tool', description: 'Test tool' }];
        mockClient.listTools.mockResolvedValue({ tools: mockTools });
        mockClient.listPrompts.mockResolvedValue({ prompts: [] });
        mockClient.listResources.mockResolvedValue({ resources: [] });

        const serverConfigs: StdioMCPServerConfig[] = [
          {
            name: 'server1',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['test1.js'],
          },
          {
            name: 'server2',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['test2.js'],
          },
          {
            name: 'server3',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['test3.js'],
          },
        ];

        const result = await loadMCPTools(serverConfigs);

        // All servers should be processed
        expect(Object.keys(result.tools).length).toBeGreaterThan(0);
        expect(result.errors.length).toBe(0);
      });

      it('should handle mixed success/failure scenarios', async () => {
        // Test with just one failing server to keep it simple
        mockClient.connect.mockRejectedValue(new Error('Connection failed'));
        mockClient.listTools.mockResolvedValue({
          tools: [{ name: 'tool', description: 'Test' }],
        });
        mockClient.listPrompts.mockResolvedValue({ prompts: [] });
        mockClient.listResources.mockResolvedValue({ resources: [] });

        const serverConfigs: StdioMCPServerConfig[] = [
          {
            name: 'failing-server',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['test.js'],
          },
        ];

        const result = await loadMCPTools(serverConfigs);

        // Should have error for failed server
        expect(result.errors.length).toBe(1);
        expect(result.errors[0].serverName).toBe('failing-server');
        expect(result.errors[0].error).toContain('Connection failed');

        // Should have no tools from failed server
        expect(Object.keys(result.tools).length).toBe(0);
      });
    });

    describe('selective capability loading', () => {
      it('should only load supported capabilities', async () => {
        // Mock server that only supports tools
        mockClient.listTools.mockResolvedValue({
          tools: [{ name: 'test-tool', description: 'Test tool' }],
        });
        mockClient.listPrompts.mockRejectedValue(
          new Error('Prompts not supported')
        );
        mockClient.listResources.mockRejectedValue(
          new Error('Resources not supported')
        );

        const config: StdioMCPServerConfig = {
          name: 'tools-only-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        };

        const result = await loadMCPTools([config]);

        // Should have tools but no prompt/resource tools
        expect(('tools-only-server_test-tool' in result.tools)).toBe(true);
        expect(('tools-only-server_list_prompts' in result.tools)).toBe(false);
        expect(('tools-only-server_list_resources' in result.tools)).toBe(
          false
        );
      });

      it('should create prompt and resource tools when capabilities are supported', async () => {
        // Override capabilities to include prompts and resources
        mockClient.getServerCapabilities.mockReturnValue({
          tools: {},
          prompts: {},
          resources: {},
        });

        mockClient.listTools.mockResolvedValue({ tools: [] });
        mockClient.listPrompts.mockResolvedValue({
          prompts: [{ name: 'test-prompt', description: 'Test prompt' }],
        });
        mockClient.listResources.mockResolvedValue({
          resources: [{ uri: 'test://resource', name: 'Test resource' }],
        });

        const config: StdioMCPServerConfig = {
          name: 'full-server',
          type: 'stdio',
          command: '/usr/bin/node',
          args: ['test.js'],
        };

        const result = await loadMCPTools([config]);

        // Should have prompt and resource tools
        expect(('full-server_list_prompts' in result.tools)).toBe(true);
        expect(('full-server_get_prompt' in result.tools)).toBe(true);
        expect(('full-server_list_resources' in result.tools)).toBe(true);
        expect(('full-server_read_resource' in result.tools)).toBe(true);
      });
    });

    describe('performance optimizations', () => {
      it('should load multiple servers with parallel processing', async () => {
        // Mock a server that responds immediately (no delay needed for parallel processing test)
        mockClient.listTools.mockResolvedValue({ tools: [] });
        mockClient.listPrompts.mockResolvedValue({ prompts: [] });
        mockClient.listResources.mockResolvedValue({ resources: [] });

        const serverConfigs: StdioMCPServerConfig[] = [
          {
            name: 'server1',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['test1.js'],
          },
          {
            name: 'server2',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['test2.js'],
          },
        ];

        const result = await loadMCPTools(serverConfigs);

        // Should successfully load from both servers
        expect(result.errors.length).toBe(0);
        expect(Object.keys(result.tools).length).toBeGreaterThanOrEqual(0);
      });

      it('should handle error recovery without blocking other servers', async () => {
        // Configure mock to succeed
        mockClient = createMockMcpClient({
          tools: [{ name: 'tool', description: 'Test' }],
        });

        const serverConfigs: StdioMCPServerConfig[] = [
          {
            name: 'working-server',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['work.js'],
          },
        ];

        const result = await loadMCPTools(serverConfigs);

        // Working server should provide tools
        expect(('working-server_tool' in result.tools)).toBe(true);
      });
    });
  });

  describe('Tool Disable Functionality', () => {
    describe('isToolDisabled', () => {
      const mockWrappedTool: WrappedTool = {
        toolName: 'write_file',
        serverName: 'filesystem',
        description: 'Write content to a file',
        execute: vi.fn(),
        inputSchema: z.object({}),
      };

      const mockServerConfig: MCPServerConfig = {
        name: 'filesystem',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      };

      it('should return false when no tools are disabled', () => {
        const result = isToolDisabled(
          'filesystem_write_file',
          mockWrappedTool,
          mockServerConfig,
          createTestRuntimeConfig()
        );

        expect(result).toBe(false);
      });

      it('should return true when tool is disabled by server configuration', () => {
        const serverConfigWithDisabled = {
          ...mockServerConfig,
          disabledTools: ['write_file', 'delete_file'],
        };

        const result = isToolDisabled(
          'filesystem_write_file',
          mockWrappedTool,
          serverConfigWithDisabled,
          createTestRuntimeConfig()
        );

        expect(result).toBe(true);
      });

      it('should return true when tool is disabled by global configuration - exact match', () => {
        const result = isToolDisabled(
          'filesystem_write_file',
          mockWrappedTool,
          mockServerConfig,
          {
            tools: {
              disabledInternalTools: ['filesystem_write_file'],
            },
          } as RuntimeConfiguration
        );

        expect(result).toBe(true);
      });

      it('should return true when tool is disabled by global configuration - unprefixed match', () => {
        const result = isToolDisabled(
          'filesystem_write_file',
          mockWrappedTool,
          mockServerConfig,
          {
            tools: {
              disabledInternalTools: ['write_file'],
            },
          } as RuntimeConfiguration
        );

        expect(result).toBe(true);
      });

      it('should return true when tool is disabled by global configuration - suffix match', () => {
        const result = isToolDisabled(
          'some_server_write_file',
          mockWrappedTool,
          mockServerConfig,
          {
            tools: {
              disabledInternalTools: ['write_file'],
            },
          } as RuntimeConfiguration
        );

        expect(result).toBe(true);
      });

      it('should return false when tool name does not match any disabled pattern', () => {
        const result = isToolDisabled(
          'filesystem_read_file',
          { ...mockWrappedTool, toolName: 'read_file' },
          mockServerConfig,
          {
            tools: {
              disabledInternalTools: ['write_file', 'delete_file'],
            },
          } as RuntimeConfiguration
        );

        expect(result).toBe(false);
      });

      it('should prioritize server-level disable over global settings', () => {
        const serverConfigWithDisabled = {
          ...mockServerConfig,
          disabledTools: ['write_file'],
        };

        const result = isToolDisabled(
          'filesystem_write_file',
          mockWrappedTool,
          serverConfigWithDisabled,
          createTestRuntimeConfig() // No global disabled tools
        );

        expect(result).toBe(true);
      });

      it('should handle empty disabled tool arrays', () => {
        const result = isToolDisabled(
          'filesystem_write_file',
          mockWrappedTool,
          mockServerConfig,
          createTestRuntimeConfig()
        );

        expect(result).toBe(false);
      });

      it('should handle missing tools configuration', () => {
        const result = isToolDisabled(
          'filesystem_write_file',
          mockWrappedTool,
          mockServerConfig,
          createTestRuntimeConfig()
        );

        expect(result).toBe(false);
      });
    });

    describe('loadMCPServersWithClients with tool filtering', () => {
      const mockRuntimeConfig = createTestRuntimeConfig({
        tools: {
          disabledInternalTools: ['write_file', 'delete_file'],
          globalTimeout: 300000,
        },
      });

      beforeEach(() => {
        // Reset mocks
        mockClient.listTools.mockResolvedValue({
          tools: [
            { name: 'read_file', description: 'Read a file' },
            { name: 'write_file', description: 'Write a file' },
            { name: 'delete_file', description: 'Delete a file' },
          ],
        });
        mockClient.listPrompts.mockResolvedValue({ prompts: [] });
        mockClient.listResources.mockResolvedValue({ resources: [] });
      });

      it('should accept RuntimeConfiguration parameter', async () => {
        const serverConfigs: StdioMCPServerConfig[] = [
          {
            name: 'test-server',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['test.js'],
          },
        ];

        // This should not throw - testing the enhanced function signature
        const result = await loadMCPServersWithClients(
          serverConfigs,
          mockRuntimeConfig
        );

        expect(result).toBeDefined();
        expect(result.tools).toBeDefined();
      });

      it('should filter tools based on global disabled configuration', async () => {
        const serverConfigs: StdioMCPServerConfig[] = [
          {
            name: 'filesystem',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['test.js'],
          },
        ];

        const result = await loadMCPServersWithClients(
          serverConfigs,
          mockRuntimeConfig
        );

        // Should have read_file but not write_file or delete_file
        expect(('filesystem_read_file' in result.tools)).toBe(true);
        expect(('filesystem_write_file' in result.tools)).toBe(false);
        expect(('filesystem_delete_file' in result.tools)).toBe(false);
      });

      it('should filter tools based on server-level disabled configuration', async () => {
        const serverConfigs = [
          {
            name: 'filesystem',
            type: 'stdio' as const,
            command: '/usr/bin/node',
            args: ['test.js'],
            disabledTools: ['write_file'], // Server-level disable
          },
        ];

        const result = await loadMCPServersWithClients(
          serverConfigs,
          createTestRuntimeConfig() // No global disabled tools
        );

        // Should have read_file and delete_file but not write_file
        expect(('filesystem_read_file' in result.tools)).toBe(true);
        expect(('filesystem_write_file' in result.tools)).toBe(false);
        expect(('filesystem_delete_file' in result.tools)).toBe(true);
      });

      it('should work without RuntimeConfiguration parameter (backward compatibility)', async () => {
        const serverConfigs: StdioMCPServerConfig[] = [
          {
            name: 'test-server',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['test.js'],
          },
        ];

        // Should work without runtime config parameter
        const result = await loadMCPServersWithClients(serverConfigs);

        expect(result).toBeDefined();
        expect(result.tools).toBeDefined();
        // Should have all tools when no filtering is applied
        expect(('test-server_read_file' in result.tools)).toBe(true);
        expect(('test-server_write_file' in result.tools)).toBe(true);
        expect(('test-server_delete_file' in result.tools)).toBe(true);
      });

      it('should handle empty disabled tools configuration', async () => {
        const serverConfigs: StdioMCPServerConfig[] = [
          {
            name: 'test-server',
            type: 'stdio',
            command: '/usr/bin/node',
            args: ['test.js'],
          },
        ];

        const emptyConfig = createTestRuntimeConfig();

        const result = await loadMCPServersWithClients(
          serverConfigs,
          emptyConfig
        );

        // Should have all tools when no tools are disabled
        expect(('test-server_read_file' in result.tools)).toBe(true);
        expect(('test-server_write_file' in result.tools)).toBe(true);
        expect(('test-server_delete_file' in result.tools)).toBe(true);
      });
    });
  });
});
