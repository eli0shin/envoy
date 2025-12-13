/**
 * Centralized mock creation using ONLY real MCP SDK types
 * No type casting, complete API coverage, naturally satisfies real interfaces
 * Based on actual @modelcontextprotocol/sdk interfaces
 */

import { vi } from 'vitest';
import type { ChildProcess } from 'child_process';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { AgentSession } from '../../agentSession.js';

import type { RuntimeConfiguration } from '../../config/types.js';
import type {
  MCPClientWrapper,
  MCPServerConfig,
  WrappedTool,
  MCPPrompt,
  MCPResource,
} from '../../types/index.js';
// UI bridge types removed with UI deletion

/**
 * Creates a comprehensive logger mock with all methods implemented
 * Can be used both in global setup and in individual test files
 * Use vi.mocked(mockLogger.someMethod).mockReturnValue(...) to override behavior
 */
export function createMockLogger() {
  return {
    // Main logger object
    logger: {
      // Core logging methods
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),

      // Specialized logging methods
      logUserStep: vi.fn(),
      logAssistantStep: vi.fn(),
      logToolCallProgress: vi.fn(),
      logThinking: vi.fn(),
      logMcpTool: vi.fn(),

      // Configuration methods
      setLogLevel: vi.fn(),
      setLogProgress: vi.fn(),
      setSuppressConsoleOutput: vi.fn(),

      // Utility methods
      getSessionId: vi.fn(() => 'test-session-id'),
      getLogDirectory: vi.fn(() => '/test/logs'),
      getCurrentLogProgress: vi.fn(() => 'none'),
    },

    // Individual function exports
    getSessionId: vi.fn(() => 'test-session-id'),
    getLogDirectory: vi.fn(() => '/test/logs'),
    getConversationDirectory: vi.fn(() => '/test/conversations'),
    getProjectConversationDirectory: vi.fn(
      (projectIdentifier: string) => `/test/conversations/${projectIdentifier}`
    ),
    getProjectConversationFile: vi.fn(
      (projectIdentifier: string, sessionId: string) =>
        `/test/conversations/${projectIdentifier}/${sessionId}.jsonl`
    ),
    logMcpTool: vi.fn(),
    setLogLevel: vi.fn(),
    setLogProgress: vi.fn(),
    createSessionId: vi.fn(() => 'test-session-id'),
  };
}

/**
 * Creates a complete Client mock with all methods implemented
 * Based on the actual Client interface from MCP SDK
 *
 * Note: Uses 'as unknown as Client' because the real Client class has
 * private properties (_clientInfo, _capabilities, etc.) that are implementation
 * details we don't need to mock for testing purposes.
 */
export function createMockClient(overrides: Partial<Client> = {}): Client {
  const mockClient = {
    // Core connection methods
    connect: vi.fn(),
    close: vi.fn(),

    // Communication methods
    request: vi.fn(),
    notification: vi.fn(),

    // Tool methods
    listTools: vi.fn(),
    callTool: vi.fn(),

    // Prompt methods
    listPrompts: vi.fn(),
    getPrompt: vi.fn(),

    // Resource methods
    listResources: vi.fn(),
    readResource: vi.fn(),
    listRoots: vi.fn(),
    listResourceTemplates: vi.fn(),

    // Subscription methods
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    subscribeResource: vi.fn(),
    unsubscribeResource: vi.fn(),

    // Information/Capability methods
    ping: vi.fn(),
    getServerCapabilities: vi.fn(() => undefined),
    getServerVersion: vi.fn(() => undefined),
    getInstructions: vi.fn(() => undefined),
    registerCapabilities: vi.fn(),

    // Completion and logging
    complete: vi.fn(),
    setLoggingLevel: vi.fn(),

    // Notification methods
    sendRootsListChanged: vi.fn(),

    // Protocol inherited methods (from base Protocol class)
    setRequestHandler: vi.fn(),
    removeRequestHandler: vi.fn(),
    setNotificationHandler: vi.fn(),
    removeNotificationHandler: vi.fn(),

    // Protocol properties
    transport: undefined,
    onclose: undefined,
    onerror: undefined,
    fallbackRequestHandler: undefined,
    fallbackNotificationHandler: undefined,

    // Apply any overrides
    ...overrides,
  } as unknown as Client;

  return mockClient;
}

