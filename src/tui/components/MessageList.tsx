import { useRef, useEffect } from 'react';
import { Message } from './Message.js';
import type { ModelMessage } from 'ai';
import type { ScrollBoxRenderable } from '@opentui/core';
import { useKeys, parseKeys } from '../keys/index.js';

type MessageListProps = {
  messages: (ModelMessage & { id: string })[];
  queuedMessages: (ModelMessage & { id: string })[];
  width: number;
  key: string;
};

type ToolData = {
  toolName: string;
  args: unknown;
  output?: unknown;
  error?: unknown;
  isError?: boolean;
};

type RenderableMessage = ModelMessage & {
  id: string;
  toolData?: ToolData;
  contentType?: 'normal' | 'reasoning' | 'tool';
};

function processMessagesWithToolAggregation(
  messages: (ModelMessage & { id: string })[]
): RenderableMessage[] {
  const renderableMessages: RenderableMessage[] = [];
  const consumedMessageIndices = new Set<number>();

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
    const message = messages[messageIndex];

    // Skip if this message was already consumed as a tool result
    if (consumedMessageIndices.has(messageIndex)) {
      continue;
    }

    // Handle string content - pass through as-is
    if (typeof message.content === 'string') {
      renderableMessages.push(message);
      continue;
    }

    // Handle array content - split into parts
    const parts = message.content;
    if (!Array.isArray(parts)) {
      renderableMessages.push(message);
      continue;
    }

    // Check if message has only text/reasoning parts (no tool calls)
    const hasOnlyTextContent = parts.every(
      (part) =>
        part?.type === 'text' ||
        part?.type === 'reasoning' ||
        !part ||
        typeof part !== 'object'
    );

    if (hasOnlyTextContent) {
      renderableMessages.push(message);
      continue;
    }

    // Message has tool calls - process each part
    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex];

      if (!part || typeof part !== 'object' || !('type' in part)) {
        continue;
      }

      // Handle text and reasoning parts
      if (part.type === 'text' && 'text' in part && part.text) {
        renderableMessages.push({
          ...message,
          id: `${message.id}-part-${partIndex}`,
          content: part.text,
          contentType: 'normal',
        });
      } else if (part.type === 'reasoning' && 'text' in part && part.text) {
        renderableMessages.push({
          ...message,
          id: `${message.id}-part-${partIndex}`,
          content: part.text,
          contentType: 'reasoning',
        });
      } else if (
        part.type === 'tool-call' &&
        'toolName' in part &&
        'toolCallId' in part
      ) {
        // Look ahead for matching tool result
        let matchingResult: unknown = null;

        for (
          let resultMessageIndex = messageIndex + 1;
          resultMessageIndex < messages.length;
          resultMessageIndex++
        ) {
          const resultMessage = messages[resultMessageIndex];

          if (
            resultMessage.role === 'tool' &&
            Array.isArray(resultMessage.content)
          ) {
            for (const resultPart of resultMessage.content) {
              const isMatchingPart =
                (resultPart?.type === 'tool-result' ||
                  resultPart?.type === 'tool-error') &&
                'toolCallId' in resultPart &&
                resultPart.toolCallId === part.toolCallId;

              if (isMatchingPart) {
                matchingResult = resultPart;
                consumedMessageIndices.add(resultMessageIndex);
                break;
              }
            }
            if (matchingResult) break;
          }
        }

        // Extract output/error from result
        let outputPayload: unknown = undefined;
        let errorPayload: unknown = undefined;
        let isError = false;

        if (matchingResult && typeof matchingResult === 'object') {
          const resultObject = matchingResult as Record<string, unknown>;
          const partType =
            typeof resultObject.type === 'string'
              ? resultObject.type
              : undefined;

          if ('isError' in resultObject) {
            isError = Boolean(resultObject.isError);
          }

          if (partType === 'tool-error') {
            isError = true;
            errorPayload =
              'error' in resultObject ? resultObject.error : resultObject;
          } else {
            outputPayload =
              'output' in resultObject ? resultObject.output : resultObject;
          }

          if (!errorPayload && 'error' in resultObject) {
            errorPayload = resultObject.error;
          }
        }

        const toolData: ToolData = {
          toolName: part.toolName,
          args: part.input,
          output: outputPayload,
          error: errorPayload,
          isError: matchingResult ? isError : undefined,
        };

        renderableMessages.push({
          ...message,
          id: `${message.id}-part-${partIndex}`,
          content: '',
          toolData,
          contentType: 'tool',
        });
      }
    }
  }

  return renderableMessages;
}

export function MessageList({
  messages,
  queuedMessages,
  width,
}: MessageListProps) {
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  const scrollToBottom = () => {
    if (scrollBoxRef.current) {
      const maxScrollTop =
        scrollBoxRef.current.scrollHeight -
        scrollBoxRef.current.viewport.height;
      scrollBoxRef.current.scrollTop = Math.max(0, maxScrollTop);
    }
  };

  const scrollBy = (delta: number) => {
    if (!scrollBoxRef.current) return;
    const maxScrollTop =
      scrollBoxRef.current.scrollHeight - scrollBoxRef.current.viewport.height;
    scrollBoxRef.current.scrollTop = Math.max(
      0,
      Math.min(maxScrollTop, scrollBoxRef.current.scrollTop + delta)
    );
  };

  const scrollPage = (direction: 1 | -1) => {
    if (!scrollBoxRef.current) return;
    const page = Math.max(
      1,
      Math.floor(scrollBoxRef.current.viewport.height * 0.9)
    );
    scrollBy(direction * page);
  };

  const scrollTop = () => {
    if (!scrollBoxRef.current) return;
    scrollBoxRef.current.scrollTop = 0;
  };

  const scrollBottom = () => {
    scrollToBottom();
  };

  useEffect(() => {
    setImmediate(() => {
      scrollToBottom();
    });
  }, [messages, queuedMessages]);

  // Keybindings for scrolling the messages area
  useKeys(
    (key) => {
      return (
        parseKeys(
          key,
          'messages.scrollPageUp',
          () => scrollPage(-1),
          'messages'
        ) ||
        parseKeys(
          key,
          'messages.scrollPageDown',
          () => scrollPage(1),
          'messages'
        ) ||
        parseKeys(key, 'messages.scrollTop', () => scrollTop(), 'messages') ||
        parseKeys(
          key,
          'messages.scrollBottom',
          () => scrollBottom(),
          'messages'
        )
      );
    },
    { scope: 'messages', enabled: true }
  );

  const processedMessages = processMessagesWithToolAggregation(messages);

  return (
    <box flexGrow={1} flexShrink={1}>
      <scrollbox
        ref={scrollBoxRef}
        verticalScrollbarOptions={{ visible: false }}
        horizontalScrollbarOptions={{ visible: false }}
        contentOptions={{
          flexDirection: 'column',
        }}
      >
        {processedMessages.map((message) => (
          <Message
            key={message.id}
            message={message}
            contentType={message.contentType}
            width={width}
          />
        ))}
        {queuedMessages.map((message) => (
          <Message
            key={message.id}
            message={message}
            width={width}
            isQueued={true}
          />
        ))}
      </scrollbox>
    </box>
  );
}
