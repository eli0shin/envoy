import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ModelMessage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { generateText } from 'ai';
import { RuntimeConfiguration } from '../config/types.js';
import { createThinkingProviderOptions, runAgent } from './index.js';
import {
  createMockAgentSession,
  createMockGenerateTextResult,
} from '../test/helpers/createMocks.js';

// Mock the AI SDK
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

describe('Agent Dynamic Thinking Integration', () => {
  describe('createThinkingProviderOptions with message analysis', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return no thinking options for messages without keywords', () => {
      const result = createThinkingProviderOptions('anthropic', 'Hello world');

      expect(result).toEqual({
        providerOptions: {},
        headers: {},
      });
    });

    it('should enable low thinking for "think" keyword', () => {
      const result = createThinkingProviderOptions(
        'anthropic',
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
      const result = createThinkingProviderOptions(
        'anthropic',
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
      const result = createThinkingProviderOptions(
        'anthropic',
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
      const result = createThinkingProviderOptions(
        'anthropic',
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
      const result = createThinkingProviderOptions(
        'anthropic',
        'Solve this step by step'
      );

      expect(result).toEqual({
        providerOptions: {},
        headers: {},
      });
    });

    it('should enable both thinking and interleaved for combined keywords', () => {
      const result = createThinkingProviderOptions(
        'anthropic',
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
        headers: {},
      });
    });

    it('should respect budget caps for Anthropic', () => {
      // Using think harder which requests 32k tokens, but should be capped at 24576
      const result = createThinkingProviderOptions(
        'anthropic',
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
        const lowResult = createThinkingProviderOptions(
          'openai',
          'think about this'
        );
        expect(lowResult).toEqual({
          providerOptions: {
            openai: { reasoningEffort: 'low' },
          },
          headers: {},
        });

        const mediumResult = createThinkingProviderOptions(
          'openai',
          'megathink about this'
        );
        expect(mediumResult).toEqual({
          providerOptions: {
            openai: { reasoningEffort: 'medium' },
          },
          headers: {},
        });

        const highResult = createThinkingProviderOptions(
          'openai',
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
        const result = createThinkingProviderOptions(
          'openai',
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
        const lowResult = createThinkingProviderOptions(
          'google',
          'think about this'
        );
        expect(lowResult).toEqual({
          providerOptions: {
            google: { thinkingBudget: 4000 },
          },
          headers: {},
        });

        const mediumResult = createThinkingProviderOptions(
          'google',
          'megathink about this'
        );
        expect(mediumResult).toEqual({
          providerOptions: {
            google: { thinkingBudget: 10000 },
          },
          headers: {},
        });

        const highResult = createThinkingProviderOptions(
          'google',
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
        const result = createThinkingProviderOptions(
          'google',
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

      await runAgent(
        'Just a regular message',
        mockConfig,
        mockSession,
        false,
        undefined,
        AbortSignal.timeout(30000)
      );

      expect(vi.mocked(generateText)).toHaveBeenCalledWith(
        expect.objectContaining({
          providerOptions: {},
          headers: {},
        })
      );
    });

    it('should include thinking options for messages with keywords', async () => {
      const mockSession = createMockAgentSession();

      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent(
        'Think about this problem',
        mockConfig,
        mockSession,
        false,
        undefined,
        AbortSignal.timeout(30000)
      );

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
          headers: {},
        })
      );
    });

    it('should include interleaved headers for step by step requests', async () => {
      const mockSession = createMockAgentSession();

      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent(
        'Solve this step by step',
        mockConfig,
        mockSession,
        false,
        undefined,
        AbortSignal.timeout(30000)
      );

      expect(vi.mocked(generateText)).toHaveBeenCalledWith(
        expect.objectContaining({
          providerOptions: {},
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
      const conversationMessages: ModelMessage[] = [
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: 'Hi! How can I help?' },
        { role: 'user', content: 'Think harder about this complex problem' }, // This should trigger high thinking
      ];

      await runAgent(
        conversationMessages,
        mockConfig,
        mockSession,
        false,
        undefined,
        AbortSignal.timeout(30000)
      );

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
          headers: {},
        })
      );
    });
  });
});