/**
 * Creates a mock StdioClientTransport
 * Uses simple object with all properties pre-populated - NO PROXY
 * Includes complete process.stderr structure and all required Transport interface methods
 *
 * Note: Uses 'as unknown as StdioClientTransport' because the real class has
 * private properties (_abortController, _readBuffer, etc.) that are implementation
 * details we don't need to mock for testing purposes.
 */
export function createMockStdioTransport(
  overrides: Partial<StdioClientTransport> = {}
): StdioClientTransport {
  const mockTransport = {
    // Core transport methods (with correct signatures)
    start: vi.fn(),
    close: vi.fn(),
    send: vi.fn(), // (message: JSONRPCMessage, options?: TransportSendOptions) => Promise<void>

    // Event handlers (with correct signatures)
    onclose: undefined,
    onerror: undefined,
    onmessage: undefined, // (message: JSONRPCMessage, extra?: { authInfo?: AuthInfo }) => void

    // Transport interface properties
    sessionId: undefined,

    // StdioClientTransport specific properties
    stderr: null, // Getter property for stderr stream

    // Process object with stderr (commonly needed by tests)
    process: {
      stderr: {
        on: vi.fn(),
        removeListener: vi.fn(),
        emit: vi.fn(),
      },
    },

    // _process property (actual property used by transport for child process extraction)
    _process: {
      stderr: {
        on: vi.fn(),
        removeListener: vi.fn(),
        emit: vi.fn(),
      },
      pid: 12345,
      kill: vi.fn(),
    },

    // Apply any overrides
    ...overrides,
  } as unknown as StdioClientTransport;

  return mockTransport;
}

/**
 * Creates a mock SSEClientTransport
 * Uses simple object with all properties pre-populated - NO PROXY
 * Includes all required Transport interface methods and SSE-specific properties
 *
 * Note: Uses 'as unknown as SSEClientTransport' because the real class has
 * private properties (_url, _authThenStart, etc.) that are implementation
 * details we don't need to mock for testing purposes.
 */
export function createMockSSETransport(
  overrides: Partial<SSEClientTransport> = {}
): SSEClientTransport {
  const mockTransport = {
    // Core transport methods (with correct signatures)
    start: vi.fn(),
    close: vi.fn(),
    send: vi.fn(), // (message: JSONRPCMessage, options?: TransportSendOptions) => Promise<void>

    // SSE-specific methods
    finishAuth: vi.fn(),

    // Event handlers (with correct signatures)
    onclose: undefined,
    onerror: undefined,
    onmessage: undefined, // (message: JSONRPCMessage, extra?: { authInfo?: AuthInfo }) => void

    // Transport interface properties
    sessionId: undefined,

    // Apply any overrides
    ...overrides,
  } as unknown as SSEClientTransport;

  return mockTransport;
}

/**
 * Creates a mock RuntimeConfiguration with all required properties
 * Based on the actual RuntimeConfiguration type from configTypes.ts
 */
export function createMockRuntimeConfiguration(
  overrides: Partial<RuntimeConfiguration> = {}
): RuntimeConfiguration {
  return {
    providers: {
      default: 'anthropic' as const,
      anthropic: {
        model: 'claude-sonnet-4-20250514',
        authType: 'x-api-key' as const,
      },
      openai: { model: 'gpt-4.1' },
      google: {
        model: 'gemini-2.5-pro',
        authType: 'api-key' as const,
      },
      openrouter: { model: 'google/gemini-2.5-flash-preview-05-20' },
    },
    agent: {
      logProgress: 'none' as const,
      systemPrompt: {
        mode: 'replace' as const,
        value: 'Test system prompt',
      },
      maxSteps: 10,
      timeout: 300000,
      logLevel: 'SILENT' as const,
      streaming: true,
    },
    tools: {
      globalTimeout: 1800000,
      disabledInternalTools: [],
    },
    mcpServers: {},
    stdin: false,
    json: false,
    ...overrides,
  };
}

/**
 * Creates a mock AgentSession with all required properties
 * Based on the actual AgentSession type from agentSession.ts
 */
