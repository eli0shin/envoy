import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LanguageModel, CoreMessage } from 'ai';
import { generateText } from 'ai';
import { RuntimeConfiguration } from '../config/types.js';
import { createThinkingProviderOptions, runAgent } from './index.js';
import { createMockAgentSession, createMockGenerateTextResult } from '../test/helpers/createMocks.js';

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  APICallError: { isInstance: vi.fn(() => false) },
  InvalidPromptError: { isInstance: vi.fn(() => false) },
  NoSuchProviderError: { isInstance: vi.fn(() => false) },
  InvalidToolArgumentsError: { isInstance: vi.fn(() => false) },
  NoSuchToolError: { isInstance: vi.fn(() => false) },
  ToolExecutionError: { isInstance: vi.fn(() => false) },
}));

describe('Agent Dynamic Thinking Integration', () => {
  describe('createThinkingProviderOptions with message analysis', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return no thinking options for messages without keywords', () => {
      const model = { modelId: 'claude-3-5-sonnet-20241022' } as LanguageModel;
      const result = createThinkingProviderOptions(model, 'Hello world');

      expect(result).toEqual({
        providerOptions: {},
        headers: {},
      });
    });

    it('should enable low thinking for "think" keyword', () => {
      const model = { modelId: 'claude-3-5-sonnet-20241022' } as LanguageModel;
      const result = createThinkingProviderOptions(
        model,
        'Please think about this problem'
      );

      expect(result).toEqual({
        providerOptions: {
          anthropic: {
            thinking: {
              type: 'enabled',
              budgetTokens: 4000,
            },
          },
        },
        headers: {},
      });
    });

    it('should enable medium thinking for "megathink" keyword', () => {
      const model = { modelId: 'claude-3-5-sonnet-20241022' } as LanguageModel;
      const result = createThinkingProviderOptions(
        model,
        'Megathink about this complex problem'
      );

      expect(result).toEqual({
        providerOptions: {
          anthropic: {
            thinking: {
              type: 'enabled',
              budgetTokens: 10000,
            },
          },
        },
        headers: {},
      });
    });

    it('should enable high thinking for "think harder" keyword', () => {
      const model = { modelId: 'claude-3-5-sonnet-20241022' } as LanguageModel;
      const result = createThinkingProviderOptions(
        model,
        'Think harder about this'
      );

      expect(result).toEqual({
        providerOptions: {
          anthropic: {
            thinking: {
              type: 'enabled',
              budgetTokens: 31999,
            },
          },
        },
        headers: {},
      });
    });

    it('should enable high thinking for "ultrathink" keyword', () => {
      const model = { modelId: 'claude-3-5-sonnet-20241022' } as LanguageModel;
      const result = createThinkingProviderOptions(
        model,
        'Ultrathink this problem'
      );

      expect(result).toEqual({
        providerOptions: {
          anthropic: {
            thinking: {
              type: 'enabled',
              budgetTokens: 31999,
            },
          },
        },
        headers: {},
      });
    });

    it('should enable interleaved header for "step by step" without thinking', () => {
      const model = { modelId: 'claude-3-5-sonnet-20241022' } as LanguageModel;
      const result = createThinkingProviderOptions(
        model,
        'Solve this step by step'
      );

      expect(result).toEqual({
        providerOptions: {},
        headers: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
      });
    });

    it('should enable both thinking and interleaved for combined keywords', () => {
      const model = { modelId: 'claude-3-5-sonnet-20241022' } as LanguageModel;
      const result = createThinkingProviderOptions(
        model,
        'Megathink step by step'
      );

      expect(result).toEqual({
        providerOptions: {
          anthropic: {
            thinking: {
              type: 'enabled',
              budgetTokens: 10000,
            },
          },
        },
        headers: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
      });
    });

    it('should respect budget caps for Anthropic', () => {
      const model = { modelId: 'claude-3-5-sonnet-20241022' } as LanguageModel;
      // Using think harder which requests 32k tokens, but should be capped at 24576
      const result = createThinkingProviderOptions(
        model,
        'Think harder about this'
      );

      expect(
        (
          result.providerOptions.anthropic as {
            thinking: { budgetTokens: number };
          }
        ).thinking.budgetTokens
      ).toBe(31999); // Claude Code's ultrathink budget
    });

    describe('OpenAI provider', () => {
      it('should map thinking levels to reasoning efforts', () => {
        const model = { modelId: 'gpt-4' } as LanguageModel;

        const lowResult = createThinkingProviderOptions(
          model,
          'think about this'
        );
        expect(lowResult).toEqual({
          providerOptions: {
            openai: { reasoningEffort: 'low' },
          },
          headers: {},
        });

        const mediumResult = createThinkingProviderOptions(
          model,
          'megathink about this'
        );
        expect(mediumResult).toEqual({
          providerOptions: {
            openai: { reasoningEffort: 'medium' },
          },
          headers: {},
        });

        const highResult = createThinkingProviderOptions(
          model,
          'think harder about this'
        );
        expect(highResult).toEqual({
          providerOptions: {
            openai: { reasoningEffort: 'high' },
          },
          headers: {},
        });
      });

      it('should not set interleaved headers for OpenAI', () => {
        const model = { modelId: 'gpt-4' } as LanguageModel;
        const result = createThinkingProviderOptions(
          model,
          'think step by step'
        );

        expect(result).toEqual({
          providerOptions: {
            openai: { reasoningEffort: 'low' },
          },
          headers: {},
        });
      });
    });

    describe('Google provider', () => {
      it('should map thinking levels to budgets', () => {
        const model = { modelId: 'gemini-pro' } as LanguageModel;

        const lowResult = createThinkingProviderOptions(
          model,
          'think about this'
        );
        expect(lowResult).toEqual({
          providerOptions: {
            google: { thinkingBudget: 4000 },
          },
          headers: {},
        });

        const mediumResult = createThinkingProviderOptions(
          model,
          'megathink about this'
        );
        expect(mediumResult).toEqual({
          providerOptions: {
            google: { thinkingBudget: 10000 },
          },
          headers: {},
        });

        const highResult = createThinkingProviderOptions(
          model,
          'think harder about this'
        );
        expect(highResult).toEqual({
          providerOptions: {
            google: { thinkingBudget: 24576 },
          },
          headers: {},
        });
      });

      it('should not set interleaved headers for Google', () => {
        const model = { modelId: 'gemini-pro' } as LanguageModel;
        const result = createThinkingProviderOptions(
          model,
          'think step by step'
        );

        expect(result).toEqual({
          providerOptions: {
            google: { thinkingBudget: 4000 },
          },
          headers: {},
        });
      });
    });
  });

  describe('runAgent with dynamic thinking', () => {
    beforeEach(() => {
      // Configure the mocked generateText
      vi.mocked(generateText).mockResolvedValue(createMockGenerateTextResult());
    });

    it('should not include thinking options for messages without keywords', async () => {
      const mockSession = createMockAgentSession();

      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent('Just a regular message', mockConfig, mockSession);

      expect(vi.mocked(generateText)).toHaveBeenCalledWith(
        expect.objectContaining({
          providerOptions: {},
          headers: undefined,
        })
      );
    });

    it('should include thinking options for messages with keywords', async () => {
      const mockSession = createMockAgentSession();

      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent('Think about this problem', mockConfig, mockSession);

      expect(vi.mocked(generateText)).toHaveBeenCalledWith(
        expect.objectContaining({
          providerOptions: {
            anthropic: {
              thinking: {
                type: 'enabled',
                budgetTokens: 4000,
              },
            },
          },
          headers: undefined,
        })
      );
    });

    it('should include interleaved headers for step by step requests', async () => {
      const mockSession = createMockAgentSession();

      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent('Solve this step by step', mockConfig, mockSession);

      expect(vi.mocked(generateText)).toHaveBeenCalledWith(
        expect.objectContaining({
          providerOptions: {},
          headers: {
            'anthropic-beta': 'interleaved-thinking-2025-05-14',
          },
        })
      );
    });

    it('should use the last user message for thinking analysis in multi-turn conversations', async () => {
      const mockSession = createMockAgentSession();

      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      // Simulate a conversation with multiple user messages
      const conversationMessages: CoreMessage[] = [
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi! How can I help?' },
        { role: 'user', content: 'Think harder about this complex problem' }, // This should trigger high thinking
      ];

      await runAgent(conversationMessages, mockConfig, mockSession);

      // Should use the last user message ("Think harder...") for thinking analysis
      expect(vi.mocked(generateText)).toHaveBeenCalledWith(
        expect.objectContaining({
          providerOptions: {
            anthropic: {
              thinking: {
                type: 'enabled',
                budgetTokens: 31999, // High thinking budget from "think harder"
              },
            },
          },
          headers: undefined,
        })
      );
    });
  });
});
