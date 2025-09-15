import { useRef, useEffect } from 'react';
import { Message } from './Message.js';
import type { CoreMessage } from 'ai';
import type { ScrollBoxRenderable } from '@opentui/core';
import { useKeys, parseKeys } from '../keys/index.js';

type MessageListProps = {
  messages: (CoreMessage & { id: string })[];
  width: number;
  key: string;
};

export function MessageList({ messages, width }: MessageListProps) {
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
  }, [messages]);

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

  const renderMessage = (
    message: CoreMessage & { id: string },
    messageIndex: number,
    allMessages: (CoreMessage & { id: string })[],
    consumedMessageIndices: Set<number>
  ) => {
    // Handle content based on type - can be string or array of parts
    if (typeof message.content === 'string') {
      return [<Message message={message} width={width} key={message.id} />];
    }

    // Content is an array of parts - process with tool call/result pairing
    const parts = [];

    for (let partIndex = 0; partIndex < message.content.length; partIndex++) {
      const part = message.content[partIndex];

      // Extract displayable content from different part types
      let displayContent = '';
      let contentType: 'normal' | 'reasoning' | 'tool' = 'normal';

      if (part?.type === 'text' && 'text' in part) {
        displayContent = part.text;
      } else if (part?.type === 'reasoning' && 'text' in part) {
        displayContent = part.text;
        contentType = 'reasoning';
      } else if (part?.type === 'redacted-reasoning') {
        displayContent = '[Reasoning redacted]';
        contentType = 'reasoning';
      } else if (
        part?.type === 'tool-call' &&
        'toolName' in part &&
        'toolCallId' in part
      ) {
        // Look ahead to subsequent messages for matching tool result
        let matchingResult = null;
        let matchingResultMessageIndex = -1;

        for (
          let resultMessageIndex = messageIndex + 1;
          resultMessageIndex < allMessages.length;
          resultMessageIndex++
        ) {
          const resultMessage = allMessages[resultMessageIndex];

          // Look for tool role messages
          if (
            resultMessage.role === 'tool' &&
            Array.isArray(resultMessage.content)
          ) {
            for (const resultPart of resultMessage.content) {
              if (
                resultPart?.type === 'tool-result' &&
                'toolCallId' in resultPart &&
                resultPart.toolCallId === part.toolCallId
              ) {
                matchingResult = resultPart;
                matchingResultMessageIndex = resultMessageIndex;
                break;
              }
            }
            if (matchingResult) break;
          }
        }

        const toolData = {
          toolName: part.toolName,
          args: part.args,
          result:
            matchingResult ?
              'result' in matchingResult ?
                matchingResult.result
              : undefined
            : undefined,
          isError:
            matchingResult ?
              'isError' in matchingResult ?
                matchingResult.isError
              : false
            : undefined,
        };

        // Create message with tool data for custom component rendering
        const partMessage: CoreMessage & { toolData?: typeof toolData } = {
          role: 'assistant',
          content: '', // Empty since component will render
          toolData,
        };

        parts.push(
          <Message
            key={`${message.id}-part-${partIndex}`}
            message={partMessage}
            contentType="tool"
            width={width}
          />
        );

        // Mark result message as consumed if we found one
        if (matchingResultMessageIndex >= 0) {
          consumedMessageIndices.add(matchingResultMessageIndex);
        }

        // Skip the normal message creation below
        continue;
      }

      if (displayContent) {
        const partMessage: CoreMessage = {
          role: 'assistant',
          content: displayContent,
        };

        parts.push(
          <Message
            key={`${message.id}-part-${partIndex}`}
            message={partMessage}
            contentType={contentType}
            width={width}
          />
        );
      }
    }

    return parts;
  };

  // Process messages and pair tool calls with results
  const processedMessages = [];
  const consumedMessageIndices = new Set<number>();

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
    const message = messages[messageIndex];

    // Skip if this message was already consumed as a tool result
    if (consumedMessageIndices.has(messageIndex)) {
      continue;
    }

    processedMessages.push({
      message,
      messageIndex,
      renderedParts: renderMessage(
        message,
        messageIndex,
        messages,
        consumedMessageIndices
      ),
    });
  }

  return (
    <scrollbox
      ref={scrollBoxRef}
      style={{
        rootOptions: {
          flexGrow: 1,
        },
        contentOptions: {
          flexDirection: 'column',
          padding: 1,
        },
        scrollbarOptions: {
          showArrows: false,
        },
      }}
    >
      {processedMessages.map(({ message, renderedParts }) => (
        <box key={message.id}>{renderedParts}</box>
      ))}
    </scrollbox>
  );
}