export function createMockAgentSession(
  overrides: Partial<AgentSession> = {}
): AgentSession {
  return {
    model: {
      modelId: 'claude-sonnet-4-20250514',
      specificationVersion: 'v2' as const,
      provider: 'anthropic',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    } as LanguageModelV2,
    tools: {},
    systemPrompt: 'Test system prompt',
    mcpClients: [],
    authInfo: {
      method: 'api-key' as const,
      source: 'environment' as const,
      details: { envVarName: 'ANTHROPIC_API_KEY' },
    },
    conversationPersistence: undefined,
    provider: {
      name: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    },
    ...overrides,
  };
}

// InteractiveSession mock removed with UI deletion

/**
 * Creates a mock for fs/promises module
 * Used globally in vitest.setup.ts - individual test files should not mock fs/promises
 * For test-specific behavior, use vi.mocked() to override specific methods
 */
export function createFsPromisesMock() {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn(),
    unlink: vi.fn(),
    appendFile: vi.fn(),
    chmod: vi.fn(),
  };
}

/**
 * Creates a mock for fs module
 * Used globally in vitest.setup.ts - individual test files should not mock fs
 * For test-specific behavior, use vi.mocked() to override specific methods
 */
export function createFsMock() {
  const promises = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn(),
    unlink: vi.fn(),
    appendFile: vi.fn(),
    chmod: vi.fn(),
  };

  return {
    default: {
      promises,
    },
    promises,
  };
}

/**
 * Creates a mock MCPClientWrapper with all methods implemented
 * Based on the actual MCPClientWrapper type from types.ts
 * Used by tests that need to mock MCPClientWrapper functionality
 * For test-specific behavior, use vi.mocked() to override specific methods
 */
export function createMockMCPClientWrapper(
  overrides: Partial<MCPClientWrapper> = {}
): MCPClientWrapper {
  return {
    serverName: 'test-server',
    serverConfig: {
      type: 'stdio',
      name: 'test-server',
      command: 'test-command',
      args: [],
    } as MCPServerConfig,
    tools: {} as Record<string, WrappedTool>,
    prompts: new Map<string, MCPPrompt>(),
    resources: new Map<string, MCPResource>(),
    isConnected: true,
    client: null, // Mock client

    // Prompt methods
    listPrompts: vi.fn().mockResolvedValue([]),
    getPrompt: vi.fn(),

    // Resource methods
    listResources: vi.fn().mockResolvedValue([]),
    readResource: vi.fn(),

    // Apply any overrides
    ...overrides,
  };
}

// SessionStateManager mock removed with UI deletion

// AgentExecutionHandler mock removed with UI deletion

// MessageUpdateHandler mock removed with UI deletion

/**
 * Creates a mock fetch function with common response patterns
 * Used for HTTP/fetch mock centralization
 */
export function createMockFetch(defaultResponse?: Response): typeof fetch {
  const mockFetch = vi.fn();
  if (defaultResponse) {
    mockFetch.mockResolvedValue(defaultResponse);
  }
  (mockFetch as unknown as typeof fetch).preconnect = fetch.preconnect;
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch as unknown as typeof fetch;
}

/**
 * Creates a successful JSON response for fetch mocks
 */
export function createMockResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Creates a mock child process with common properties
 * Used for child process mock centralization
 */
