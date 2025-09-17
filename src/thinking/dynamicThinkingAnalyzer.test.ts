import { describe, expect, it } from 'vitest';
import { analyzeMessageForThinking } from './dynamicThinkingAnalyzer.js';

describe('analyzeMessageForThinking', () => {
  describe('no thinking keywords', () => {
    it('should return none for messages without thinking keywords', () => {
      expect(analyzeMessageForThinking('Hello world')).toEqual({
        level: 'none',
        budgetTokens: 0,
        enableInterleaved: false,
      });
    });

    it('should return none for empty message', () => {
      expect(analyzeMessageForThinking('')).toEqual({
        level: 'none',
        budgetTokens: 0,
        enableInterleaved: false,
      });
    });

    it('should return none for messages with unrelated keywords', () => {
      expect(analyzeMessageForThinking('Please analyze this code')).toEqual({
        level: 'none',
        budgetTokens: 0,
        enableInterleaved: false,
      });
    });
  });

  describe('low level thinking (think)', () => {
    it('should detect "think" for low level', () => {
      expect(
        analyzeMessageForThinking('Please think about this problem')
      ).toEqual({
        level: 'low',
        budgetTokens: 4000,
        enableInterleaved: false,
      });
    });

    it('should be case insensitive', () => {
      expect(analyzeMessageForThinking('Please THINK about this')).toEqual({
        level: 'low',
        budgetTokens: 4000,
        enableInterleaved: false,
      });
    });

    it('should match word boundaries', () => {
      expect(analyzeMessageForThinking('I think this is correct')).toEqual({
        level: 'low',
        budgetTokens: 4000,
        enableInterleaved: false,
      });
    });

    it('should not match partial words', () => {
      expect(analyzeMessageForThinking('rethinking this approach')).toEqual({
        level: 'none',
        budgetTokens: 0,
        enableInterleaved: false,
      });
    });
  });

  describe('medium level thinking (10,000 tokens)', () => {
    it('should detect "megathink" for medium level', () => {
      expect(
        analyzeMessageForThinking('Megathink about this complex problem')
      ).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: false,
      });
    });

    it('should detect "think about it" for high level', () => {
      expect(
        analyzeMessageForThinking('Please think about it carefully')
      ).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should detect "think a lot" for medium level', () => {
      expect(
        analyzeMessageForThinking('I need you to think a lot about this')
      ).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: false,
      });
    });

    it('should detect "think deeply" for medium level', () => {
      expect(
        analyzeMessageForThinking('Think deeply about the implications')
      ).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: false,
      });
    });

    it('should detect "think hard" for medium level', () => {
      expect(
        analyzeMessageForThinking('Think hard about this problem')
      ).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: false,
      });
    });

    it('should detect "think more" for medium level', () => {
      expect(
        analyzeMessageForThinking('Please think more about this solution')
      ).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: false,
      });
    });

    it('should be case insensitive', () => {
      expect(analyzeMessageForThinking('MEGATHINK about this')).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: false,
      });
    });

    it('should prioritize "megathink" over "think"', () => {
      expect(
        analyzeMessageForThinking('Megathink and think carefully')
      ).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: false,
      });
    });
  });

  describe('high level thinking (31,999 tokens)', () => {
    it('should detect "think harder" for high level', () => {
      expect(analyzeMessageForThinking('Think harder about this')).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should detect "think intensely" for high level', () => {
      expect(
        analyzeMessageForThinking('Think intensely about this challenge')
      ).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should detect "think longer" for high level', () => {
      expect(
        analyzeMessageForThinking('Think longer about the solution')
      ).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should detect "think really hard" for high level', () => {
      expect(analyzeMessageForThinking('Think really hard about this')).toEqual(
        {
          level: 'high',
          budgetTokens: 31999,
          enableInterleaved: false,
        }
      );
    });

    it('should detect "think super hard" for high level', () => {
      expect(analyzeMessageForThinking('Think super hard about this')).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should detect "think very hard" for high level', () => {
      expect(analyzeMessageForThinking('Think very hard about this')).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should detect "ultrathink" for high level', () => {
      expect(analyzeMessageForThinking('Ultrathink this problem')).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should be case insensitive', () => {
      expect(analyzeMessageForThinking('THINK HARDER about this')).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should prioritize "think harder" over "megathink"', () => {
      expect(analyzeMessageForThinking('Think harder and megathink')).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should prioritize "think harder" over "think"', () => {
      expect(analyzeMessageForThinking('Think harder and think')).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should prioritize "think really hard" over "think hard"', () => {
      expect(
        analyzeMessageForThinking('Think really hard and think hard')
      ).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });

    it('should prioritize "think very hard" over "think about it"', () => {
      expect(
        analyzeMessageForThinking('Think very hard and think about it')
      ).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: false,
      });
    });
  });

  describe('interleaved thinking (step by step)', () => {
    it('should enable interleaved only with "step by step"', () => {
      expect(analyzeMessageForThinking('Solve this step by step')).toEqual({
        level: 'none',
        budgetTokens: 0,
        enableInterleaved: true,
      });
    });

    it('should be case insensitive', () => {
      expect(analyzeMessageForThinking('STEP BY STEP solution')).toEqual({
        level: 'none',
        budgetTokens: 0,
        enableInterleaved: true,
      });
    });

    it('should handle mixed case', () => {
      expect(analyzeMessageForThinking('Step By Step approach')).toEqual({
        level: 'none',
        budgetTokens: 0,
        enableInterleaved: true,
      });
    });

    it('should not match partial phrases', () => {
      expect(analyzeMessageForThinking('step by step-by-step')).toEqual({
        level: 'none',
        budgetTokens: 0,
        enableInterleaved: false,
      });
    });
  });

  describe('combined thinking and interleaved', () => {
    it('should handle both "think" and "step by step"', () => {
      expect(
        analyzeMessageForThinking('Think about this step by step')
      ).toEqual({
        level: 'low',
        budgetTokens: 4000,
        enableInterleaved: true,
      });
    });

    it('should handle both "megathink" and "step by step"', () => {
      expect(analyzeMessageForThinking('Megathink step by step')).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: true,
      });
    });

    it('should handle both "think harder" and "step by step"', () => {
      expect(analyzeMessageForThinking('Think harder step by step')).toEqual({
        level: 'high',
        budgetTokens: 31999,
        enableInterleaved: true,
      });
    });

    it('should handle both "ultrathink" and "step by step"', () => {
      expect(analyzeMessageForThinking('Ultrathink this step by step')).toEqual(
        {
          level: 'high',
          budgetTokens: 31999,
          enableInterleaved: true,
        }
      );
    });

    it('should work with different word order', () => {
      expect(
        analyzeMessageForThinking('Step by step, think about this')
      ).toEqual({
        level: 'low',
        budgetTokens: 4000,
        enableInterleaved: true,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle multiple spaces', () => {
      expect(analyzeMessageForThinking('megathink   about   this')).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: false,
      });
    });

    it('should handle newlines', () => {
      expect(analyzeMessageForThinking('megathink\nabout\nthis')).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: false,
      });
    });

    it('should handle punctuation', () => {
      expect(analyzeMessageForThinking('Megathink, please!')).toEqual({
        level: 'medium',
        budgetTokens: 10000,
        enableInterleaved: false,
      });
    });

    it('should handle very long messages', () => {
      const longMessage =
        'This is a very long message that contains many words and eventually has the word think in it somewhere';
      expect(analyzeMessageForThinking(longMessage)).toEqual({
        level: 'low',
        budgetTokens: 4000,
        enableInterleaved: false,
      });
    });
  });
});
