import { describe, it, expect } from 'vitest';
import { transformMessagesForAnthropic } from './messageTransform.js';
import { ModelMessage } from 'ai';

// Extended message type for testing provider metadata
type ExtendedCoreMessage = ModelMessage & {
  providerOptions?: {
    anthropic?: {
      cacheControl?: { type: 'ephemeral' };
    };
  };
};

describe('transformMessagesForAnthropic', () => {
  it('should return messages with cache control applied to last 2 when no system prompts provided', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];

    const result = transformMessagesForAnthropic(messages);

    expect(result).toHaveLength(2);
    // Both messages should have cache control (they are the last 2 non-system)
    expect(
      (result[0] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
    expect(
      (result[1] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
    // Verify content is preserved
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Hello');
    expect(result[1].role).toBe('assistant');
    expect(result[1].content).toBe('Hi there');
  });

  it('should prepend system messages when system prompts provided', () => {
    const messages: ModelMessage[] = [{ role: 'user', content: 'Hello' }];
    const systemPrompts = ['You are a helpful assistant', 'Be concise'];

    const result = transformMessagesForAnthropic(messages, systemPrompts);

    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('system');
    expect(result[0].content).toBe('You are a helpful assistant');
    expect(result[1].role).toBe('system');
    expect(result[1].content).toBe('Be concise');
    expect(result[2].role).toBe('user');
    expect(result[2].content).toBe('Hello');

    // First 2 system messages should have cache control
    expect(
      (result[0] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
    expect(
      (result[1] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
    // User message should also have cache control (last non-system)
    expect(
      (result[2] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
  });

  it('should apply cache control to first 2 system messages', () => {
    const systemPrompts = ['System 1', 'System 2', 'System 3'];
    const messages: ModelMessage[] = [{ role: 'user', content: 'Hello' }];

    const result = transformMessagesForAnthropic(messages, systemPrompts);

    expect(result).toHaveLength(4);

    // First 2 system messages should have cache control
    expect(
      (result[0] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
    expect(
      (result[1] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });

    // Third system message should not have cache control
    expect(
      (result[2] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toBeUndefined();
  });

  it('should apply cache control to last 2 non-system messages', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Message 1' },
      { role: 'assistant', content: 'Response 1' },
      { role: 'user', content: 'Message 2' },
      { role: 'assistant', content: 'Response 2' },
      { role: 'user', content: 'Message 3' },
    ];

    const result = transformMessagesForAnthropic(messages);

    expect(result).toHaveLength(5);

    // Only last 2 non-system messages should have cache control
    expect(
      (result[0] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toBeUndefined();
    expect(
      (result[1] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toBeUndefined();
    expect(
      (result[2] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toBeUndefined();
    expect(
      (result[3] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
    expect(
      (result[4] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
  });

  it('should handle mixed system and non-system messages correctly', () => {
    const messages: ModelMessage[] = [
      { role: 'system', content: 'Existing system' },
      { role: 'user', content: 'User 1' },
      { role: 'assistant', content: 'Assistant 1' },
      { role: 'system', content: 'Another system' },
      { role: 'user', content: 'User 2' },
    ];
    const systemPrompts = ['New system'];

    const result = transformMessagesForAnthropic(messages, systemPrompts);

    expect(result).toHaveLength(6);
    expect(result[0].role).toBe('system');
    expect(result[0].content).toBe('New system');
    expect(result[1].role).toBe('system');
    expect(result[1].content).toBe('Existing system');

    // First 2 system messages should have cache control
    expect(
      (result[0] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
    expect(
      (result[1] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });

    // Last 2 non-system messages should have cache control
    // The result array is: [New system, Existing system, User 1, Assistant 1, Another system, User 2]
    // Last 2 non-system are: Assistant 1 (index 3), User 2 (index 5)
    expect(
      (result[3] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
    expect(
      (result[5] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
  });

  it('should handle empty system prompts array', () => {
    const messages: ModelMessage[] = [{ role: 'user', content: 'Hello' }];

    const result = transformMessagesForAnthropic(messages, []);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Hello');
    // Single message should have cache control (it's the last non-system)
    expect(
      (result[0] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
  });

  it('should handle empty messages array', () => {
    const result = transformMessagesForAnthropic([]);

    expect(result).toHaveLength(0);
  });

  it('should handle empty messages with system prompts', () => {
    const systemPrompts = ['System message'];

    const result = transformMessagesForAnthropic([], systemPrompts);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('system');
    expect(result[0].content).toBe('System message');
    expect(
      (result[0] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
  });

  it('should apply cache control to existing messages', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: 'Hello',
      },
    ];

    const result = transformMessagesForAnthropic(messages);

    expect(
      (result[0] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
  });

  it('should handle single system and single non-system message', () => {
    const messages: ModelMessage[] = [
      { role: 'system', content: 'System' },
      { role: 'user', content: 'User' },
    ];

    const result = transformMessagesForAnthropic(messages);

    expect(result).toHaveLength(2);
    expect(
      (result[0] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
    expect(
      (result[1] as ExtendedCoreMessage).providerOptions?.anthropic
        ?.cacheControl
    ).toEqual({ type: 'ephemeral' });
  });
});
