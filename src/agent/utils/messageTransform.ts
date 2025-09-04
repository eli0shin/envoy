/**
 * Message transformation utilities for provider-specific optimizations
 * Implements Anthropic OAuth-compatible message caching strategies
 */

import { CoreMessage } from 'ai';

/**
 * Extended message type with provider metadata
 */
type ExtendedCoreMessage = CoreMessage & {
  providerMetadata?: {
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
  messages: CoreMessage[],
  systemPrompts?: string[]
): CoreMessage[] {
  let transformed = [...messages];

  // Convert array system prompts to system messages if provided
  if (systemPrompts && systemPrompts.length > 0) {
    // Convert all system prompts to system messages (without cache control initially)
    const systemMessages: CoreMessage[] = systemPrompts.map(content => ({
      role: 'system',
      content,
    }));

    // Prepend system messages to the conversation
    transformed = [...systemMessages, ...transformed];
  }

  // Apply cache control strategy: first 2 system + last 2 non-system
  const systemMessages = transformed
    .filter(msg => msg.role === 'system')
    .slice(0, 2);
  const finalMessages = transformed
    .filter(msg => msg.role !== 'system')
    .slice(-2);

  // Apply cache control to the strategic messages (deduplicated)
  const messagesToCache = unique([...systemMessages, ...finalMessages]);

  for (const msg of messagesToCache) {
    // Type assertion to access providerMetadata
    const extendedMsg = msg as ExtendedCoreMessage;
    extendedMsg.providerMetadata = {
      ...extendedMsg.providerMetadata,
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    };
  }

  return transformed;
}

/**
 * Removes duplicates from message array while preserving order
 */
function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}
