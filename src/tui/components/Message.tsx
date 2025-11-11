import {
  MessageContent as MessageContentComponent,
  formatBackground,
} from '../theme.js';
import { getToolConfig } from '../toolFormatters/index.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import type { ModelMessage } from 'ai';

type ToolData = {
  toolName: string;
  args: unknown;
  output?: unknown;
  error?: unknown;
  isError?: boolean;
};

type MessageProps = {
  message: ModelMessage & { toolData?: ToolData };
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
    const { toolName, args, output, error, isError } = message.toolData;
    const config = getToolConfig(toolName);
    const ToolComponent = config.component;

    return (
      <box
        paddingBottom={1}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={formatBackground(message.role)}
      >
        <ErrorBoundary>
          <ToolComponent
            toolName={toolName}
            displayName={config.displayName}
            args={args}
            output={output}
            error={error}
            isError={isError}
            width={width}
          />
        </ErrorBoundary>
      </box>
    );
  }

  const getDisplayContent = (message: ModelMessage): string => {
    let content: string;

    if (typeof message.content === 'string') {
      content = message.content;
    } else {
      // Extract text from array of content parts
      const textParts: string[] = [];
      for (const part of message.content) {
        if (!part || typeof part !== 'object' || !('type' in part)) continue;

        if (part.type === 'text' && 'text' in part) {
          textParts.push(part.text);
        } else if (part.type === 'reasoning' && 'text' in part) {
          textParts.push(part.text);
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

  const isHookFeedback = (message: ModelMessage): boolean => {
    const content = typeof message.content === 'string' ? message.content : '';
    return message.role === 'user' && content.includes('<post_tool_use_hook>');
  };

  const extractHookContent = (content: string): string => {
    const match = content.match(
      /<post_tool_use_hook>\n?(.*?)\n?<\/post_tool_use_hook>/s
    );
    return match ? match[1].trim() : content;
  };

  const displayContent = getDisplayContent(message);
  const isHook = isHookFeedback(message);
  const backgroundColor =
    isHook ? 'transparent' : formatBackground(message.role);
  const verticalPadding = message.role === 'user' && !isHook ? 1 : 0;
  const finalContent =
    isHook ? extractHookContent(displayContent) : displayContent;

  return (
    <box paddingBottom={1}>
      <box
        paddingTop={verticalPadding}
        paddingBottom={verticalPadding}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={backgroundColor}
      >
        <text>
          <MessageContentComponent
            role={message.role}
            contentType={contentType}
            content={finalContent}
            isQueued={isQueued}
          />
        </text>
      </box>
    </box>
  );
}
