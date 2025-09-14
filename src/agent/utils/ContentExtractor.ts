/**
 * ContentExtractor Module
 * Utilities for extracting text content and detecting provider types
 */

import type { LanguageModel } from 'ai';

export class ContentExtractor {
  /**
   * Extract text content from AI SDK result
   * Handles string, array, and object inputs
   */
  static extractTextContent(text: unknown): string {
    if (typeof text === 'string') {
      return text.trim();
    }

    if (Array.isArray(text)) {
      return text
        .filter((part: { type?: string }) => part.type === 'text')
        .map((part: { text?: string }) => part.text || '')
        .filter((text) => text) // Remove empty strings
        .join('');
    }

    // Handle undefined and null separately since JSON.stringify returns undefined for undefined
    if (text === undefined) return 'undefined';
    if (text === null) return 'null';

    return JSON.stringify(text);
  }

  /**
   * Determine provider type from model
   * Checks provider.toString() first, then model ID patterns
   */
  static getProviderType(model: LanguageModel): string {
    try {
      // Check model constructor or provider property
      if (model?.provider?.toString) {
        const providerStr = model.provider.toString();
        if (providerStr.includes('anthropic')) return 'anthropic';
        if (providerStr.includes('openai')) return 'openai';
        if (providerStr.includes('google')) return 'google';
      }
    } catch {
      // If toString throws, continue to model ID check
    }

    // Check model ID patterns
    try {
      if (model?.modelId) {
        if (model.modelId.includes('claude')) return 'anthropic';
        if (
          model.modelId.includes('gpt') ||
          model.modelId.includes('o1') ||
          model.modelId.includes('o3') ||
          model.modelId.includes('o4')
        ) {
          return 'openai';
        }
        if (model.modelId.includes('gemini')) return 'google';
      }
    } catch {
      // If model ID access throws, fall back to default
    }

    // Default fallback
    return 'anthropic';
  }
}
