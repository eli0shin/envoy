/**
 * Centralized theme configuration for the TUI application.
 * All colors used throughout the application should be defined here.
 */

import { Markdown } from './utils/markdown.js';

// Re-export colors from the colors module
export {
  colors,
  statusColors,
  roleColors,
  contentTypeColors,
  primary,
  processing,
  success,
  muted,
  lightGray,
  accent,
  text,
  error,
  info,
  filePath,
  diffAddition,
  diffDeletion,
  quoteBorder,
  admonitionWarning,
  admonitionText,
  backgrounds,
  type ColorName,
  type BackgroundColor,
  type StatusColor,
  type RoleColor,
  type ContentTypeColor,
} from './colors.js';

import { colors } from './colors.js';

// Components for formatting user content
function UserContent({ content }: { content: string }) {
  const lines = content.split('\n');

  if (lines.length === 1) {
    return (
      <span fg={colors.lightGray}>
        <span fg={colors.primary}>&gt; </span>
        {content}
      </span>
    );
  }

  return (
    <span fg={colors.lightGray}>
      <span fg={colors.primary}>&gt; </span>
      {lines[0]}
      {lines.slice(1).map((line, i) => (
        <span key={i}> {/* eslint-disable-line react/no-array-index-key, @eslint-react/no-array-index-key -- Line position is semantically important */}
          {`\n  ${line}`}
        </span>
      ))}
    </span>
  );
}

function QueuedUserContent({ content }: { content: string }) {
  const lines = content.split('\n');

  if (lines.length === 1) {
    return (
      <span fg={colors.muted}>
        &gt; {content}
      </span>
    );
  }

  return (
    <span fg={colors.muted}>
      &gt; {lines[0]}
      {lines.slice(1).map((line, i) => (
        <span key={i}> {/* eslint-disable-line react/no-array-index-key, @eslint-react/no-array-index-key -- Line position is semantically important */}
          {`\n  ${line}`}
        </span>
      ))}
    </span>
  );
}

function AssistantReasoningContent({ content }: { content: string }) {
  return (
    <i>
      <span fg={colors.reasoningText}>
        {content}
      </span>
    </i>
  );
}

function AssistantToolContent({ content }: { content: string }) {
  if (content.includes('[ERROR]')) {
    const lines = content.split('\n');
    return (
      <span>
        {lines.map((line, i) => {
          if (line.startsWith('[ERROR]')) {
            const errorLine = line.substring(7);
            return (
              <span key={i} fg={colors.error}> {/* eslint-disable-line react/no-array-index-key, @eslint-react/no-array-index-key -- Line position is semantically important */}
                {errorLine}
                {i < lines.length - 1 ? '\n' : ''}
              </span>
            );
          }
          return (
            <span key={i} fg={colors.accent}> {/* eslint-disable-line react/no-array-index-key, @eslint-react/no-array-index-key -- Line position is semantically important */}
              {line}
              {i < lines.length - 1 ? '\n' : ''}
            </span>
          );
        })}
      </span>
    );
  }
  return <Markdown content={content} />;
}

function SystemContent({ content }: { content: string }) {
  return <Markdown content={`System: ${content}`} />;
}

// Main component for rendering message content
export type MessageContentProps = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  contentType: 'normal' | 'reasoning' | 'tool';
  content: string;
  isQueued?: boolean;
};

export function MessageContent({ role, contentType, content, isQueued = false }: MessageContentProps) {
  // User messages
  if (role === 'user') {
    if (isQueued) {
      return <QueuedUserContent content={content} />;
    }
    return <UserContent content={content} />;
  }

  // Assistant messages
  if (role === 'assistant') {
    if (contentType === 'reasoning') {
      return <AssistantReasoningContent content={content} />;
    }
    if (contentType === 'tool') {
      return <AssistantToolContent content={content} />;
    }
    return <Markdown content={content} />;
  }

  // System messages
  if (role === 'system') {
    return <SystemContent content={content} />;
  }

  // Tool messages
  if (role === 'tool') {
    return <Markdown content={content} />;
  }

  // Default fallback
  return <Markdown content={content} />;
}

// Background colors for messages
export const backgroundFormatters = {
  user: colors.backgrounds.userMessage,
  assistant: colors.backgrounds.assistantMessage,
  system: colors.backgrounds.assistantMessage,
  tool: colors.backgrounds.assistantMessage,
} as const;

export const formatBackground = (
  role: 'user' | 'assistant' | 'system' | 'tool'
): string => {
  return backgroundFormatters[role] ?? colors.backgrounds.main;
};
