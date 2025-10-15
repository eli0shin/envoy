import { useTerminalDimensions } from '@opentui/react';
import { colors } from '../theme.js';
import type { ModelMessage } from 'ai';

type QueuedMessagesListProps = {
  queuedMessages: (ModelMessage & { id: string })[];
  bottomOffset: number;
};

export function QueuedMessagesList({
  queuedMessages,
  bottomOffset,
}: QueuedMessagesListProps) {
  const { height } = useTerminalDimensions();

  if (queuedMessages.length === 0) {
    return null;
  }

  // Calculate total height needed for all queued messages
  const messageLines = queuedMessages.map((message) => {
    const content = typeof message.content === 'string' ? message.content : '';
    // Count lines in the content
    return Math.max(1, content.split('\n').length);
  });
  const totalHeight = messageLines.length;

  // Position above InputArea + StatusBar
  const boxTop = height - bottomOffset - totalHeight;

  return (
    <box
      position="absolute"
      top={boxTop}
      left={0}
      right={0}
      height={totalHeight}
      flexDirection="column"
      backgroundColor={colors.backgrounds.userMessage}
      zIndex={50}
    >
      {queuedMessages.map((message, index) => {
        const content =
          typeof message.content === 'string' ? message.content : '';
        const lines = content.split('\n');
        const messageHeight = messageLines[index];

        return (
          <box
            key={message.id}
            height={messageHeight}
            paddingLeft={1}
            flexDirection="column"
          >
            {lines.map((line, lineIndex) => (
              <box key={`${message.id}-line-${line}`} height={1}>
                <text>
                  <span fg={colors.muted}>
                    {lineIndex === 0 ? '> ' : '  '}
                    {line}
                  </span>
                </text>
              </box>
            ))}
          </box>
        );
      })}
    </box>
  );
}
