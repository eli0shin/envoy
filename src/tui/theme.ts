/**
 * Centralized theme configuration for the TUI application.
 * All colors used throughout the application should be defined here.
 */

import { StyledText, stringToStyledText, fg } from "@opentui/core";
import { parseMarkdown } from "./utils/markdown.js";

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
  backgrounds,
  type ColorName,
  type BackgroundColor,
  type StatusColor,
  type RoleColor,
  type ContentTypeColor,
} from "./colors.js";

import { colors } from "./colors.js";

// Helper function to format multi-line user content with proper indentation
const formatUserContent = (content: string): StyledText => {
  const lines = content.split('\n');
  if (lines.length === 1) {
    // Single line - just add the prefix
    return new StyledText([fg(colors.primary)(`> `), fg(colors.lightGray)(content)]);
  }

  // Multi-line - build styled chunks for proper indentation
  const chunks = [];

  // First line with prefix
  chunks.push(fg(colors.primary)(`> `));
  chunks.push(fg(colors.lightGray)(lines[0]));

  // Subsequent lines with indentation (2 spaces to align with content after "> ")
  for (let i = 1; i < lines.length; i++) {
    chunks.push(fg(colors.lightGray)(`\n  ${lines[i]}`));
  }

  return new StyledText(chunks);
};

// Content formatters - handles both parsing and styling for all AI SDK roles
export const contentFormatters = {
  "user-normal": (content: string): StyledText => formatUserContent(content),
  "user-reasoning": (content: string): StyledText => formatUserContent(content),
  "user-tool": (content: string): StyledText => formatUserContent(content),
  "assistant-normal": (content: string): StyledText => parseMarkdown(content),
  "assistant-reasoning": (content: string): StyledText =>
    parseMarkdown(content),
  "assistant-tool": (content: string): StyledText => parseMarkdown(content),
  "system-normal": (content: string): StyledText =>
    parseMarkdown(`System: ${content}`),
  "system-reasoning": (content: string): StyledText =>
    parseMarkdown(`System: ${content}`),
  "system-tool": (content: string): StyledText =>
    parseMarkdown(`System: ${content}`),
  "tool-normal": (content: string): StyledText => parseMarkdown(content),
  "tool-reasoning": (content: string): StyledText => parseMarkdown(content),
  "tool-tool": (content: string): StyledText => parseMarkdown(content),
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
  role: "user" | "assistant" | "system" | "tool",
  contentType: "normal" | "reasoning" | "tool",
  content: string,
): StyledText => {
  const key = `${role}-${contentType}` as keyof typeof contentFormatters;
  const formatter = contentFormatters[key] ?? defaultContentFormatter;
  return formatter(content);
};

export const formatBackground = (
  role: "user" | "assistant" | "system" | "tool",
): string => {
  return backgroundFormatters[role] ?? defaultBackground;
};
