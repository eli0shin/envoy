/**
 * Tests for simplified agent stream processing (no thinking messages)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoreMessage } from 'ai';
import { streamText } from 'ai';
import { z } from 'zod';
import { RuntimeConfiguration } from '../config/types.js';
import { runAgent } from './index.js';
import { createMockAgentSession } from '../test/helpers/createMocks.js';

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  APICallError: { isInstance: vi.fn(() => false) },
  InvalidPromptError: { isInstance: vi.fn(() => false) },
  NoSuchProviderError: { isInstance: vi.fn(() => false) },
  InvalidToolArgumentsError: { isInstance: vi.fn(() => false) },
  NoSuchToolError: { isInstance: vi.fn(() => false) },
  ToolExecutionError: { isInstance: vi.fn(() => false) },
}));

// Mock constants
vi.mock('./constants.js', () => ({
  SYSTEM_PROMPT: 'Test system prompt',
  GENERATION_TIMEOUT_MS: 300000,
  MAX_GENERATION_RETRIES: 3,
}));

const mockStreamText = streamText as ReturnType<typeof vi.fn>;

describe('Agent Thinking Stream Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reasoning chunk processing', () => {
    it('should handle reasoning chunks and emit standard assistant messages (no thinking messages)', async () => {
      const messagesToEmit: CoreMessage[] = [];
      const onMessageUpdate = vi.fn((message: CoreMessage) => {
        messagesToEmit.push(message);
      });

      // Mock stream with reasoning chunks - these should be ignored by simplified agent
      const mockFullStream = (async function* () {
        yield { type: 'step-start' };
        yield { type: 'reasoning', textDelta: 'I need to think about ' };
        yield { type: 'reasoning', textDelta: 'this problem carefully.' };
        yield { type: 'reasoning-signature', signature: 'thinking-complete' };
        yield { type: 'text-delta', textDelta: 'Here is my response' };
        yield { type: 'step-finish' };
      })();

      mockStreamText.mockReturnValue({
        fullStream: mockFullStream,
        response: Promise.resolve({
          messages: [{ role: 'assistant', content: 'Here is my response' }],
        }),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ totalTokens: 100 }),
        text: Promise.resolve('Here is my response'),
        toolResults: Promise.resolve([]),
      });

      const mockSession = createMockAgentSession();
      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent(
        'Test message',
        mockConfig,
        mockSession,
        false,
        onMessageUpdate
      );

      // Verify no thinking messages are emitted
      const thinkingMessages = messagesToEmit.filter(
        (msg: CoreMessage & Record<string, unknown>) =>
          'thinking' in msg && msg.thinking === true
      );
      expect(thinkingMessages).toHaveLength(0);

      // Verify standard assistant messages are emitted
      const assistantMessages = messagesToEmit.filter(
        (msg: CoreMessage) => msg.role === 'assistant' && !('thinking' in msg)
      );
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0]).toEqual(
        expect.objectContaining({
          role: 'assistant',
          content: 'Here is my response',
        })
      );
    });

    it('should handle reasoning-signature chunks and emit standard assistant messages', async () => {
      const messagesToEmit: CoreMessage[] = [];
      const onMessageUpdate = vi.fn((message: CoreMessage) => {
        messagesToEmit.push(message);
      });

      const mockFullStream = (async function* () {
        yield { type: 'step-start' };
        yield { type: 'reasoning', textDelta: 'Let me think about this...' };
        yield {
          type: 'reasoning-signature',
          signature: 'thinking-complete-xyz123',
        };
        yield { type: 'text-delta', textDelta: 'Based on my analysis' };
        yield { type: 'step-finish' };
      })();

      mockStreamText.mockReturnValue({
        fullStream: mockFullStream,
        response: Promise.resolve({
          messages: [{ role: 'assistant', content: 'Based on my analysis' }],
        }),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ totalTokens: 100 }),
        text: Promise.resolve('Based on my analysis'),
        toolResults: Promise.resolve([]),
      });

      const mockSession = createMockAgentSession();
      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent(
        'Test message',
        mockConfig,
        mockSession,
        false,
        onMessageUpdate
      );

      // Verify no thinking messages are emitted
      const thinkingMessages = messagesToEmit.filter(
        (msg: CoreMessage & Record<string, unknown>) =>
          'thinking' in msg && msg.thinking === true
      );
      expect(thinkingMessages).toHaveLength(0);

      // Verify standard assistant messages are emitted
      const assistantMessages = messagesToEmit.filter(
        (msg: CoreMessage) => msg.role === 'assistant' && !('thinking' in msg)
      );
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0]).toEqual(
        expect.objectContaining({
          role: 'assistant',
          content: 'Based on my analysis',
        })
      );
    });

    it('should handle redacted-reasoning chunks and emit standard assistant messages', async () => {
      const messagesToEmit: CoreMessage[] = [];
      const onMessageUpdate = vi.fn((message: CoreMessage) => {
        messagesToEmit.push(message);
      });

      const mockFullStream = (async function* () {
        yield { type: 'step-start' };
        yield { type: 'redacted-reasoning' };
        yield { type: 'text-delta', textDelta: 'I can help with that' };
        yield { type: 'step-finish' };
      })();

      mockStreamText.mockReturnValue({
        fullStream: mockFullStream,
        response: Promise.resolve({
          messages: [{ role: 'assistant', content: 'I can help with that' }],
        }),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ totalTokens: 100 }),
        text: Promise.resolve('I can help with that'),
        toolResults: Promise.resolve([]),
      });

      const mockSession = createMockAgentSession();
      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent(
        'Test message',
        mockConfig,
        mockSession,
        false,
        onMessageUpdate
      );

      // Verify no thinking messages are emitted (redacted reasoning is ignored)
      const redactedMessages = messagesToEmit.filter(
        (msg: CoreMessage & Record<string, unknown>) =>
          'thinking' in msg && msg.thinking === true
      );
      expect(redactedMessages).toHaveLength(0);

      // Verify standard assistant messages are emitted
      const assistantMessages = messagesToEmit.filter(
        (msg: CoreMessage) => msg.role === 'assistant' && !('thinking' in msg)
      );
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0]).toEqual(
        expect.objectContaining({
          role: 'assistant',
          content: 'I can help with that',
        })
      );
    });

    it('should emit assistant messages even when no reasoning chunks are present', async () => {
      const messagesToEmit: CoreMessage[] = [];
      const onMessageUpdate = vi.fn((message: CoreMessage) => {
        messagesToEmit.push(message);
      });

      const mockFullStream = (async function* () {
        yield { type: 'step-start' };
        yield { type: 'text-delta', textDelta: 'Direct response' };
        yield { type: 'step-finish' };
      })();

      mockStreamText.mockReturnValue({
        fullStream: mockFullStream,
        response: Promise.resolve({
          messages: [{ role: 'assistant', content: 'Direct response' }],
        }),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ totalTokens: 100 }),
        text: Promise.resolve('Direct response'),
        toolResults: Promise.resolve([]),
      });

      const mockSession = createMockAgentSession();
      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent(
        'Test message',
        mockConfig,
        mockSession,
        false,
        onMessageUpdate
      );

      // Verify assistant messages are emitted even without reasoning
      const assistantMessages = messagesToEmit.filter(
        (msg: CoreMessage) => msg.role === 'assistant' && !('thinking' in msg)
      );
      expect(assistantMessages.length).toBeGreaterThan(0);
    });

    it('should handle reasoning chunks in multi-step conversations', async () => {
      const messagesToEmit: CoreMessage[] = [];
      const onMessageUpdate = vi.fn((message: CoreMessage) => {
        messagesToEmit.push(message);
      });

      const mockFullStream = (async function* () {
        // Step 1
        yield { type: 'step-start' };
        yield { type: 'reasoning', textDelta: "First, I'll analyze..." };
        yield { type: 'step-finish' };
        // Step 2
        yield { type: 'step-start' };
        yield { type: 'reasoning', textDelta: "Then I'll conclude..." };
        yield { type: 'text-delta', textDelta: 'Final answer' };
        yield { type: 'step-finish' };
      })();

      mockStreamText.mockReturnValue({
        fullStream: mockFullStream,
        response: Promise.resolve({
          messages: [{ role: 'assistant', content: 'Final answer' }],
        }),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ totalTokens: 200 }),
        text: Promise.resolve('Final answer'),
        toolResults: Promise.resolve([]),
      });

      const mockSession = createMockAgentSession({
        tools: {
          testTool: {
            description: 'Test tool',
            parameters: z.object({}),
            execute: vi.fn().mockResolvedValue({ result: 'success' }),
            originalExecute: vi.fn().mockResolvedValue({ result: 'success' }),
            serverName: 'test-server',
            toolName: 'testTool',
          },
        },
      });

      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent(
        'Test message',
        mockConfig,
        mockSession,
        false,
        onMessageUpdate
      );

      // Verify no thinking messages are emitted
      const thinkingMessages = messagesToEmit.filter(
        (msg: CoreMessage & Record<string, unknown>) =>
          'thinking' in msg && msg.thinking === true
      );
      expect(thinkingMessages.length).toEqual(0);

      // Verify standard assistant messages are emitted
      const assistantMessages = messagesToEmit.filter(
        (msg: CoreMessage) => msg.role === 'assistant' && !('thinking' in msg)
      );
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0]).toEqual(
        expect.objectContaining({
          role: 'assistant',
          content: 'Final answer',
        })
      );
    });
  });

  describe('thinking message properties', () => {
    it('should not emit any thinking messages with metadata properties', async () => {
      const messagesToEmit: CoreMessage[] = [];
      const onMessageUpdate = vi.fn((message: CoreMessage) => {
        messagesToEmit.push(message);
      });

      const mockFullStream = (async function* () {
        yield { type: 'step-start' };
        yield { type: 'reasoning', textDelta: 'Complex reasoning here...' };
        yield {
          type: 'reasoning-signature',
          signature: 'thinking-complete-detailed',
        };
        yield { type: 'text-delta', textDelta: 'Response' };
        yield { type: 'step-finish' };
      })();

      mockStreamText.mockReturnValue({
        fullStream: mockFullStream,
        response: Promise.resolve({
          messages: [{ role: 'assistant', content: 'Response' }],
        }),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ totalTokens: 100, thinkingTokens: 25 }),
        text: Promise.resolve('Response'),
        toolResults: Promise.resolve([]),
      });

      const mockSession = createMockAgentSession();
      const mockConfig = {
        agent: { maxSteps: 5 },
        json: false,
      } as RuntimeConfiguration;

      await runAgent(
        'Test message',
        mockConfig,
        mockSession,
        false,
        onMessageUpdate
      );

      // Verify no thinking messages are emitted
      const thinkingMessages = messagesToEmit.filter(
        (msg: CoreMessage & Record<string, unknown>) =>
          'thinking' in msg && msg.thinking === true
      );
      expect(thinkingMessages).toHaveLength(0);

      // Verify only standard assistant messages with no custom properties
      const assistantMessages = messagesToEmit.filter(
        (msg: CoreMessage) => msg.role === 'assistant'
      );
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0]).toEqual({
        role: 'assistant',
        content: 'Response',
      });

      // Ensure no custom properties exist
      const message = assistantMessages[0] as CoreMessage &
        Record<string, unknown>;
      expect(message.thinking).toBeUndefined();
      expect(message.isThinkingComplete).toBeUndefined();
      expect(message.thinkingSignature).toBeUndefined();
    });
  });
});
