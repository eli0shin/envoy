/**
 * Message transformation utilities for provider-specific optimizations
 * Implements Anthropic OAuth-compatible message caching strategies
 */

import { ModelMessage } from 'ai';

/**
 * Extended message type with provider metadata
 */
type ExtendedCoreMessage = ModelMessage & {
  providerOptions?: {
    anthropic?: {
      cacheControl?: { type: 'ephemeral' };
    };
  };
};

/**
 * Applies Anthropic-specific cache control optimizations to messages
 * Only caches: first 2 system messages + last 2 non-system messages
 */
export function transformMessagesForAnthropic(
  messages: ModelMessage[],
  systemPrompts?: string[]
): ModelMessage[] {
  // Deep copy messages to avoid mutating the originals
  // This ensures cache control doesn't persist across agent turns
  let transformed: ModelMessage[] = messages.map((msg) => {
    const extendedMsg = msg as ExtendedCoreMessage;
    // Create a new message object, preserving existing provider options
    // but removing any existing anthropic cache control
    const { anthropic, ...otherProviderOptions } = extendedMsg.providerOptions || {};

    // Only include anthropic if it has properties other than cacheControl
    const cleanedAnthropic = anthropic ?
      Object.keys(anthropic).filter(k => k !== 'cacheControl').length > 0 ?
        Object.fromEntries(Object.entries(anthropic).filter(([k]) => k !== 'cacheControl')) :
        undefined :
      undefined;

    const newMsg: ExtendedCoreMessage = {
      ...msg,
      providerOptions: (Object.keys(otherProviderOptions).length > 0 || cleanedAnthropic) ?
        {
          ...otherProviderOptions,
          ...(cleanedAnthropic ? { anthropic: cleanedAnthropic } : {})
        } : undefined,
    };
    return newMsg;
  });

  // Convert array system prompts to system messages if provided
  if (systemPrompts && systemPrompts.length > 0) {
    // Convert all system prompts to system messages (without cache control initially)
    const systemMessages: ModelMessage[] = systemPrompts.map((content) => ({
      role: 'system',
      content,
    }));

    // Prepend system messages to the conversation
    transformed = [...systemMessages, ...transformed];
  }

  // Apply cache control strategy: first 2 system + last 2 non-system
  const systemMessageIndices: number[] = [];
  const nonSystemMessageIndices: number[] = [];

  transformed.forEach((msg, index) => {
    if (msg.role === 'system') {
      systemMessageIndices.push(index);
    } else {
      nonSystemMessageIndices.push(index);
    }
  });

  // Get indices for messages to cache
  const indicesToCache = [
    ...systemMessageIndices.slice(0, 2), // First 2 system messages
    ...nonSystemMessageIndices.slice(-2), // Last 2 non-system messages
  ];

  // Apply cache control only to selected messages by index
  indicesToCache.forEach((index) => {
    const extendedMsg = transformed[index] as ExtendedCoreMessage;
    extendedMsg.providerOptions = {
      ...extendedMsg.providerOptions,
      anthropic: {
        ...extendedMsg.providerOptions?.anthropic,
        cacheControl: { type: 'ephemeral' },
      },
    };
  });

  return transformed;
}

/**
 * Removes duplicates from message array while preserving order
 */
function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}
