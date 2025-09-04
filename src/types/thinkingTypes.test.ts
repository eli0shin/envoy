/**
 * Tests for thinking types validation and structure
 * Uses actual application types to ensure test validity
 */

import { describe, it, expect } from 'vitest';
import type {
  ThinkingConfig,
  ThinkingBudgetConfig,
  ThinkingStreamPart,
  ThinkingMetadata,
} from './thinkingTypes.js';

describe('Thinking Types', () => {
  describe('ThinkingConfig type', () => {
    it('should accept valid configuration with Anthropic provider', () => {
      const config: ThinkingConfig = {
        enabled: true,
        budgetTokens: 20000,
        provider: 'anthropic',
      };

      expect(config.enabled).toBe(true);
      expect(config.budgetTokens).toBe(20000);
      expect(config.provider).toBe('anthropic');
    });

    it('should accept OpenAI provider configuration', () => {
      const config: ThinkingConfig = {
        enabled: true,
        provider: 'openai',
        effort: 'high',
      };

      expect(config.provider).toBe('openai');
      expect(config.effort).toBe('high');
    });

    it('should accept Google provider configuration', () => {
      const config: ThinkingConfig = {
        enabled: true,
        provider: 'google',
        thinkingBudget: 15000,
      };

      expect(config.provider).toBe('google');
      expect(config.thinkingBudget).toBe(15000);
    });

    it('should accept minimal configuration', () => {
      const minimalConfig: ThinkingConfig = {
        enabled: false,
      };

      expect(minimalConfig.enabled).toBe(false);
      expect(minimalConfig.provider).toBeUndefined();
      expect(minimalConfig.budgetTokens).toBeUndefined();
    });

    it('should accept complete configuration', () => {
      const completeConfig: ThinkingConfig = {
        enabled: true,
        budgetTokens: 25000,
        provider: 'anthropic',
        effort: 'medium',
        thinkingBudget: 30000,
      };

      expect(completeConfig.enabled).toBe(true);
      expect(completeConfig.budgetTokens).toBe(25000);
      expect(completeConfig.provider).toBe('anthropic');
      expect(completeConfig.effort).toBe('medium');
      expect(completeConfig.thinkingBudget).toBe(30000);
    });
  });

  describe('ThinkingBudgetConfig type', () => {
    it('should accept anthropic budget configuration', () => {
      const anthropicConfig: ThinkingBudgetConfig['anthropic'] = {
        defaultBudget: 20000,
        maxBudget: 50000,
        costMultiplier: 1.5,
      };

      expect(anthropicConfig.defaultBudget).toBe(20000);
      expect(anthropicConfig.maxBudget).toBe(50000);
      expect(anthropicConfig.costMultiplier).toBe(1.5);
    });

    it('should accept openai budget configuration', () => {
      const openaiConfig: ThinkingBudgetConfig['openai'] = {
        defaultEffort: 'high',
        efforts: ['low', 'medium', 'high'],
      };

      expect(openaiConfig.defaultEffort).toBe('high');
      expect(openaiConfig.efforts).toContain('low');
      expect(openaiConfig.efforts).toContain('medium');
      expect(openaiConfig.efforts).toContain('high');
    });

    it('should accept google budget configuration', () => {
      const googleConfig: ThinkingBudgetConfig['google'] = {
        defaultBudget: 15000,
        maxBudget: 40000,
        costMultiplier: 1.2,
      };

      expect(googleConfig.defaultBudget).toBe(15000);
      expect(googleConfig.maxBudget).toBe(40000);
      expect(googleConfig.costMultiplier).toBe(1.2);
    });

    it('should accept complete budget configuration', () => {
      const completeBudget: ThinkingBudgetConfig = {
        anthropic: {
          defaultBudget: 20000,
          maxBudget: 50000,
          costMultiplier: 1.5,
        },
        openai: {
          defaultEffort: 'medium',
          efforts: ['low', 'medium', 'high'],
        },
        google: {
          defaultBudget: 15000,
          maxBudget: 40000,
          costMultiplier: 1.2,
        },
      };

      expect(completeBudget.anthropic.defaultBudget).toBe(20000);
      expect(completeBudget.openai.defaultEffort).toBe('medium');
      expect(completeBudget.google.maxBudget).toBe(40000);
    });
  });

  describe('ThinkingStreamPart type', () => {
    it('should accept reasoning stream part', () => {
      const reasoningPart: ThinkingStreamPart = {
        type: 'reasoning',
        textDelta: 'Let me think about this...',
      };

      expect(reasoningPart.type).toBe('reasoning');
      expect(reasoningPart.textDelta).toBe('Let me think about this...');
    });

    it('should accept reasoning signature stream part', () => {
      const signaturePart: ThinkingStreamPart = {
        type: 'reasoning-signature',
        signature: 'signature-abc123',
      };

      expect(signaturePart.type).toBe('reasoning-signature');
      expect(signaturePart.signature).toBe('signature-abc123');
    });

    it('should accept redacted reasoning stream part', () => {
      const redactedPart: ThinkingStreamPart = {
        type: 'redacted-reasoning',
        data: '[Thinking content redacted for privacy]',
      };

      expect(redactedPart.type).toBe('redacted-reasoning');
      expect(redactedPart.data).toBe('[Thinking content redacted for privacy]');
    });

    it('should handle stream part discrimination', () => {
      const parts: ThinkingStreamPart[] = [
        { type: 'reasoning', textDelta: 'thinking...' },
        { type: 'reasoning-signature', signature: 'sig123' },
        { type: 'redacted-reasoning', data: 'redacted' },
      ];

      expect(parts).toHaveLength(3);
      expect(parts[0].type).toBe('reasoning');
      expect(parts[1].type).toBe('reasoning-signature');
      expect(parts[2].type).toBe('redacted-reasoning');
    });
  });

  describe('ThinkingMetadata type', () => {
    it('should accept minimal thinking metadata', () => {
      const minimalMetadata: ThinkingMetadata = {
        thinking: true,
      };

      expect(minimalMetadata.thinking).toBe(true);
      expect(minimalMetadata.isThinkingComplete).toBeUndefined();
    });

    it('should accept complete thinking metadata', () => {
      const completeMetadata: ThinkingMetadata = {
        thinking: true,
        thinkingContent: 'Let me analyze this step by step...',
        isThinkingComplete: true,
        thinkingTokens: 250,
        thinkingSignature: 'thinking-complete-456',
      };

      expect(completeMetadata.thinking).toBe(true);
      expect(completeMetadata.thinkingContent).toBe(
        'Let me analyze this step by step...'
      );
      expect(completeMetadata.isThinkingComplete).toBe(true);
      expect(completeMetadata.thinkingTokens).toBe(250);
      expect(completeMetadata.thinkingSignature).toBe('thinking-complete-456');
    });

    it('should accept thinking in progress metadata', () => {
      const progressMetadata: ThinkingMetadata = {
        thinking: true,
        thinkingContent: 'Still thinking...',
        isThinkingComplete: false,
        thinkingTokens: 100,
      };

      expect(progressMetadata.thinking).toBe(true);
      expect(progressMetadata.thinkingContent).toBe('Still thinking...');
      expect(progressMetadata.isThinkingComplete).toBe(false);
      expect(progressMetadata.thinkingTokens).toBe(100);
      expect(progressMetadata.thinkingSignature).toBeUndefined();
    });

    it('should accept empty metadata', () => {
      const emptyMetadata: ThinkingMetadata = {};

      expect(emptyMetadata.thinking).toBeUndefined();
      expect(emptyMetadata.thinkingContent).toBeUndefined();
      expect(emptyMetadata.isThinkingComplete).toBeUndefined();
      expect(emptyMetadata.thinkingTokens).toBeUndefined();
      expect(emptyMetadata.thinkingSignature).toBeUndefined();
    });

    it('should accept metadata with only thinking content', () => {
      const contentOnlyMetadata: ThinkingMetadata = {
        thinkingContent: 'This is my thought process...',
      };

      expect(contentOnlyMetadata.thinkingContent).toBe(
        'This is my thought process...'
      );
      expect(contentOnlyMetadata.thinking).toBeUndefined();
    });
  });

  describe('type combinations and integration', () => {
    it('should work together in complex scenarios', () => {
      type CombinedConfig = {
        thinking: ThinkingConfig;
        budget: ThinkingBudgetConfig;
        metadata: ThinkingMetadata;
      };

      const config: CombinedConfig = {
        thinking: {
          enabled: true,
          provider: 'anthropic',
          budgetTokens: 25000,
        },
        budget: {
          anthropic: {
            defaultBudget: 20000,
            maxBudget: 50000,
            costMultiplier: 1.5,
          },
          openai: {
            defaultEffort: 'medium',
            efforts: ['low', 'medium', 'high'],
          },
          google: {
            defaultBudget: 15000,
            maxBudget: 40000,
            costMultiplier: 1.2,
          },
        },
        metadata: {
          thinking: true,
          isThinkingComplete: false,
        },
      };

      expect(config.thinking.enabled).toBe(true);
      expect(config.thinking.budgetTokens).toBe(25000);
      expect(config.budget.anthropic.defaultBudget).toBe(20000);
      expect(config.metadata.thinking).toBe(true);
    });

    it('should support stream processing workflows', () => {
      type StreamProcessor = (
        part: ThinkingStreamPart
      ) => Promise<ThinkingMetadata>;

      const processor: StreamProcessor = async part => {
        switch (part.type) {
          case 'reasoning':
            return { thinking: true, isThinkingComplete: false };
          case 'reasoning-signature':
            return {
              thinking: true,
              isThinkingComplete: true,
              thinkingSignature: part.signature,
            };
          case 'redacted-reasoning':
            return {
              thinking: true,
              thinkingContent: part.data,
            };
        }
      };

      expect(processor).toBeInstanceOf(Function);

      // Test with reasoning part
      const reasoningPart: ThinkingStreamPart = {
        type: 'reasoning',
        textDelta: 'Processing...',
      };

      processor(reasoningPart).then(result => {
        expect(result.thinking).toBe(true);
        expect(result.isThinkingComplete).toBe(false);
      });

      // Test with signature part
      const signaturePart: ThinkingStreamPart = {
        type: 'reasoning-signature',
        signature: 'final-signature',
      };

      processor(signaturePart).then(result => {
        expect(result.thinking).toBe(true);
        expect(result.isThinkingComplete).toBe(true);
        expect(result.thinkingSignature).toBe('final-signature');
      });

      // Test with redacted part
      const redactedPart: ThinkingStreamPart = {
        type: 'redacted-reasoning',
        data: '[Thinking redacted]',
      };

      processor(redactedPart).then(result => {
        expect(result.thinking).toBe(true);
        expect(result.thinkingContent).toBe('[Thinking redacted]');
      });
    });
  });
});
