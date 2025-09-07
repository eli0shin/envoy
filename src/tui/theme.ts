/**
 * Centralized theme configuration for the TUI application.
 * All colors used throughout the application should be defined here.
 */

import type { StyledText } from "@opentui/core";
import { parseMarkdown } from "./utils/markdown";

export const colors = {
  // Text colors
  primary: "#4fc1ff", // Header title, user messages
  processing: "#DCDCAA", // Processing status, reasoning content
  success: "#89d185", // Ready status, assistant messages
  muted: "#858585", // Session info display
  lightGray: "#DCDCDC", // Slightly muted content text
  accent: "#C586C0", // Tool-related content
  text: "#D4D4D4", // Input text color

  // Background colors
  backgrounds: {
    main: "#1E1E1E", // Main UI background
    userMessage: "#2a2d2e", // User message background
    assistantMessage: "#1E1E1E", // Assistant message background
    input: "#252526", // Input area background
  },
} as const;

// Status-specific color mappings
export const statusColors = {
  READY: colors.success,
  PROCESSING: colors.processing,
} as const;

// Role-specific color mappings
export const roleColors = {
  user: colors.primary,
  assistant: colors.success,
} as const;

// Content type color mappings
export const contentTypeColors = {
  normal: colors.lightGray,
  reasoning: colors.processing,
  tool: colors.accent,
} as const;

// Export individual color values for convenience
export const {
  primary,
  processing,
  success,
  muted,
  lightGray,
  accent,
  text,
  backgrounds,
} = colors;

// Content formatters - handles both parsing and styling for all AI SDK roles
export const contentFormatters = {
  "user-normal": (content: string): StyledText => parseMarkdown(`> ${content}`),
  "user-reasoning": (content: string): StyledText =>
    parseMarkdown(`> ${content}`),
  "user-tool": (content: string): StyledText => parseMarkdown(`> ${content}`),
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

// Type definitions for theme values
export type ColorName = keyof typeof colors;
export type BackgroundColor = keyof typeof colors.backgrounds;
export type StatusColor = keyof typeof statusColors;
export type RoleColor = keyof typeof roleColors;
export type ContentTypeColor = keyof typeof contentTypeColors;
