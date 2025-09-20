/**
 * ContentExtractor Module
 * Utilities for extracting text content and detecting provider types
 */

import type { LanguageModelV2 } from '@ai-sdk/provider';

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
  static getProviderType(model: LanguageModelV2): string {
    // Check if model is a string (model ID) or object with modelId
    try {
      let modelId: string | undefined;

      if (typeof model === 'string') {
        modelId = model;
      } else if (model && typeof model === 'object' && 'modelId' in model) {
        modelId = (model as { modelId: string }).modelId;
      }

      if (modelId) {
        if (modelId.includes('claude')) return 'anthropic';
        if (
          modelId.includes('gpt') ||
          modelId.includes('o1') ||
          modelId.includes('o3') ||
          modelId.includes('o4')
        ) {
          return 'openai';
        }
        if (modelId.includes('gemini')) return 'google';
      }
    } catch {
      // If model ID access throws, fall back to default
    }

    // Default fallback
    return 'anthropic';
  }
}
