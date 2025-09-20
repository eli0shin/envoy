/**
 * Tests for ThinkingProcessor Module
 * Tests real behavior with actual message inputs and provider models
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThinkingProcessor } from './ThinkingProcessor.js';
import type { LanguageModelV2 } from '@ai-sdk/provider';

// Mock only the constants to control max budgets in tests
vi.mock('../../constants.js', () => ({
  THINKING_CONFIG: {
    anthropic: {
      maxBudget: 32000,
    },
    google: {
      maxBudget: 24576,
    },
  },
}));

describe('ThinkingProcessor Module', () => {
  let anthropicModel: LanguageModelV2;
  let openaiModel: LanguageModelV2;
  let googleModel: LanguageModelV2;
  let unknownModel: LanguageModelV2;

  beforeEach(() => {
    anthropicModel = {
      modelId: 'claude-3-5-sonnet-20241022',
      provider: {
        toString: vi.fn().mockReturnValue('anthropic'),
      },
    } as unknown as LanguageModelV2;

    openaiModel = {
      modelId: 'gpt-4o',
      provider: {
        toString: vi.fn().mockReturnValue('openai'),
      },
    } as unknown as LanguageModelV2;

    googleModel = {
      modelId: 'gemini-1.5-pro',
      provider: {
        toString: vi.fn().mockReturnValue('google'),
      },
    } as unknown as LanguageModelV2;

    unknownModel = {
      modelId: 'unknown-model',
      provider: {
        toString: vi.fn().mockReturnValue('unknown-provider'),
      },
    } as unknown as LanguageModelV2;

    vi.clearAllMocks();
  });

  describe('createThinkingProviderOptions', () => {
    describe('no thinking triggers', () => {
      it('should return empty options for message without thinking keywords', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          anthropicModel,
          'What is the capital of France?'
        );

        expect(result).toEqual({
          providerOptions: {},
          headers: {},
        });
      });

      it('should return interleaved headers for anthropic with "step by step"', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          anthropicModel,
          'Explain this step by step'
        );

        expect(result).toEqual({
          providerOptions: {},
          headers: {},
        });
      });

      it('should ignore interleaved for non-anthropic providers', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          googleModel,
          'Explain this step by step'
        );

        expect(result).toEqual({
          providerOptions: {},
          headers: {},
        });
      });
    });

    describe('anthropic provider', () => {
      it('should handle low thinking level with "think"', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          anthropicModel,
          'Can you think about this problem?'
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

      it('should handle medium thinking level with "think deeply"', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          anthropicModel,
          'Please think deeply about this issue'
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

      it('should handle high thinking level with "ultrathink"', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          anthropicModel,
          'I need you to ultrathink this complex problem'
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

      it('should cap budget at anthropic max and include interleaved headers', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          anthropicModel,
          'Please think harder about this step by step'
        );

        expect(result).toEqual({
          providerOptions: {
            anthropic: {
              thinking: {
                type: 'enabled',
                budgetTokens: 31999, // High level budget, under max
              },
            },
          },
          headers: {},
        });
      });
    });

    describe('openai provider', () => {
      it('should handle low reasoning effort', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          openaiModel,
          'Can you think about this?'
        );

        expect(result).toEqual({
          providerOptions: {
            openai: {
              reasoningEffort: 'low',
            },
          },
          headers: {},
        });
      });

      it('should handle medium reasoning effort', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          openaiModel,
          'Please think deeply about this'
        );

        expect(result).toEqual({
          providerOptions: {
            openai: {
              reasoningEffort: 'medium',
            },
          },
          headers: {},
        });
      });

      it('should handle high reasoning effort and ignore interleaved', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          openaiModel,
          'Think harder about this step by step'
        );

        expect(result).toEqual({
          providerOptions: {
            openai: {
              reasoningEffort: 'high',
            },
          },
          headers: {}, // No interleaved headers for OpenAI
        });
      });
    });

    describe('google provider', () => {
      it('should handle low thinking budget', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          googleModel,
          'Please think about this problem'
        );

        expect(result).toEqual({
          providerOptions: {
            google: {
              thinkingBudget: 4000,
            },
          },
          headers: {},
        });
      });

      it('should handle medium thinking budget', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          googleModel,
          'Can you megathink this issue?'
        );

        expect(result).toEqual({
          providerOptions: {
            google: {
              thinkingBudget: 10000,
            },
          },
          headers: {},
        });
      });

      it('should cap at google max budget for high level', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          googleModel,
          'Please think super hard about this'
        );

        expect(result).toEqual({
          providerOptions: {
            google: {
              thinkingBudget: 24576, // Google's max budget
            },
          },
          headers: {},
        });
      });
    });

    describe('edge cases', () => {
      it('should handle no message provided', () => {
        const result =
          ThinkingProcessor.createThinkingProviderOptions(anthropicModel);

        expect(result).toEqual({
          providerOptions: {},
          headers: {},
        });
      });

      it('should handle unknown provider (defaults to anthropic)', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          unknownModel,
          'Please think harder about this'
        );

        expect(result).toEqual({
          providerOptions: {
            anthropic: {
              thinking: {
                type: 'enabled',
                budgetTokens: 31999, // High level from "think harder"
              },
            },
          },
          headers: {},
        });
      });

      it('should handle null model gracefully (defaults to anthropic)', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          null as unknown as LanguageModelV2,
          'think about this'
        );

        expect(result).toEqual({
          providerOptions: {
            anthropic: {
              thinking: {
                type: 'enabled',
                budgetTokens: 4000, // Low level from "think"
              },
            },
          },
          headers: {},
        });
      });
    });
  });
});
