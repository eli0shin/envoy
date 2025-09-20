/**
 * Tests for ContentExtractor Module
 * Following strict TDD - tests written first before implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentExtractor } from './ContentExtractor.js';
import type { LanguageModel } from 'ai';

describe('ContentExtractor Module', () => {
  describe('extractTextContent', () => {
    it('should extract text content from string input', () => {
      const result = ContentExtractor.extractTextContent('Hello world');
      expect(result).toBe('Hello world');
    });

    it('should trim whitespace from string input', () => {
      const result = ContentExtractor.extractTextContent('  Hello world  ');
      expect(result).toBe('Hello world');
    });

    it('should handle empty string input', () => {
      const result = ContentExtractor.extractTextContent('');
      expect(result).toBe('');
    });

    it('should handle string with only whitespace', () => {
      const result = ContentExtractor.extractTextContent('   \n\t  ');
      expect(result).toBe('');
    });

    it('should extract text from array with text parts', () => {
      const input = [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ];
      const result = ContentExtractor.extractTextContent(input);
      expect(result).toBe('Hello world');
    });

    it('should filter out non-text parts from array', () => {
      const input = [
        { type: 'text', text: 'Hello ' },
        { type: 'image', url: 'image.jpg' },
        { type: 'text', text: 'world' },
      ];
      const result = ContentExtractor.extractTextContent(input);
      expect(result).toBe('Hello world');
    });

    it('should handle array with no text parts', () => {
      const input = [
        { type: 'image', url: 'image.jpg' },
        { type: 'file', name: 'file.pdf' },
      ];
      const result = ContentExtractor.extractTextContent(input);
      expect(result).toBe('');
    });

    it('should handle array with missing text property', () => {
      const input = [{ type: 'text' }, { type: 'text', text: 'Hello' }];
      const result = ContentExtractor.extractTextContent(input);
      expect(result).toBe('Hello');
    });

    it('should handle array with null text property', () => {
      const input = [
        { type: 'text', text: null },
        { type: 'text', text: 'Hello' },
      ];
      const result = ContentExtractor.extractTextContent(input);
      expect(result).toBe('Hello');
    });

    it('should handle array with undefined text property', () => {
      const input = [
        { type: 'text', text: undefined },
        { type: 'text', text: 'Hello' },
      ];
      const result = ContentExtractor.extractTextContent(input);
      expect(result).toBe('Hello');
    });

    it('should handle empty array', () => {
      const result = ContentExtractor.extractTextContent([]);
      expect(result).toBe('');
    });

    it('should handle array with empty text parts', () => {
      const input = [
        { type: 'text', text: '' },
        { type: 'text', text: 'Hello' },
      ];
      const result = ContentExtractor.extractTextContent(input);
      expect(result).toBe('Hello');
    });

    it('should stringify non-string, non-array input', () => {
      const input = { message: 'Hello world' };
      const result = ContentExtractor.extractTextContent(input);
      expect(result).toBe('{"message":"Hello world"}');
    });

    it('should handle null input', () => {
      const result = ContentExtractor.extractTextContent(null);
      expect(result).toBe('null');
    });

    it('should handle undefined input', () => {
      const result = ContentExtractor.extractTextContent(undefined);
      expect(result).toBe('undefined');
    });

    it('should handle number input', () => {
      const result = ContentExtractor.extractTextContent(42);
      expect(result).toBe('42');
    });

    it('should handle boolean input', () => {
      const result = ContentExtractor.extractTextContent(true);
      expect(result).toBe('true');
    });

    it('should handle complex object input', () => {
      const input = {
        nested: {
          value: 'test',
          number: 123,
        },
      };
      const result = ContentExtractor.extractTextContent(input);
      expect(result).toBe('{"nested":{"value":"test","number":123}}');
    });

    it('should handle array with mixed content types', () => {
      const input = [
        { type: 'text', text: 'Start ' },
        { type: 'unknown', content: 'ignored' },
        { type: 'text', text: 'middle ' },
        { type: 'text', text: 'end' },
      ];
      const result = ContentExtractor.extractTextContent(input);
      expect(result).toBe('Start middle end');
    });
  });

  describe('getProviderType', () => {
    let mockModel: LanguageModel;

    beforeEach(() => {
      mockModel = {
        modelId: 'test-model',
      } as unknown as LanguageModel;
    });

    describe('provider detection via modelId patterns', () => {
      it('should detect anthropic from claude model ID', () => {
        const modelWithClaudeId = {
          modelId: 'claude-3-sonnet',
        } as LanguageModel;
        const result = ContentExtractor.getProviderType(modelWithClaudeId);
        expect(result).toBe('anthropic');
      });

      it('should detect openai from gpt model ID', () => {
        const modelWithGptId = {
          modelId: 'gpt-4',
        } as LanguageModel;
        const result = ContentExtractor.getProviderType(modelWithGptId);
        expect(result).toBe('openai');
      });

      it('should detect openai from o1 model ID', () => {
        const modelWithO1Id = {
          modelId: 'o1-preview',
        } as LanguageModel;
        const result = ContentExtractor.getProviderType(modelWithO1Id);
        expect(result).toBe('openai');
      });

      it('should detect openai from o3 model ID', () => {
        const modelWithO3Id = {
          modelId: 'o3-reasoning',
        } as LanguageModel;
        const result = ContentExtractor.getProviderType(modelWithO3Id);
        expect(result).toBe('openai');
      });

      it('should detect openai from o4 model ID', () => {
        const modelWithO4Id = {
          modelId: 'o4-turbo',
        } as LanguageModel;
        const result = ContentExtractor.getProviderType(modelWithO4Id);
        expect(result).toBe('openai');
      });

      it('should detect google from gemini model ID', () => {
        const modelWithGeminiId = {
          modelId: 'gemini-pro',
        } as LanguageModel;
        const result = ContentExtractor.getProviderType(modelWithGeminiId);
        expect(result).toBe('google');
      });

      it('should handle model ID with partial matches', () => {
        const modelWithPartialId = {
          modelId: 'my-claude-model',
        } as LanguageModel;
        const result = ContentExtractor.getProviderType(modelWithPartialId);
        expect(result).toBe('anthropic');
      });

      it('should be case sensitive for model ID detection', () => {
        const modelWithUpperId = {
          modelId: 'CLAUDE-3',
        } as LanguageModel;
        const result = ContentExtractor.getProviderType(modelWithUpperId);
        expect(result).toBe('anthropic'); // Should default to anthropic when no match
      });
    });

    describe('fallback behavior', () => {
      it('should default to anthropic when model ID does not match any pattern', () => {
        const modelWithUnknownId = {
          modelId: 'unknown-model',
        } as LanguageModel;
        const result = ContentExtractor.getProviderType(modelWithUnknownId);
        expect(result).toBe('anthropic');
      });

      it('should handle missing modelId property', () => {
        const modelWithoutId = {} as LanguageModel;
        const result = ContentExtractor.getProviderType(modelWithoutId);
        expect(result).toBe('anthropic');
      });

      it('should handle string model input', () => {
        const result = ContentExtractor.getProviderType('claude-3-sonnet' as unknown as LanguageModel);
        expect(result).toBe('anthropic');
      });

      it('should handle string model input with openai pattern', () => {
        const result = ContentExtractor.getProviderType('gpt-4' as unknown as LanguageModel);
        expect(result).toBe('openai');
      });
    });


    describe('edge cases', () => {
      it('should handle null model', () => {
        const result = ContentExtractor.getProviderType(
          null as unknown as LanguageModel
        );
        expect(result).toBe('anthropic');
      });

      it('should handle undefined model', () => {
        const result = ContentExtractor.getProviderType(
          undefined as unknown as LanguageModel
        );
        expect(result).toBe('anthropic');
      });

      it('should handle empty model object', () => {
        const result = ContentExtractor.getProviderType({} as LanguageModel);
        expect(result).toBe('anthropic');
      });

      it('should handle model with empty string modelId', () => {
        const model = {
          modelId: '',
          provider: {
            toString: vi.fn().mockReturnValue('unknown'),
          },
        } as unknown as LanguageModel;
        const result = ContentExtractor.getProviderType(model);
        expect(result).toBe('anthropic');
      });

      it('should handle model with null modelId', () => {
        const model = {
          modelId: null,
          provider: {
            toString: vi.fn().mockReturnValue('unknown'),
          },
        } as unknown as LanguageModel;
        const result = ContentExtractor.getProviderType(model);
        expect(result).toBe('anthropic');
      });
    });
  });
});
