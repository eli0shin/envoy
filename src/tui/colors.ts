/**
 * Centralized color definitions for the TUI application.
 * All colors used throughout the application should be defined here.
 */

export const colors = {
  // Text colors
  primary: '#4fc1ff', // Header title, user messages
  processing: '#DCDCAA', // Processing status, reasoning content
  success: '#89d185', // Ready status, assistant messages
  warning: '#FFD700', // Warning messages, exit confirmation
  muted: '#858585', // Session info display
  lightGray: '#DCDCDC', // Slightly muted content text
  accent: '#C586C0', // Tool-related content
  text: '#D4D4D4', // Input text color

  // Background colors
  backgrounds: {
    main: '#1E1E1E', // Main UI background
    userMessage: '#2a2d2e', // User message background
    assistantMessage: '#1E1E1E', // Assistant message background
    input: '#252526', // Input area background
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
  warning,
  muted,
  lightGray,
  accent,
  text,
  backgrounds,
} = colors;

// Type definitions for theme values
export type ColorName = keyof typeof colors;
export type BackgroundColor = keyof typeof colors.backgrounds;
export type StatusColor = keyof typeof statusColors;
export type RoleColor = keyof typeof roleColors;
export type ContentTypeColor = keyof typeof contentTypeColors;