export function createMockChildProcess(
  overrides: Record<string, unknown> = {}
): Partial<ChildProcess> {
  return {
    stdout: null,
    stderr: null,
    stdin: null,
    on: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
    killed: false,
    exitCode: null,
    removeAllListeners: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock spawn function for child_process module
 * Used for child process mock centralization
 * NOTE: You still need to call vi.mock('child_process', () => ({ spawn: mockSpawn })) in your test file
 */
export function createMockSpawn() {
  return vi.fn();
}

/**
 * Creates a mock AI SDK with common methods
 * Used for AI SDK mock centralization
 */
export function createMockAISDK() {
  return {
    generateText: vi.fn(),
    streamText: vi.fn(),
    stepCountIs: vi.fn(),
    APICallError: { isInstance: vi.fn(() => false) },
    InvalidPromptError: { isInstance: vi.fn(() => false) },
    NoSuchProviderError: { isInstance: vi.fn(() => false) },
    InvalidToolArgumentsError: { isInstance: vi.fn(() => false) },
    NoSuchToolError: { isInstance: vi.fn(() => false) },
    ToolExecutionError: { isInstance: vi.fn(() => false) },
    InvalidMessageRoleError: { isInstance: vi.fn(() => false) },
    InvalidArgumentError: { isInstance: vi.fn(() => false) },
  };
}

/**
 * Creates a mock generate text result
 * Used for AI SDK mock centralization
 */
import type { GenerateTextResult, ToolSet } from 'ai';

export function createMockGenerateTextResult<
  T extends ToolSet = ToolSet,
>(overrides?: {
  text?: string;
  finishReason?: string;
  usage?:
    | {
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
      }
    | {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
      };
  messages?: Array<
    | { role: 'assistant'; content: string }
    | { role: 'user'; content: string }
    | { role: 'system'; content: string }
    | {
        role: 'tool';
        content: Array<{
          type: 'tool-result';
          toolCallId: string;
          toolName: string;
          output: unknown;
        }>;
      }
  >;
  toolResults?: Array<{
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    input: unknown;
    output: unknown;
    dynamic: true;
  }>;
}): GenerateTextResult<T, unknown> {
  // Normalize the usage format
  const usageData = overrides?.usage || {
    totalTokens: 100,
    inputTokens: 50,
    outputTokens: 50,
  };

  const inputTokens =
    'inputTokens' in usageData ? usageData.inputTokens
    : 'promptTokens' in usageData ? usageData.promptTokens
    : 50;
  const outputTokens =
    'outputTokens' in usageData ? usageData.outputTokens
    : 'completionTokens' in usageData ? usageData.completionTokens
    : 50;

  const usage = {
    inputTokens,
    outputTokens,
    totalTokens: usageData.totalTokens,
  };

  return {
    text: overrides?.text || 'Test response',
    finishReason: (overrides?.finishReason || 'stop') as
      | 'stop'
      | 'length'
      | 'content-filter'
      | 'tool-calls'
      | 'error'
      | 'other'
      | 'unknown',
    usage,
    totalUsage: usage,
    response: {
      messages: overrides?.messages
        ?.filter((msg) => msg.role === 'assistant' || msg.role === 'tool')
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          providerOptions: undefined,
        })) || [
        {
          role: 'assistant' as const,
          content: overrides?.text || 'Test response',
          providerOptions: undefined,
        },
      ],
      id: 'test-id',
      timestamp: new Date(),
      modelId: 'test-model',
    },
    content: [
      { type: 'text' as const, text: overrides?.text || 'Test response' },
    ],
    reasoning: [],
    reasoningText: undefined,
    files: [],
    sources: [],
    toolCalls: [],
    staticToolCalls: [],
    dynamicToolCalls: [],
    toolResults: overrides?.toolResults || [],
    staticToolResults: [],
    dynamicToolResults: overrides?.toolResults || [],
    warnings: undefined,
    request: {},
    providerMetadata: undefined,
    // Legacy properties for compatibility
    responseMessages: overrides?.messages || [
      {
        role: 'assistant',
        content: overrides?.text || 'Test response',
        id: 'test-msg-id',
      },
    ],
    roundtrips: [],
    steps: [],
    logprobs: undefined,
    experimental_providerMetadata: undefined,
    experimental_output: undefined,
    providerOptions: undefined,
  } as GenerateTextResult<T, unknown>;
}

/**
 * Creates a mock stream text result
 * Used for AI SDK mock centralization
 */
export function createMockStreamTextResult(
  generator: AsyncGenerator,
  overrides?: {
    text?: string;
    finishReason?: string;
    usage?: { totalTokens: number };
    messages?: Array<{ role: string; content: string }>;
    toolResults?: Array<unknown>;
  }
) {
  return {
    fullStream: generator,
    response: Promise.resolve({
      messages: overrides?.messages || [
        { role: 'assistant', content: overrides?.text || 'Test response' },
      ],
    }),
    text: Promise.resolve(overrides?.text || 'Test response'),
    finishReason: Promise.resolve(overrides?.finishReason || 'stop'),
    usage: Promise.resolve(overrides?.usage || { totalTokens: 100 }),
    toolResults: Promise.resolve(overrides?.toolResults || []),
  };
}
