/**
 * Centralized theme configuration for the TUI application.
 * All colors used throughout the application should be defined here.
 */

import { StyledText, fg, italic } from '@opentui/core';
import { parseMarkdown } from './utils/markdown.js';

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

// Helper function to format multi-line user content with proper indentation
const formatUserContent = (content: string): StyledText => {
  const lines = content.split('\n');
  const chunks = [];

  //Add empty line at the top (with background color)
  // chunks.push(fg(colors.lightGray)('\n'));

  if (lines.length === 1) {
    // Single line - just add the prefix
    chunks.push(fg(colors.primary)(`> `));
    chunks.push(fg(colors.lightGray)(content));
  } else {
    // Multi-line - build styled chunks for proper indentation
    // First line with prefix
    chunks.push(fg(colors.primary)(`> `));
    chunks.push(fg(colors.lightGray)(lines[0]));

    // Subsequent lines with indentation (2 spaces to align with content after "> ")
    for (let i = 1; i < lines.length; i++) {
      chunks.push(fg(colors.lightGray)(`\n  ${lines[i]}`));
    }
  }

  return new StyledText(chunks);
};

// Helper function to format queued user messages
const formatQueuedUserContent = (content: string): StyledText => {
  const lines = content.split('\n');
  const chunks = [];

  // No top blank line for queued messages - relies on spacing from message above
  if (lines.length === 1) {
    chunks.push(fg(colors.muted)(`> `));
    chunks.push(fg(colors.muted)(content));
  } else {
    // Multi-line - build styled chunks with muted color
    chunks.push(fg(colors.muted)(`> `));
    chunks.push(fg(colors.muted)(lines[0]));

    for (let i = 1; i < lines.length; i++) {
      chunks.push(fg(colors.muted)(`\n  ${lines[i]}`));
    }
  }

  return new StyledText(chunks);
};

// Content formatters - handles both parsing and styling for all AI SDK roles
export const contentFormatters = {
  'user-normal': (content: string): StyledText => formatUserContent(content),
  'user-reasoning': (content: string): StyledText => formatUserContent(content),
  'user-tool': (content: string): StyledText => formatUserContent(content),
  'user-normal-queued': (content: string): StyledText =>
    formatQueuedUserContent(content),
  'user-reasoning-queued': (content: string): StyledText =>
    formatQueuedUserContent(content),
  'user-tool-queued': (content: string): StyledText =>
    formatQueuedUserContent(content),
  'assistant-normal': (content: string): StyledText => parseMarkdown(content),
  'assistant-reasoning': (content: string): StyledText => {
    const parsed = parseMarkdown(content);
    // Apply italic styling to reasoning content with darker color
    const italicChunks = parsed.chunks.map((chunk) => {
      // Preserve any existing styling but add italic and use reasoning color
      return italic(fg(colors.reasoningText)(chunk.text));
    });
    return new StyledText(italicChunks);
  },
  'assistant-tool': (content: string): StyledText => {
    // Handle error styling for tool calls
    if (content.includes('[ERROR]')) {
      const lines = content.split('\n');
      const chunks = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('[ERROR]')) {
          // Remove the [ERROR] marker and style the error line in red
          const errorLine = line.substring(7); // Remove "[ERROR]" prefix
          chunks.push(fg(colors.error)(errorLine)); // Red color for error
        } else {
          chunks.push(fg(colors.accent)(line));
        }
        // Add newline between lines (except for the last one)
        if (i < lines.length - 1) {
          chunks.push(fg(colors.accent)('\n'));
        }
      }

      return new StyledText(chunks);
    }
    return parseMarkdown(content);
  },
  'system-normal': (content: string): StyledText =>
    parseMarkdown(`System: ${content}`),
  'system-reasoning': (content: string): StyledText =>
    parseMarkdown(`System: ${content}`),
  'system-tool': (content: string): StyledText =>
    parseMarkdown(`System: ${content}`),
  'tool-normal': (content: string): StyledText => parseMarkdown(content),
  'tool-reasoning': (content: string): StyledText => parseMarkdown(content),
  'tool-tool': (content: string): StyledText => parseMarkdown(content),
} as const;

// Background formatters for all AI SDK roles
export const backgroundFormatters = {
  user: colors.backgrounds.userMessage,
  assistant: colors.backgrounds.assistantMessage,
  system: colors.backgrounds.assistantMessage, // Same as assistant
  tool: colors.backgrounds.assistantMessage, // Same as assistant
} as const;

// Default fallbacks
const defaultContentFormatter = (content: string): StyledText =>
  parseMarkdown(content);
const defaultBackground = colors.backgrounds.main;

// Utility functions to replace conditional logic - now handles all AI SDK roles
export const formatContent = (
  role: 'user' | 'assistant' | 'system' | 'tool',
  contentType: 'normal' | 'reasoning' | 'tool',
  content: string,
  isQueued: boolean = false
): StyledText => {
  const suffix = isQueued && role === 'user' ? '-queued' : '';
  const key =
    `${role}-${contentType}${suffix}` as keyof typeof contentFormatters;
  const formatter = contentFormatters[key] ?? defaultContentFormatter;
  return formatter(content);
};

export const formatBackground = (
  role: 'user' | 'assistant' | 'system' | 'tool'
): string => {
  return backgroundFormatters[role] ?? defaultBackground;
};
