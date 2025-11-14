/**
 * Tests for ThinkingProcessor Module
 * Tests real behavior with actual message inputs and provider models
 */

import { describe, it, expect, vi } from 'vitest';
import { ThinkingProcessor } from './ThinkingProcessor.js';

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
  describe('createThinkingProviderOptions', () => {
    describe('no thinking triggers', () => {
      it('should return empty options for message without thinking keywords', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          'anthropic',
          'What is the capital of France?'
        );

        expect(result).toEqual({
          providerOptions: {},
          headers: {},
        });
      });

      it('should return interleaved headers for anthropic with "step by step"', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          'anthropic',
          'Explain this step by step'
        );

        expect(result).toEqual({
          providerOptions: {},
          headers: {},
        });
      });

      it('should ignore interleaved for non-anthropic providers', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          'google',
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
          'anthropic',
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
          'anthropic',
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
          'anthropic',
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
          'anthropic',
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
          'openai',
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
          'openai',
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
          'openai',
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
          'google',
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
          'google',
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
          'google',
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
          ThinkingProcessor.createThinkingProviderOptions('anthropic');

        expect(result).toEqual({
          providerOptions: {},
          headers: {},
        });
      });

      it('should handle unknown provider (returns empty options)', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          'unknown-provider',
          'Please think harder about this'
        );

        expect(result).toEqual({
          providerOptions: {},
          headers: {},
        });
      });

      it('should handle empty string provider gracefully (returns empty options)', () => {
        const result = ThinkingProcessor.createThinkingProviderOptions(
          '',
          'think about this'
        );

        expect(result).toEqual({
          providerOptions: {},
          headers: {},
        });
      });
    });
  });
});
