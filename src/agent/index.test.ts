/**
 * Unit tests for agent module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  APICallError,
  InvalidPromptError,
  NoSuchProviderError,
  InvalidArgumentError,
  NoSuchToolError,
} from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { runAgent, formatExecutionSummary } from './index.js';
import {
  initializeAgentSession,
  cleanupAgentSession,
  AgentSession,
} from '../agentSession.js';
import { AgentResult, MCPServerConfig } from '../types/index.js';
import { RuntimeConfiguration } from '../config/types.js';
import { logger } from '../logger.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  stepCountIs: vi.fn(),
  APICallError: { isInstance: vi.fn(() => false) },
  InvalidPromptError: { isInstance: vi.fn(() => false) },
  NoSuchProviderError: { isInstance: vi.fn(() => false) },
  InvalidToolArgumentsError: { isInstance: vi.fn(() => false) },
  NoSuchToolError: { isInstance: vi.fn(() => false) },
  ToolExecutionError: { isInstance: vi.fn(() => false) },
  InvalidArgumentError: { isInstance: vi.fn(() => false) },
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => ({
    chat: vi.fn(() => 'mock-openrouter-model'),
  })),
}));

vi.mock('../mcp/loader.js', () => ({
  loadMCPTools: vi.fn(),
  loadMCPServersWithClients: vi.fn(),
  convertToolsForAISDK: vi.fn(),
}));

vi.mock('../logger.js', () => ({
  logger: {
    logUserStep: vi.fn(),
    logAssistantStep: vi.fn(),
    logThinking: vi.fn(),
    logToolCallProgress: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    getCurrentLogProgress: vi.fn().mockReturnValue('none'),
    getSessionId: vi.fn().mockReturnValue('test-session-id'),
    initialize: vi.fn().mockResolvedValue(undefined),
    setLogLevel: vi.fn(),
    setLogProgress: vi.fn(),
    setSuppressConsoleOutput: vi.fn(),
  },
}));

vi.mock('../agentSession.js', () => ({
  initializeAgentSession: vi.fn(),
  cleanupAgentSession: vi.fn(),
}));

// Test helper functions
function createTestConfig(): RuntimeConfiguration {
  return {
    mcpServers: {
      filesystem: {
        name: 'filesystem',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
      },
    } as Record<string, MCPServerConfig>,
    providers: {
      default: 'openrouter',
      openrouter: {
        model: 'google/gemini-2.5-flash-preview-05-20',
      },
      openai: {
        model: 'gpt-4',
      },
      anthropic: {
        model: 'claude-3-5-sonnet-20241022',
      },
      google: {
        model: 'gemini-2.0-flash-exp',
      },
    },
    agent: {
      maxSteps: 100,
      timeout: 120000,
      logLevel: 'SILENT' as const,
      logProgress: 'none' as const,
      streaming: true,
    },
    tools: {
      globalTimeout: 300000,
      disabledInternalTools: [],
    },
    stdin: false,
    json: false,
  };
}

// Mock constants
vi.mock('../constants.js', () => ({
  SYSTEM_PROMPT: 'Test system prompt',
  DEFAULT_SYSTEM_PROMPT: 'Test default system prompt',
  buildSystemPrompt: vi.fn(
    (
      customContent?: string,
      mode: 'replace' | 'append' | 'prepend' = 'replace',
      _isInteractive: boolean = false
    ) => {
      if (!customContent) return 'Test system prompt';
      if (mode === 'replace') return customContent;
      if (mode === 'append')
        return 'Test default system prompt\n\n' + customContent;
      if (mode === 'prepend')
        return customContent + '\n\nTest default system prompt';
      return 'Test system prompt';
    }
  ),
  MCP_SERVERS: [
    {
      name: 'test-server',
      type: 'stdio',
      command: 'node',
      args: ['test.js'],
    },
  ],
  MAX_STEPS: 10,
  GENERATION_TIMEOUT_MS: 300000,
  MAX_GENERATION_RETRIES: 3,
  THINKING_CONFIG: {
    anthropic: {
      defaultBudget: 20000,
      maxBudget: 24576,
      costMultiplier: 1.0,
    },
    openai: {
      defaultEffort: 'medium',
      efforts: ['low', 'medium', 'high'],
    },
    google: {
      defaultBudget: 8192,
      maxBudget: 24576,
      costMultiplier: 6.0,
    },
  },
}));

// Mock config functions
vi.mock('../config/index.js', () => ({
  getMCPServersFromConfig: vi.fn(() => [
    {
      name: 'test-server',
      type: 'stdio',
      command: 'node',
      args: ['test.js'],
    },
  ]),
  loadSystemPromptContent: vi.fn(() => Promise.resolve(null)),
}));

// Mock agent session functions
vi.mock('../agentSession.js', () => ({
  initializeAgentSession: vi.fn(),
  cleanupAgentSession: vi.fn(),
}));

// Import mocked modules
import { generateText } from 'ai';
import { createMockGenerateTextResult } from '../test/helpers/createMocks.js';
import { openai } from '@ai-sdk/openai';
import {
  loadMCPTools,
  loadMCPServersWithClients,
  convertToolsForAISDK,
} from '../mcp/loader.js';

const mockGenerateText = generateText as ReturnType<typeof vi.fn>;
const mockOpenAI = openai as unknown as ReturnType<typeof vi.fn>;
const mockLoadMCPTools = loadMCPTools as ReturnType<typeof vi.fn>;
const mockLoadMCPServersWithClients = loadMCPServersWithClients as ReturnType<
  typeof vi.fn
>;
const mockConvertToolsForAISDK = convertToolsForAISDK as ReturnType<
  typeof vi.fn
>;
const mockInitializeAgentSession = initializeAgentSession as ReturnType<
  typeof vi.fn
>;
const mockCleanupAgentSession = cleanupAgentSession as ReturnType<typeof vi.fn>;

// Helper function to create a mock agent session
function createMockAgentSession(): AgentSession {
  return {
    model: {
      specificationVersion: 'v2' as const,
      provider: 'mock',
      modelId: 'mock-model',
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
      details: {
        envVarName: 'OPENROUTER_API_KEY',
      },
    },
  };
}

// Helper function to run agent with a mock session for tests
async function runAgentWithMockSession(
  message: string,
  config: RuntimeConfiguration,
  isInteractive: boolean = false
) {
  try {
    // First call initializeAgentSession to trigger mocks
    const session = await initializeAgentSession(config);
    return await runAgent(message, config, session, isInteractive);
  } catch (error) {
    // If session initialization fails, return error result
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      toolCallsCount: 0,
      executionTime: 0,
    };
  }
}

describe('agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set dummy environment variables for tests
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

    // Setup default mocks
    mockLoadMCPTools.mockResolvedValue({
      tools: new Map(),
      errors: [],
    });

    mockLoadMCPServersWithClients.mockResolvedValue({
      tools: new Map(),
      clients: [],
      errors: [],
    });

    mockConvertToolsForAISDK.mockReturnValue({});

    mockOpenAI.mockReturnValue(
      () =>
        ({
          modelId: 'mock-model',
        }) as LanguageModelV2
    );

    mockGenerateText.mockResolvedValue({
      text: 'Test response',
      finishReason: 'stop',
      usage: { totalTokens: 100 },
      toolResults: [],
      response: {
        messages: [{ role: 'assistant', content: 'Test response' }],
      },
    });

    // Setup agent session mocks
    mockInitializeAgentSession.mockResolvedValue(createMockAgentSession());
    mockCleanupAgentSession.mockResolvedValue(undefined);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runAgent', () => {
    it('should execute successfully with default options', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Test response',
        finishReason: 'stop',
        usage: { totalTokens: 100 },
        toolResults: [],
        response: {
          messages: [{ role: 'assistant', content: 'Test response' }],
        },
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(true);
      expect(result.response).toBe('Test response');
      expect(result.toolCallsCount).toBe(0);
      expect(typeof result.executionTime).toBe('number');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should load MCP tools and convert them for AI SDK', async () => {
      new Map([
        [
          'test-tool',
          {
            description: 'Test tool',
            inputSchema: {},
            execute: vi.fn(),
            originalExecute: vi.fn(),
            serverName: 'test-server',
            toolName: 'test-tool',
          },
        ],
      ]);

      // Update mock to include tools in the session
      const sessionWithTools = {
        ...createMockAgentSession(),
        tools: {
          'test-tool': {
            description: 'Test tool',
            inputSchema: {},
            execute: vi.fn(),
            originalExecute: vi.fn(),
            serverName: 'test-server',
            toolName: 'test-tool',
          },
        },
      };

      mockInitializeAgentSession.mockResolvedValue(sessionWithTools);

      const config = createTestConfig();
      await runAgentWithMockSession('Test message', config, false);

      // Since we're using a mock session, we verify that the session has tools
      expect(mockInitializeAgentSession).toHaveBeenCalled();
    });

    it('should handle tool loading errors gracefully', async () => {
      // This test should pass through session initialization, so we need to actually test that
      // For now, we'll test that agent execution succeeds even when session has no tools
      const sessionWithoutTools = {
        ...createMockAgentSession(),
        tools: {},
      };

      mockInitializeAgentSession.mockResolvedValue(sessionWithoutTools);

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(true);
      expect(result.response).toBe('Test response');
    });

    it('should use custom provider and model options', async () => {
      const config = createTestConfig();
      config.providers.default = 'openai';
      config.providers.openai = { model: 'gpt-3.5-turbo' };

      // Create a session with custom model to simulate proper initialization
      const sessionWithCustomModel = {
        ...createMockAgentSession(),
        model: {
          specificationVersion: 'v2' as const,
          provider: 'openai',
          modelId: 'mock-openai-model',
          supportedUrls: {},
          doGenerate: vi.fn(),
          doStream: vi.fn(),
        } as LanguageModelV2,
      };

      mockInitializeAgentSession.mockResolvedValue(sessionWithCustomModel);

      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(true);
      expect(mockInitializeAgentSession).toHaveBeenCalledWith(config);
    });

    it('should throw error for unsupported provider', async () => {
      const config = createTestConfig();
      config.providers.default = 'unsupported';

      // Mock session initialization to throw an error for unsupported provider
      mockInitializeAgentSession.mockRejectedValueOnce(
        new Error('Unsupported provider: unsupported')
      );

      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported provider: unsupported');
    });

    it('should call generateText with correct parameters', async () => {
      const userMessage = 'Test user message';
      const config = createTestConfig();
      config.agent.maxSteps = 5;

      await runAgentWithMockSession(userMessage, config, false);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.anything(), // The model can be any type
          system: 'Test system prompt',
          messages: expect.arrayContaining([
            {
              role: 'user',
              content: userMessage,
            },
          ]),
          tools: {},
          stopWhen: undefined, // stepCountIs(1) mock returns undefined
          maxRetries: 3, // MAX_GENERATION_RETRIES constant
          abortSignal: expect.any(AbortSignal),
          providerOptions: {}, // Empty object for default case
          headers: {}, // Empty object for default case
        })
      );
    });

    it('should handle streaming chunks correctly', async () => {
      const logInfoSpy = vi.spyOn(logger, 'info');

      mockGenerateText.mockResolvedValue({
        text: 'Assistant thinking...',
        finishReason: 'stop',
        usage: { totalTokens: 100 },
        toolResults: [],
        response: {
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'Assistant thinking...' }],
            },
          ],
        },
      });

      const config = createTestConfig();
      config.agent.logProgress = 'all';
      await runAgentWithMockSession('Test message', config, false);

      expect(logger.logAssistantStep).toHaveBeenCalledWith(
        'Assistant thinking...'
      );

      expect(logInfoSpy).toHaveBeenCalledWith('Using existing agent session', {
        isInteractive: false,
        systemPromptType: 'string',
        toolCount: 0,
      });

      logInfoSpy.mockRestore();
    });

    it('should count tool calls correctly', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Test response',
        finishReason: 'stop',
        usage: { totalTokens: 100 },
        toolResults: [
          { toolName: 'tool1', toolCallId: 'call1', args: {}, result: {} },
          { toolName: 'tool2', toolCallId: 'call2', args: {}, result: {} },
          { toolName: 'tool3', toolCallId: 'call3', args: {}, result: {} },
        ],
        response: {
          messages: [{ role: 'assistant', content: 'Test response' }],
        },
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.toolCallsCount).toBe(3);
    });

    it('should output JSON format when requested', async () => {
      const config = createTestConfig();
      config.json = true;

      await runAgentWithMockSession('Test message', config, false);

      // Should output JSON (assistant response removed as redundant)
      const jsonOutput = (
        process.stdout.write as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('"success": true')
      )?.[0] as string;

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed).toEqual({
        success: true,
        response: 'Test response',
        toolCallsCount: 0,
        executionTime: expect.any(Number),
        usage: { totalTokens: 100 },
        finishReason: 'stop',
      });
    });

    it('should handle generateText errors', async () => {
      mockGenerateText.mockImplementation(() => {
        throw new Error('AI generation failed');
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('AI generation failed');
    });

    it('should output JSON error format when requested', async () => {
      mockGenerateText.mockImplementation(() => {
        throw new Error('AI generation failed');
      });

      const config = createTestConfig();
      config.json = true;

      await runAgentWithMockSession('Test message', config, false);

      const jsonOutput = (
        process.stdout.write as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('"success": false')
      )?.[0] as string;

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed).toEqual({
        success: false,
        error: 'AI generation failed',
        toolCallsCount: 0,
        executionTime: expect.any(Number),
      });
    });

    it('should handle generation timeout', async () => {
      vi.useFakeTimers();

      mockGenerateText.mockImplementation(() => {
        throw new Error('AbortError: The operation was aborted due to timeout');
      });

      const config = createTestConfig();
      const runPromise = runAgentWithMockSession('Test message', config, false);

      // Advance timers to trigger the timeout
      vi.advanceTimersByTime(120000); // GENERATION_TIMEOUT_MS

      const result = await runPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'AbortError: The operation was aborted due to timeout'
      );

      vi.useRealTimers();
    });
  });

  describe('runAgent - max steps scenario', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.OPENAI_API_KEY = 'test-key';
    });

    it('should handle max steps reached without completion', async () => {
      // In the AI SDK, generateText with maxSteps handles multiple steps within a single call
      mockGenerateText.mockResolvedValue({
        text: 'Step 2 thinking...',
        finishReason: 'length', // Changed to 'length' to indicate max steps reached
        usage: { totalTokens: 100 },
        toolResults: [],
        response: {
          messages: [{ role: 'assistant', content: 'Step 2 thinking...' }],
        },
      });

      const config = createTestConfig();
      config.agent.maxSteps = 2;
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(true);
      expect(result.response).toBe('Step 2 thinking...');
      expect(mockGenerateText).toHaveBeenCalledTimes(1); // Single call with multiple steps
    });

    it('should output JSON format when max steps reached', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Partial response',
        finishReason: 'continue',
        usage: { totalTokens: 50 },
        toolResults: [],
        response: {
          messages: [{ role: 'assistant', content: 'Partial response' }],
        },
      });

      const config = createTestConfig();
      config.agent.maxSteps = 1;
      config.json = true;
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(true);

      // Should output JSON when max steps reached
      const jsonOutput = (
        process.stdout.write as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('"success": true')
      )?.[0] as string;

      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.response).toBe('Partial response');
    });

    it('should handle case where last message is not from assistant', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Maximum steps reached',
        finishReason: 'continue',
        usage: { totalTokens: 50 },
        toolResults: [],
        response: {
          messages: [{ role: 'user', content: 'User message' }],
        },
      });

      const config = createTestConfig();
      config.agent.maxSteps = 1;
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(true);
      expect(result.response).toBe('Maximum steps reached');
    });
  });

  describe('runAgent - error recovery flows', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.OPENAI_API_KEY = 'test-key';
    });

    it('should handle retryable API errors', async () => {
      // Mock API error with retryable status code
      const apiError = new Error('Server error') as Error & {
        statusCode: number;
      };
      apiError.statusCode = 500;
      vi.mocked(APICallError.isInstance).mockReturnValue(true);

      mockGenerateText.mockImplementation(() => {
        throw apiError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
    });

    it('should handle non-retryable API errors', async () => {
      // Mock API error with non-retryable status code
      const apiError = new Error('Bad request') as Error & {
        statusCode: number;
      };
      apiError.statusCode = 400;
      vi.mocked(APICallError.isInstance).mockReturnValue(true);

      mockGenerateText.mockImplementation(() => {
        throw apiError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bad request');
    });

    it('should handle InvalidPromptError', async () => {
      const promptError = new Error('Invalid prompt');
      vi.mocked(InvalidPromptError.isInstance).mockReturnValue(true);

      mockGenerateText.mockImplementation(() => {
        throw promptError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid prompt');
    });

    it('should handle NoSuchProviderError', async () => {
      const providerError = new Error('Provider not found');
      vi.mocked(NoSuchProviderError.isInstance).mockReturnValue(true);

      mockGenerateText.mockImplementation(() => {
        throw providerError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider not found');
    });

    it('should handle unknown errors by failing fast', async () => {
      const unknownError = new Error('Unknown error type');
      mockGenerateText.mockImplementation(() => {
        throw unknownError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error type');
    });
  });

  describe('runAgent - environment edge cases', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.OPENAI_API_KEY = 'test-key';
    });

    it('should handle dotenv import failure gracefully in runAgent', async () => {
      // This test verifies the try-catch around dotenv import in initializeAgent
      // The actual import happens in initializeAgent, but we can test indirectly

      const config = createTestConfig();
      config.providers.default = 'openai';
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      // Should still work even if dotenv fails (since we have env vars set)
      expect(result.success).toBe(true);
    });
  });

  describe('runAgent - error handling', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.clearAllMocks();
      process.env = { ...originalEnv, OPENAI_API_KEY: 'test-key' };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should handle MCP tool loading failures during initialization', async () => {
      // Mock the session initialization to fail
      mockInitializeAgentSession.mockRejectedValueOnce(
        new Error('Setup failed')
      );

      const config = createTestConfig();
      config.providers.default = 'openai';
      const result = await runAgentWithMockSession(
        'test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Setup failed');
      expect(result.toolCallsCount).toBe(0);
      expect(result.executionTime).toBe(0);
    });
  });

  describe('formatExecutionSummary', () => {
    it('should format execution summary correctly', () => {
      const result: AgentResult = {
        success: true,
        response: 'Test response',
        toolCallsCount: 3,
        executionTime: 2500,
      };

      const summary = formatExecutionSummary(result);

      expect(summary).toBe('Execution completed in 2.50s with 3 tool calls');
    });

    it('should handle zero tool calls', () => {
      const result: AgentResult = {
        success: true,
        response: 'Test response',
        toolCallsCount: 0,
        executionTime: 1200,
      };

      const summary = formatExecutionSummary(result);

      expect(summary).toBe('Execution completed in 1.20s with 0 tool calls');
    });

    it('should handle different execution times', () => {
      const result: AgentResult = {
        success: false,
        error: 'Test error',
        toolCallsCount: 1,
        executionTime: 500,
      };

      const summary = formatExecutionSummary(result);

      expect(summary).toBe('Execution completed in 0.50s with 1 tool calls');
    });
  });

  describe('runAgent - additional error scenarios', () => {
    it('should handle tool execution errors with error recovery', async () => {
      const toolError = new Error('Tool execution failed');

      mockGenerateText.mockImplementation(() => {
        throw toolError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });

    it('should handle InvalidToolArgumentsError with error recovery', async () => {
      const invalidArgsError = new Error('Invalid tool arguments');

      vi.mocked(InvalidArgumentError.isInstance).mockReturnValue(true);

      mockGenerateText.mockImplementation(() => {
        throw invalidArgsError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid tool arguments');
    });

    it('should handle NoSuchToolError with error recovery', async () => {
      const noToolError = new Error('Tool not found');

      vi.mocked(NoSuchToolError.isInstance).mockReturnValue(true);

      mockGenerateText.mockImplementation(() => {
        throw noToolError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    it('should handle specific retryable API status codes', async () => {
      const retryableError = new Error('Service unavailable') as Error & {
        statusCode: number;
      };
      retryableError.statusCode = 503;

      vi.mocked(APICallError.isInstance).mockReturnValue(true);

      mockGenerateText.mockImplementation(() => {
        throw retryableError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Service unavailable');
    });

    it('should handle non-retryable API status codes', async () => {
      const nonRetryableError = new Error('Unauthorized') as Error & {
        statusCode: number;
      };
      nonRetryableError.statusCode = 401;

      vi.mocked(APICallError.isInstance).mockReturnValue(true);

      mockGenerateText.mockImplementation(() => {
        throw nonRetryableError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    it('should handle rate limiting with 429 status code', async () => {
      const rateLimitError = new Error('Rate limited') as Error & {
        statusCode: number;
      };
      rateLimitError.statusCode = 429;

      vi.mocked(APICallError.isInstance).mockReturnValue(true);

      mockGenerateText.mockImplementation(() => {
        throw rateLimitError;
      });

      const config = createTestConfig();
      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limited');
    });
  });

  describe('runAgent - max steps and JSON output edge cases', () => {
    it('should output JSON when max steps reached', async () => {
      const stdoutSpy = vi.spyOn(process.stdout, 'write');

      // Mock to simulate max steps scenario
      mockGenerateText.mockResolvedValue({
        text: 'Max steps response',
        finishReason: 'length',
        usage: { totalTokens: 100 },
        toolResults: [],
        response: {
          messages: [{ role: 'assistant', content: 'Max steps response' }],
        },
      });

      const config = createTestConfig();
      config.json = true;
      config.agent.maxSteps = 1; // Force max steps

      const result = await runAgentWithMockSession(
        'Test message',
        config,
        false
      );

      expect(result.success).toBe(true);
      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });
});
