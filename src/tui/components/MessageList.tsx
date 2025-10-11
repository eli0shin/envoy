import { Message } from './Message.js';
import type { ModelMessage } from 'ai';
import { useScrollBox } from '../hooks/useScrollBox.js';

type MessageListProps = {
  messages: (ModelMessage & { id: string })[];
  width: number;
};

type ToolData = {
  toolName: string;
  args: unknown;
  output?: unknown;
  error?: unknown;
  isError?: boolean;
};

type RenderableMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
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
      renderableMessages.push({
        id: message.id,
        role: message.role,
        content: message.content,
      });
      continue;
    }

    // Handle array content - split into parts
    const parts = message.content;
    if (!Array.isArray(parts)) {
      renderableMessages.push({
        id: message.id,
        role: message.role,
        content: '',
      });
      continue;
    }

    // Process each content part separately to preserve type information
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
            typeof resultObject.type === 'string' ?
              resultObject.type
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

export function MessageList({ messages, width }: MessageListProps) {
  const { scrollBoxRef } = useScrollBox({
    autoScrollOnChange: true,
    scrollDependencies: [messages],
    keybindingsScope: 'messages',
    enableKeybindings: true,
  });

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
            message={message as ModelMessage & { toolData?: ToolData }}
            contentType={message.contentType}
            width={width}
          />
        ))}
      </scrollbox>
    </box>
  );
}
