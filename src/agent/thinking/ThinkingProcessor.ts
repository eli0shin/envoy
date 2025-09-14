/**
 * ThinkingProcessor Module
 * Handles provider-specific thinking configuration and options
 */

import type { LanguageModel } from 'ai';
import { THINKING_CONFIG } from '../../constants.js';
import { analyzeMessageForThinking } from '../../thinking/dynamicThinkingAnalyzer.js';
import { ContentExtractor } from '../utils/ContentExtractor.js';

export type ThinkingProviderResult = {
  providerOptions: Record<string, unknown>;
  headers: Record<string, string>;
};

export class ThinkingProcessor {
  /**
   * Create provider options for thinking based on model and message analysis
   */
  static createThinkingProviderOptions(
    model: LanguageModel,
    message?: string
  ): ThinkingProviderResult {
    const providerType = ContentExtractor.getProviderType(model);

    // Analyze message for thinking requirements
    const analysis =
      message !== undefined ?
        analyzeMessageForThinking(message)
      : { level: 'none', budgetTokens: 0, enableInterleaved: false };

    // Handle edge cases where analysis might be undefined
    if (!analysis || analysis.level === 'none') {
      return {
        providerOptions: {},
        headers:
          analysis?.enableInterleaved && providerType === 'anthropic' ?
            { 'anthropic-beta': 'interleaved-thinking-2025-05-14' }
          : {},
      };
    }

    switch (providerType) {
      case 'anthropic':
        return {
          providerOptions: {
            anthropic: {
              thinking: {
                type: 'enabled',
                budgetTokens: Math.min(
                  analysis.budgetTokens,
                  THINKING_CONFIG.anthropic.maxBudget
                ),
              },
            },
          },
          headers:
            analysis.enableInterleaved ?
              { 'anthropic-beta': 'interleaved-thinking-2025-05-14' }
            : {},
        };

      case 'openai': {
        // Map our levels to OpenAI efforts
        const effortMap: Record<string, string | undefined> = {
          none: undefined, // No reasoning effort when none requested
          low: 'low',
          medium: 'medium',
          high: 'high',
        };
        const reasoningEffort = effortMap[analysis.level];
        return {
          providerOptions:
            reasoningEffort ?
              {
                openai: { reasoningEffort },
              }
            : {},
          headers: {}, // OpenAI doesn't support interleaved thinking
        };
      }

      case 'google': {
        // Scale Google's budget based on our levels
        // Note: Google's max is 24576, so high level gets capped
        const googleBudgetMap: Record<string, number> = {
          none: 0,
          low: 4000, // Matches "think" budget
          medium: 10000, // Matches "megathink" budget
          high: THINKING_CONFIG.google.maxBudget, // 24576 (Google's max, caps 31999)
        };
        const thinkingBudget = googleBudgetMap[analysis.level];
        return {
          providerOptions:
            thinkingBudget > 0 ?
              {
                google: { thinkingBudget },
              }
            : {},
          headers: {}, // Google doesn't support interleaved thinking
        };
      }

      default:
        return {
          providerOptions: {},
          headers: {},
        };
    }
  }
}
