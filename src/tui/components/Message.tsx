import { formatContent, formatBackground } from '../theme.js';
import { getToolConfig } from '../toolFormatters/index.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import type { CoreMessage } from 'ai';

type ToolData = {
  toolName: string;
  args: unknown;
  result?: unknown;
  isError?: boolean;
};

type MessageProps = {
  message: CoreMessage & { toolData?: ToolData };
  contentType?: 'normal' | 'reasoning' | 'tool';
  width: number;
  key: string;
  isQueued?: boolean;
};

export function Message({
  message,
  contentType = 'normal',
  width,
  isQueued = false,
}: MessageProps) {
  // Handle tool messages with custom components
  if (contentType === 'tool' && message.toolData) {
    const { toolName, args, result, isError } = message.toolData;
    const config = getToolConfig(toolName);
    const ToolComponent = config.component;

    return (
      <box
        paddingBottom={1}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={formatBackground(message.role)}
        width={width - 2}
      >
        <ErrorBoundary>
          <ToolComponent
            toolName={toolName}
            displayName={config.displayName}
            args={args}
            result={result}
            isError={isError}
            width={width}
          />
        </ErrorBoundary>
      </box>
    );
  }

  const getDisplayContent = (message: CoreMessage): string => {
    let content: string;

    if (typeof message.content === 'string') {
      content = message.content;
    } else {
      // Extract text from array of content parts
      const textParts: string[] = [];
      for (const part of message.content) {
        if (part?.type === 'text' && 'text' in part) {
          textParts.push(part.text);
        } else if (part?.type === 'reasoning' && 'text' in part) {
          textParts.push(part.text);
        } else if (part?.type === 'redacted-reasoning') {
          textParts.push('[Reasoning redacted]');
        }
      }
      content = textParts.join('\n');
    }

    // Only filter user messages for display
    if (message.role === 'user') {
      // Remove <user-command> tags but keep contents
      content = content.replace(/<user-command>(.*?)<\/user-command>/gs, '$1');

      // Remove <system-hint> tags and all contents (user doesn't need to see these)
      content = content.replace(/<system-hint>.*?<\/system-hint>/gs, '');

      // Clean up extra whitespace
      content = content.trim();
    }

    return content;
  };

  const displayContent = getDisplayContent(message);

  // Calculate available width for text (terminal width minus scrollbox, padding, and margins)
  const textWidth = width - 6; // 6 = scrollbox (2) + padding (2) + margin/border space (2)

  // Simple text wrapping - formatContent will handle prefixes
  const wrapText = (text: string, maxWidth: number): string => {
    if (maxWidth <= 0) return text;

    // First split by existing newlines to preserve intentional line breaks
    const existingLines = text.split('\n');
    const wrappedLines: string[] = [];

    // Process each existing line individually
    for (const line of existingLines) {
      if (line.length <= maxWidth) {
        wrappedLines.push(line);
      } else {
        // Line needs wrapping, wrap by words
        const words = line.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;

          if (testLine.length <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              wrappedLines.push(currentLine);
              currentLine = word;
            } else {
              // Word is longer than available width, break it
              let remainingWord = word;
              while (remainingWord.length > maxWidth) {
                wrappedLines.push(remainingWord.substring(0, maxWidth));
                remainingWord = remainingWord.substring(maxWidth);
              }
              if (remainingWord) {
                currentLine = remainingWord;
              }
            }
          }
        }

        if (currentLine) {
          wrappedLines.push(currentLine);
        }
      }
    }

    return wrappedLines.join('\n');
  };

  const wrappedContent = wrapText(displayContent, textWidth);

  // Use theme system for all formatting, including queued messages
  const styledContent = formatContent(
    message.role,
    contentType,
    wrappedContent,
    isQueued
  );
  const backgroundColor = formatBackground(message.role);

  const verticalPadding = message.role === 'user' ? 1 : 0;

  return (
    <box paddingBottom={1} width={width - 2}>
      <box
        paddingTop={verticalPadding}
        paddingBottom={verticalPadding}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={backgroundColor}
        width={width - 2}
      >
        <text
          style={{
            width: textWidth,
          }}
        >
          {styledContent}
        </text>
      </box>
    </box>
  );
}
