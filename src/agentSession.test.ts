/**
 * Tests for agentSession module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockMCPClientWrapper,
  createMockAgentSession,
} from './test/helpers/createMocks.js';
import { initializeAgentSession, cleanupAgentSession } from './agentSession.js';
import type { RuntimeConfiguration } from './config/types.js';
import type {
  OpenRouterSharedSettings,
  OpenRouterCompletionSettings,
  OpenRouterProvider,
} from '@openrouter/ai-sdk-provider';
import type { AnthropicProvider } from '@ai-sdk/anthropic';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { MockLanguageModelV2 } from 'ai/test';
import { z } from 'zod/v3';
import type { MCPClientWrapper, WrappedTool } from './types/index.js';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { buildSystemPrompt } from './constants.js';
import { AnthropicOAuth } from './auth/index.js';
import { loadMCPServersWithClients } from './mcp/loader.js';
import {
  getMCPServersFromConfig,
  loadSystemPromptContent,
} from './config/index.js';
import { createAnthropicAuthFetch } from './providers/anthropicAuth.js';
import { createGoogleAuthConfig } from './providers/googleAuth.js';
import { ConversationPersistence } from './persistence/ConversationPersistence.js';
import type { AnthropicProviderConfig } from './config/types.js';
import { createMockFetch } from './test/helpers/createMocks.js';
// Use same structure as createMockLogger() but with test-specific overrides (avoids hoisting issues)
vi.mock('./logger.js', () => ({
  // Main logger object - same structure as createMockLogger()
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logAssistantStep: vi.fn(),
    logToolCallProgress: vi.fn(),
    logMcpTool: vi.fn(),
    setLogLevel: vi.fn(),
    setLogProgress: vi.fn(),
    setSuppressConsoleOutput: vi.fn(),
    getSessionId: vi.fn(() => '01932d4c-89ab-7890-abcd-123456789ghi'),
    getLogDirectory: vi.fn(() => '/test/logs'),
    getCurrentLogProgress: vi.fn(() => 'none'),
  },
  // Individual function exports - same structure as createMockLogger() but with overrides
  getSessionId: vi.fn(() => '01932d4c-89ab-7890-abcd-123456789ghi'),
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
  createSessionId: vi.fn(() => '01932d4c-89ab-7890-abcd-123456789ghi'),
}));

// Mock all external dependencies
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(),
  createOpenAI: vi.fn(),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(),
}));

vi.mock('./providers/anthropicAuth.js', () => ({
  createAnthropicAuthFetch: vi.fn(),
}));

vi.mock('./providers/googleAuth.js', () => ({
  createGoogleAuthConfig: vi.fn(),
}));

vi.mock('./providers/certificateAwareFetch.js', () => ({
  createCertificateAwareFetch: vi.fn(() => fetch),
}));

vi.mock('./auth/index.js', () => ({
  AnthropicOAuth: {
    create: vi.fn(),
    isAuthenticated: vi.fn(),
    hasOAuthCredentials: vi.fn(),
  },
}));

vi.mock('./mcp/loader.js', () => ({
  loadMCPServersWithClients: vi.fn(),
}));

vi.mock('./constants.js', () => ({
  buildSystemPrompt: vi.fn(),
}));

vi.mock('./config/index.js', () => ({
  getMCPServersFromConfig: vi.fn(),
  loadSystemPromptContent: vi.fn(),
}));

vi.mock('./agent/index.js', () => ({}));

// Use global logger mock from vitest.setup.ts and override specific methods in beforeEach

vi.mock('dotenv/config', () => ({}));

vi.mock('./persistence/ConversationPersistence.js', () => ({
  ConversationPersistence: Object.assign(
    vi.fn().mockImplementation(() => ({
      persistMessages: vi.fn(),
      loadConversation: vi.fn(),
      getLatestConversation: vi.fn(),
    })),
    {
      getProjectIdentifier: vi.fn((path: string) =>
        path.replace(/[/\\]/g, '_')
      ),
      isMessageComplete: vi.fn(() => true),
    }
  ),
}));

describe('agentSession', () => {
  let mockConfig: RuntimeConfiguration;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Mock is set up above using createMockLogger with test-specific overrides

    mockConfig = {
      message: 'test',
      stdin: false,
      json: false,
      agent: {
        logProgress: 'none',
        systemPrompt: {
          mode: 'replace',
          value: 'Test system prompt',
        },
        maxSteps: 10,
        timeout: 120000,
        logLevel: 'SILENT',
        streaming: true,
      },
      providers: {
        default: 'openrouter',
        openrouter: {
          model: 'google/gemini-2.0-flash-exp',
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
      tools: {
        globalTimeout: 300000,
        disabledInternalTools: [],
      },
      mcpServers: {},
    };

    originalConsoleError = console.error;
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    vi.clearAllMocks();
  });

  describe('initializeAgentSession', () => {
    it('should initialize with OpenAI provider', async () => {
      const mockModel = new MockLanguageModelV2({
        modelId: 'gpt-4',
        provider: 'openai',
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      });
      const mockTools: Record<string, WrappedTool> = {
        testTool: {
          description: 'Test tool',
          inputSchema: {
            parse: vi.fn(),
            safeParse: vi.fn(),
            _def: { typeName: 'ZodObject' },
          } as unknown as z.ZodSchema,
          execute: vi.fn(),
          serverName: 'test',
          toolName: 'testTool',
        },
      };
      const mockClients: MCPClientWrapper[] = [
        {
          serverName: 'test',
          serverConfig: { name: 'test', type: 'stdio', command: 'test' },
          tools: {},
          prompts: new Map(),
          resources: new Map(),
          isConnected: true,
          listPrompts: vi.fn(),
          getPrompt: vi.fn(),
          listResources: vi.fn(),
          readResource: vi.fn(),
          client: {} as unknown,
        },
      ];

      const mockProvider = Object.assign(vi.fn().mockReturnValue(mockModel), {
        chat: vi.fn().mockReturnValue(mockModel),
        languageModel: vi.fn().mockReturnValue(mockModel),
        completion: vi.fn().mockReturnValue(mockModel),
        responses: vi.fn().mockReturnValue(mockModel),
        embedding: vi.fn().mockReturnValue(mockModel),
        textEmbedding: vi.fn().mockReturnValue(mockModel),
        textEmbeddingModel: vi.fn().mockReturnValue({
          maxEmbeddingsPerCall: 1,
          supportsParallelCalls: false,
          doEmbed: vi.fn(),
        }),
        image: vi.fn().mockReturnValue(mockModel),
        imageModel: vi.fn().mockReturnValue(mockModel),
        transcription: vi.fn().mockReturnValue(mockModel),
        speech: vi.fn().mockReturnValue(mockModel),
        tools: {
          webSearchPreview: vi.fn(),
          codeInterpreter: vi.fn(),
          fileSearch: vi.fn(),
          imageGeneration: vi.fn(),
          webSearch: vi.fn()
        },
        betaChat: vi.fn().mockReturnValue(mockModel),
        betaChatCompletions: vi.fn().mockReturnValue(mockModel),
        betaCompletions: vi.fn().mockReturnValue(mockModel),
        betaEmbeddings: vi.fn().mockReturnValue(mockModel),
        betaFiles: vi.fn().mockReturnValue(mockModel),
      });
      vi.mocked(createOpenAI).mockReturnValue(mockProvider as unknown as ReturnType<typeof createOpenAI>);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: mockTools,
        clients: mockClients,
        errors: [],
      });

      const config = {
        ...mockConfig,
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          anthropic: { model: 'claude-3-5-sonnet-20241022' },
          google: { model: 'gemini-2.0-flash-exp' },
        },
      };

      const result = await initializeAgentSession(config);

      expect(result.model).toBe(mockModel);
      expect(result.systemPrompt).toBe('System prompt');
      expect(result.mcpClients).toBe(mockClients);
      expect(result.authInfo).toEqual({
        method: 'api-key',
        source: 'environment',
        details: {
          envVarName: 'OPENAI_API_KEY',
        },
      });
      // Check that mockTools are present (todo tools are also added)
      expect(result.tools.testTool).toBe(mockTools.testTool);
      expect(result.tools.todo_list).toBeDefined();
      expect(result.tools.todo_write).toBeDefined();
      expect(mockProvider).toHaveBeenCalledWith('gpt-4');
    });

    it('should initialize with OpenRouter provider', async () => {
      const mockModel = new MockLanguageModelV2({
        modelId: 'google/gemini-2.0-flash-exp',
        provider: 'openrouter',
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      });
      const mockOpenRouterModel = {
        ...mockModel,
        settings: {},
        getArgs: vi.fn(),
        defaultObjectGenerationMode: undefined,
      };

      const mockProvider = Object.assign(
        function (
          _modelId: string,
          _settings?: OpenRouterSharedSettings | OpenRouterCompletionSettings
        ) {
          return mockOpenRouterModel;
        },
        {
          chat: vi.fn(
            (_modelId: string, _settings?: OpenRouterSharedSettings) => {
              return mockOpenRouterModel;
            }
          ),
          languageModel: function (
            _modelId: string,
            _settings?: OpenRouterSharedSettings | OpenRouterCompletionSettings
          ) {
            return mockOpenRouterModel;
          },
          completion: function (
            _modelId: string,
            _settings?: OpenRouterCompletionSettings
          ) {
            return mockOpenRouterModel;
          },
          textEmbeddingModel: vi.fn(),
          embedding: vi.fn(),
        }
      ) as unknown as OpenRouterProvider;
      const mockTools: Record<string, WrappedTool> = {
        testTool: {
          description: 'Test tool',
          inputSchema: {
            parse: vi.fn(),
            safeParse: vi.fn(),
            _def: { typeName: 'ZodObject' },
          } as unknown as z.ZodSchema,
          execute: vi.fn(),
          serverName: 'test',
          toolName: 'testTool',
        },
      };
      const mockClients: MCPClientWrapper[] = [
        {
          serverName: 'test',
          serverConfig: { name: 'test', type: 'stdio', command: 'test' },
          tools: {},
          prompts: new Map(),
          resources: new Map(),
          isConnected: true,
          listPrompts: vi.fn(),
          getPrompt: vi.fn(),
          listResources: vi.fn(),
          readResource: vi.fn(),
          client: {} as unknown,
        },
      ];

      vi.mocked(createOpenRouter).mockReturnValue(mockProvider);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: mockTools,
        clients: mockClients,
        errors: [],
      });

      await initializeAgentSession(mockConfig);

      expect(createOpenRouter).toHaveBeenCalledWith({
        apiKey: process.env.OPENROUTER_API_KEY,
        fetch: expect.any(Function),
      });
      expect(mockProvider.chat).toHaveBeenCalledWith(
        'google/gemini-2.0-flash-exp'
      );
    });

    it('should initialize with Anthropic provider', async () => {
      const mockFetch = createMockFetch();
      const mockModel = new MockLanguageModelV2({
        provider: 'anthropic',
        modelId: 'claude-3-sonnet-20240229',
        supportedUrls: { '*': [/.*/] },
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      });
      const mockProvider = Object.assign(
        vi.fn((_modelId: string, _settings?: AnthropicProviderConfig) => {
          return mockModel;
        }),
        {
          languageModel: function (
            _modelId: string,
            _settings?: AnthropicProviderConfig
          ) {
            return mockModel;
          },
          chat: function (
            _modelId: string,
            _settings?: AnthropicProviderConfig
          ) {
            return mockModel;
          },
          messages: function (
            _modelId: string,
            _settings?: AnthropicProviderConfig
          ) {
            return mockModel;
          },
          textEmbeddingModel: vi.fn().mockReturnValue({
            maxEmbeddingsPerCall: 1,
            supportsParallelCalls: false,
            doEmbed: vi.fn(),
          }),
          imageModel: vi.fn().mockReturnValue(mockModel),
          tools: {
            bash_20241022: vi.fn(),
            bash_20250124: vi.fn(),
            textEditor_20241022: vi.fn(),
            textEditor_20250124: vi.fn(),
            computer_20241022: vi.fn(),
            computer_20250124: vi.fn(),
          },
        }
      ) as unknown as AnthropicProvider;
      const mockTools: Record<string, WrappedTool> = {
        testTool: {
          description: 'Test tool',
          inputSchema: {
            parse: vi.fn(),
            safeParse: vi.fn(),
            _def: { typeName: 'ZodObject' },
          } as unknown as z.ZodSchema,
          execute: vi.fn(),
          serverName: 'test',
          toolName: 'testTool',
        },
      };
      const mockClients: MCPClientWrapper[] = [
        {
          serverName: 'test',
          serverConfig: { name: 'test', type: 'stdio', command: 'test' },
          tools: {},
          prompts: new Map(),
          resources: new Map(),
          isConnected: true,
          listPrompts: vi.fn(),
          getPrompt: vi.fn(),
          listResources: vi.fn(),
          readResource: vi.fn(),
          client: {} as unknown,
        },
      ];

      vi.mocked(AnthropicOAuth.isAuthenticated).mockResolvedValue(false);
      vi.mocked(AnthropicOAuth.hasOAuthCredentials).mockResolvedValue(false);
      vi.mocked(createAnthropicAuthFetch).mockReturnValue(mockFetch);
      vi.mocked(createAnthropic).mockReturnValue(mockProvider);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: mockTools,
        clients: mockClients,
        errors: [],
      });

      const config = {
        ...mockConfig,
        providers: {
          default: 'anthropic',
          anthropic: { model: 'claude-sonnet-4' },
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          google: { model: 'gemini-2.0-flash-exp' },
        },
      };

      await initializeAgentSession(config);

      expect(AnthropicOAuth.isAuthenticated).toHaveBeenCalled();
      expect(createAnthropicAuthFetch).toHaveBeenCalled();
      expect(createAnthropic).toHaveBeenCalledWith({
        apiKey: '',
        baseURL: undefined,
        fetch: expect.any(Function),
      });
      expect(mockProvider).toHaveBeenCalledWith('claude-sonnet-4');
    });

    it('should not pass API key when OAuth credentials exist', async () => {
      const mockFetch = createMockFetch();
      const mockModel = new MockLanguageModelV2({
        provider: 'anthropic',
        modelId: 'claude-3-sonnet-20240229',
        supportedUrls: { '*': [/.*/] },
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      });
      const mockProvider = Object.assign(
        vi.fn((_modelId: string, _settings?: AnthropicProviderConfig) => {
          return mockModel;
        }),
        {
          languageModel: function (
            _modelId: string,
            _settings?: AnthropicProviderConfig
          ) {
            return mockModel;
          },
          chat: function (
            _modelId: string,
            _settings?: AnthropicProviderConfig
          ) {
            return mockModel;
          },
          messages: function (
            _modelId: string,
            _settings?: AnthropicProviderConfig
          ) {
            return mockModel;
          },
          textEmbeddingModel: vi.fn().mockReturnValue({
            maxEmbeddingsPerCall: 1,
            supportsParallelCalls: false,
            doEmbed: vi.fn(),
          }),
          imageModel: vi.fn().mockReturnValue(mockModel),
          tools: {
            bash_20241022: vi.fn(),
            bash_20250124: vi.fn(),
            textEditor_20241022: vi.fn(),
            textEditor_20250124: vi.fn(),
            computer_20241022: vi.fn(),
            computer_20250124: vi.fn(),
          },
        }
      ) as unknown as AnthropicProvider;
      const mockTools: Record<string, WrappedTool> = {
        testTool: {
          description: 'Test tool',
          inputSchema: {
            parse: vi.fn(),
            safeParse: vi.fn(),
            _def: { typeName: 'ZodObject' },
          } as unknown as z.ZodSchema,
          execute: vi.fn(),
          serverName: 'test',
          toolName: 'testTool',
        },
      };
      const mockClients: MCPClientWrapper[] = [
        {
          serverName: 'test',
          serverConfig: { name: 'test', type: 'stdio', command: 'test' },
          tools: {},
          prompts: new Map(),
          resources: new Map(),
          isConnected: true,
          listPrompts: vi.fn(),
          getPrompt: vi.fn(),
          listResources: vi.fn(),
          readResource: vi.fn(),
          client: {} as unknown,
        },
      ];

      // Mock that OAuth credentials exist
      vi.mocked(AnthropicOAuth.isAuthenticated).mockResolvedValue(true);
      vi.mocked(AnthropicOAuth.hasOAuthCredentials).mockResolvedValue(true);
      vi.mocked(createAnthropicAuthFetch).mockReturnValue(mockFetch);
      vi.mocked(createAnthropic).mockReturnValue(mockProvider);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: mockTools,
        clients: mockClients,
        errors: [],
      });

      const config = {
        ...mockConfig,
        providers: {
          default: 'anthropic',
          anthropic: { model: 'claude-sonnet-4' },
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          google: { model: 'gemini-2.0-flash-exp' },
        },
      };

      // Set an API key in environment to ensure it's not used
      process.env.ANTHROPIC_API_KEY = 'test-api-key';

      await initializeAgentSession(config);

      // Verify that createAnthropicAuthFetch was called with undefined apiKey
      expect(createAnthropicAuthFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: undefined, // Should be undefined when OAuth credentials exist
        })
      );

      // Clean up
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should initialize with Google provider', async () => {
      const mockAuthConfig = { apiKey: 'test-key', headers: {} };
      const mockProvider = Object.assign(
        vi.fn().mockReturnValue({ name: 'gemini' }),
        {
          chat: vi.fn().mockReturnValue({ name: 'gemini' }),
          languageModel: vi.fn().mockReturnValue({ name: 'gemini' }),
          generateContent: vi.fn().mockReturnValue({ name: 'gemini' }),
          generativeAI: vi.fn().mockReturnValue({ name: 'gemini' }),
          embedding: vi.fn().mockReturnValue({ name: 'gemini' }),
          textEmbedding: vi.fn().mockReturnValue({ name: 'gemini' }),
          textEmbeddingModel: vi.fn().mockReturnValue({ name: 'gemini' }),
          image: vi.fn().mockReturnValue({ name: 'gemini' }),
          imageModel: vi.fn().mockReturnValue({ name: 'gemini' }),
          tools: {},
        }
      );
      const mockTools: Record<string, WrappedTool> = {
        testTool: {
          description: 'Test tool',
          inputSchema: {
            parse: vi.fn(),
            safeParse: vi.fn(),
            _def: { typeName: 'ZodObject' },
          } as unknown as z.ZodSchema,
          execute: vi.fn(),
          serverName: 'test',
          toolName: 'testTool',
        },
      };
      const mockClients: MCPClientWrapper[] = [
        {
          serverName: 'test',
          serverConfig: { name: 'test', type: 'stdio', command: 'test' },
          tools: {},
          prompts: new Map(),
          resources: new Map(),
          isConnected: true,
          listPrompts: vi.fn(),
          getPrompt: vi.fn(),
          listResources: vi.fn(),
          readResource: vi.fn(),
          client: {} as unknown,
        },
      ];

      vi.mocked(createGoogleAuthConfig).mockReturnValue(mockAuthConfig);
      vi.mocked(createGoogleGenerativeAI).mockReturnValue(mockProvider as unknown as ReturnType<typeof createGoogleGenerativeAI>);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: mockTools,
        clients: mockClients,
        errors: [],
      });

      const config = {
        ...mockConfig,
        providers: {
          default: 'google',
          google: { model: 'gemini-2.5-pro' },
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          anthropic: { model: 'claude-3-5-sonnet-20241022' },
        },
      };

      await initializeAgentSession(config);

      expect(createGoogleAuthConfig).toHaveBeenCalled();
      expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: undefined,
        headers: undefined,
        fetch: expect.any(Function),
      });
      expect(mockProvider).toHaveBeenCalledWith('gemini-2.5-pro');
    });

    it('should throw error for unsupported provider', async () => {
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: {},
        clients: [],
        errors: [],
      });

      const config = {
        ...mockConfig,
        providers: {
          default: 'unsupported',
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          anthropic: { model: 'claude-3-5-sonnet-20241022' },
          google: { model: 'gemini-2.0-flash-exp' },
        },
      };

      await expect(initializeAgentSession(config)).rejects.toThrow(
        'Unsupported provider: unsupported'
      );
    });

    it('should handle default model selection for different providers', async () => {
      const mockProvider = Object.assign(
        vi.fn().mockReturnValue({ name: 'o4-mini' }),
        {
          chat: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          languageModel: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          completion: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          responses: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          embedding: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          textEmbedding: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          textEmbeddingModel: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          image: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          imageModel: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          transcription: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          speech: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          tools: {
          webSearchPreview: vi.fn(),
          codeInterpreter: vi.fn(),
          fileSearch: vi.fn(),
          imageGeneration: vi.fn(),
          webSearch: vi.fn()
        },
          betaChat: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          betaChatCompletions: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          betaCompletions: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          betaEmbeddings: vi.fn().mockReturnValue({ name: 'o4-mini' }),
          betaFiles: vi.fn().mockReturnValue({ name: 'o4-mini' }),
        }
      );
      vi.mocked(createOpenAI).mockReturnValue(mockProvider as unknown as ReturnType<typeof createOpenAI>);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: {},
        clients: [],
        errors: [],
      });

      // Test with no specific model configured
      const config = {
        ...mockConfig,
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          anthropic: { model: 'claude-3-5-sonnet-20241022' },
          google: { model: 'gemini-2.0-flash-exp' },
        },
      };

      await initializeAgentSession(config);

      expect(mockProvider).toHaveBeenCalledWith('gpt-4');
    });

    it('should handle system prompt loading', async () => {
      const mockProvider = Object.assign(
        vi.fn().mockReturnValue({ name: 'gpt-4' }),
        {
          chat: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          languageModel: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          completion: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          responses: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          embedding: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          textEmbedding: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          textEmbeddingModel: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaChat: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaChatCompletions: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaCompletions: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaEmbeddings: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaFiles: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          image: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          imageModel: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          transcription: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          speech: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          tools: {
          webSearchPreview: vi.fn(),
          codeInterpreter: vi.fn(),
          fileSearch: vi.fn(),
          imageGeneration: vi.fn(),
          webSearch: vi.fn()
        },
        }
      );
      vi.mocked(createOpenAI).mockReturnValue(mockProvider as unknown as ReturnType<typeof createOpenAI>);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue('Custom prompt');
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: {},
        clients: [],
        errors: [],
      });

      const config = {
        ...mockConfig,
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          anthropic: { model: 'claude-3-5-sonnet-20241022' },
          google: { model: 'gemini-2.0-flash-exp' },
        },
        agent: {
          ...mockConfig.agent,
          systemPrompt: {
            mode: 'append' as const,
            value: 'prompt1.txt',
          },
        },
      };

      const result = await initializeAgentSession(config);

      expect(loadSystemPromptContent).toHaveBeenCalledWith({
        mode: 'append',
        value: 'prompt1.txt',
      });
      expect(buildSystemPrompt).toHaveBeenCalledWith(
        'Custom prompt',
        'append',
        true
      );
      expect(result.systemPrompt).toEqual('System prompt');
    });

    it('should handle MCP servers loading', async () => {
      const mockMCPServers = [
        {
          name: 'test-server',
          type: 'stdio' as const,
          command: 'test',
          args: [],
        },
      ];
      const mockClients: MCPClientWrapper[] = [
        {
          serverName: 'test-server',
          serverConfig: { name: 'test-server', type: 'stdio', command: 'test' },
          tools: {},
          prompts: new Map(),
          resources: new Map(),
          isConnected: true,
          listPrompts: vi.fn(),
          getPrompt: vi.fn(),
          listResources: vi.fn(),
          readResource: vi.fn(),
          client: {} as unknown,
        },
      ];
      const mockTools: Record<string, WrappedTool> = {
        testTool: {
          description: 'Test tool',
          inputSchema: {
            parse: vi.fn(),
            safeParse: vi.fn(),
            _def: { typeName: 'ZodObject' },
          } as unknown as z.ZodSchema,
          execute: vi.fn(),
          serverName: 'test-server',
          toolName: 'testTool',
        },
      };

      const mockProvider = Object.assign(
        vi.fn().mockReturnValue({ name: 'gpt-4' }),
        {
          chat: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          languageModel: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          completion: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          responses: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          embedding: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          textEmbedding: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          textEmbeddingModel: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaChat: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaChatCompletions: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaCompletions: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaEmbeddings: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaFiles: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          image: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          imageModel: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          transcription: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          speech: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          tools: {
          webSearchPreview: vi.fn(),
          codeInterpreter: vi.fn(),
          fileSearch: vi.fn(),
          imageGeneration: vi.fn(),
          webSearch: vi.fn()
        },
        }
      );
      vi.mocked(createOpenAI).mockReturnValue(mockProvider as unknown as ReturnType<typeof createOpenAI>);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue(mockMCPServers);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: mockTools,
        clients: mockClients,
        errors: [],
      });

      const config = {
        ...mockConfig,
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          anthropic: { model: 'claude-3-5-sonnet-20241022' },
          google: { model: 'gemini-2.0-flash-exp' },
        },
      };

      const result = await initializeAgentSession(config);

      expect(getMCPServersFromConfig).toHaveBeenCalledWith(config);
      expect(loadMCPServersWithClients).toHaveBeenCalledWith(
        mockMCPServers,
        config
      );
      expect(result.mcpClients).toBe(mockClients);
      // Tools should include mockTools and built-in todo tools
      expect(result.tools.testTool).toBe(mockTools.testTool);
      expect(result.tools.todo_list).toBeDefined();
      expect(result.tools.todo_write).toBeDefined();
    });

    it('should handle dotenv import failure gracefully', async () => {
      const mockProvider = Object.assign(
        vi.fn().mockReturnValue({ name: 'gpt-4' }),
        {
          chat: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          languageModel: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          completion: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          responses: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          embedding: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          textEmbedding: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          textEmbeddingModel: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaChat: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaChatCompletions: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaCompletions: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaEmbeddings: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          betaFiles: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          image: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          imageModel: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          transcription: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          speech: vi.fn().mockReturnValue({ name: 'gpt-4' }),
          tools: {
          webSearchPreview: vi.fn(),
          codeInterpreter: vi.fn(),
          fileSearch: vi.fn(),
          imageGeneration: vi.fn(),
          webSearch: vi.fn()
        },
        }
      );
      vi.mocked(createOpenAI).mockReturnValue(mockProvider as unknown as ReturnType<typeof createOpenAI>);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: {},
        clients: [],
        errors: [],
      });

      // Mock dotenv import to throw
      vi.doMock('dotenv/config', () => {
        throw new Error('dotenv not found');
      });

      const config = {
        ...mockConfig,
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          anthropic: { model: 'claude-3-5-sonnet-20241022' },
          google: { model: 'gemini-2.0-flash-exp' },
        },
      };

      // Should not throw, dotenv failure is handled gracefully
      await expect(initializeAgentSession(config)).resolves.toBeDefined();
    });
  });

  describe('cleanupAgentSession', () => {
    it('should cleanup MCP clients', async () => {
      const mockClient1 = createMockMCPClientWrapper({
        serverName: 'server1',
        serverConfig: {
          name: 'server1',
          type: 'stdio' as const,
          command: 'test',
        },
      });
      const mockClient2 = createMockMCPClientWrapper({
        serverName: 'server2',
        serverConfig: {
          name: 'server2',
          type: 'stdio' as const,
          command: 'test',
        },
      });
      const mockSession = createMockAgentSession({
        mcpClients: [mockClient1, mockClient2],
      });

      await cleanupAgentSession(mockSession);

      // Process cleanup is now handled globally by ProcessManager
      // No individual disconnect calls are made
    });

    it('should handle clients without disconnect method', async () => {
      const mockClient1 = createMockMCPClientWrapper({
        serverName: 'server1',
        serverConfig: {
          name: 'server1',
          type: 'stdio' as const,
          command: 'test',
        },
      });
      const mockClient2 = createMockMCPClientWrapper({
        serverName: 'server2',
        serverConfig: {
          name: 'server2',
          type: 'stdio' as const,
          command: 'test',
        },
      });
      const mockSession = createMockAgentSession({
        mcpClients: [mockClient1, mockClient2],
      });

      // Should not throw
      await expect(cleanupAgentSession(mockSession)).resolves.toBeUndefined();
    });

    it('should handle empty mcpClients array', async () => {
      const mockSession = createMockAgentSession({
        mcpClients: [],
      });

      // Should not throw
      await expect(cleanupAgentSession(mockSession)).resolves.toBeUndefined();
    });

    it('should handle disconnect errors gracefully', async () => {
      const mockClient = createMockMCPClientWrapper({
        serverName: 'server1',
        serverConfig: {
          name: 'server1',
          type: 'stdio' as const,
          command: 'test',
        },
      });
      const mockSession = createMockAgentSession({
        mcpClients: [mockClient],
      });

      // Should not throw (process cleanup handled globally by ProcessManager)
      await expect(cleanupAgentSession(mockSession)).resolves.toBeUndefined();
      // No individual disconnect calls are made
    });
  });

  describe('conversation persistence integration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should include conversationPersistence when persistence is enabled', async () => {
      const mockModel = {
        specificationVersion: 'v1' as const,
        provider: 'openai',
        modelId: 'gpt-4',
        defaultObjectGenerationMode: 'json' as const,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      };
      const mockProvider = Object.assign(vi.fn().mockReturnValue(mockModel), {
        chat: vi.fn().mockReturnValue(mockModel),
        languageModel: vi.fn().mockReturnValue(mockModel),
        completion: vi.fn().mockReturnValue(mockModel),
        responses: vi.fn().mockReturnValue(mockModel),
        embedding: vi.fn().mockReturnValue(mockModel),
        textEmbedding: vi.fn().mockReturnValue(mockModel),
        textEmbeddingModel: vi.fn().mockReturnValue({
          maxEmbeddingsPerCall: 1,
          supportsParallelCalls: false,
          doEmbed: vi.fn(),
        }),
        image: vi.fn().mockReturnValue(mockModel),
        imageModel: vi.fn().mockReturnValue(mockModel),
        transcription: vi.fn().mockReturnValue(mockModel),
        speech: vi.fn().mockReturnValue(mockModel),
        tools: {
          webSearchPreview: vi.fn().mockReturnValue(mockModel),
        },
      });

      vi.mocked(createOpenAI).mockReturnValue(mockProvider as unknown as ReturnType<typeof createOpenAI>);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: {},
        clients: [],
        errors: [],
      });

      const configWithPersistence = {
        ...mockConfig,
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          anthropic: { model: 'claude-3-5-sonnet-20241022' },
          google: { model: 'gemini-2.0-flash-exp' },
        },
        agent: {
          ...mockConfig.agent,
          conversationPersistence: {
            enabled: true,
            projectPath: '/test/project',
          },
        },
      };

      const result = await initializeAgentSession(configWithPersistence);

      expect(result.conversationPersistence).toBeDefined();
      expect(ConversationPersistence).toHaveBeenCalledWith(
        '01932d4c-89ab-7890-abcd-123456789ghi',
        expect.any(String)
      );
    });

    it('should not include conversationPersistence when persistence is disabled', async () => {
      const mockModel = {
        specificationVersion: 'v1' as const,
        provider: 'openai',
        modelId: 'gpt-4',
        defaultObjectGenerationMode: 'json' as const,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      };
      const mockProvider = Object.assign(vi.fn().mockReturnValue(mockModel), {
        chat: vi.fn().mockReturnValue(mockModel),
        languageModel: vi.fn().mockReturnValue(mockModel),
        completion: vi.fn().mockReturnValue(mockModel),
        responses: vi.fn().mockReturnValue(mockModel),
        embedding: vi.fn().mockReturnValue(mockModel),
        textEmbedding: vi.fn().mockReturnValue(mockModel),
        textEmbeddingModel: vi.fn().mockReturnValue({
          maxEmbeddingsPerCall: 1,
          supportsParallelCalls: false,
          doEmbed: vi.fn(),
        }),
        image: vi.fn().mockReturnValue(mockModel),
        imageModel: vi.fn().mockReturnValue(mockModel),
        transcription: vi.fn().mockReturnValue(mockModel),
        speech: vi.fn().mockReturnValue(mockModel),
        tools: {
          webSearchPreview: vi.fn().mockReturnValue(mockModel),
        },
      });

      vi.mocked(createOpenAI).mockReturnValue(mockProvider as unknown as ReturnType<typeof createOpenAI>);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: {},
        clients: [],
        errors: [],
      });

      const configWithoutPersistence = {
        ...mockConfig,
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4' },
          openrouter: { model: 'test-model' },
          anthropic: { model: 'claude-3-5-sonnet-20241022' },
          google: { model: 'gemini-2.0-flash-exp' },
        },
        agent: {
          ...mockConfig.agent,
          conversationPersistence: {
            enabled: false,
          },
        },
      };

      const result = await initializeAgentSession(configWithoutPersistence);

      expect(result.conversationPersistence).toBeUndefined();
    });

    it('should not include conversationPersistence when persistence config is missing', async () => {
      const mockModel = {
        specificationVersion: 'v1' as const,
        provider: 'openai',
        modelId: 'gpt-4',
        defaultObjectGenerationMode: 'json' as const,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      };
      const mockProvider = Object.assign(vi.fn().mockReturnValue(mockModel), {
        chat: vi.fn().mockReturnValue(mockModel),
        languageModel: vi.fn().mockReturnValue(mockModel),
        completion: vi.fn().mockReturnValue(mockModel),
        responses: vi.fn().mockReturnValue(mockModel),
        embedding: vi.fn().mockReturnValue(mockModel),
        textEmbedding: vi.fn().mockReturnValue(mockModel),
        textEmbeddingModel: vi.fn().mockReturnValue({
          maxEmbeddingsPerCall: 1,
          supportsParallelCalls: false,
          doEmbed: vi.fn(),
        }),
        image: vi.fn().mockReturnValue(mockModel),
        imageModel: vi.fn().mockReturnValue(mockModel),
        transcription: vi.fn().mockReturnValue(mockModel),
        speech: vi.fn().mockReturnValue(mockModel),
        tools: {
          webSearchPreview: vi.fn().mockReturnValue(mockModel),
        },
      });

      vi.mocked(createOpenAI).mockReturnValue(mockProvider as unknown as ReturnType<typeof createOpenAI>);
      vi.mocked(buildSystemPrompt).mockReturnValue('System prompt');
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);
      vi.mocked(loadSystemPromptContent).mockResolvedValue(
        'Test system prompt'
      );
      vi.mocked(loadMCPServersWithClients).mockResolvedValue({
        tools: {},
        clients: [],
        errors: [],
      });

      // Use config without persistence - change provider to avoid openrouter mock issue
      const configWithoutPersistenceConfig = {
        ...mockConfig,
        providers: {
          ...mockConfig.providers,
          default: 'openai',
        },
      };
      const result = await initializeAgentSession(
        configWithoutPersistenceConfig
      );

      expect(result.conversationPersistence).toBeUndefined();
    });
  });
});
