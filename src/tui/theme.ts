/**
 * Centralized theme configuration for the TUI application.
 * All colors used throughout the application should be defined here.
 */

// Named color palette using OpenTUI color names
export const colors = {
  // Text colors
  primary: "cyan",      // Header title, user messages
  processing: "yellow", // Processing status, reasoning content
  success: "green",     // Ready status, assistant messages
  muted: "gray",        // Session info display
  accent: "magenta",    // Tool-related content
  text: "white",        // Input text color
  
  // Background colors (hex values)
  backgrounds: {
    userMessage: "#1a1a2e",     // User message background
    assistantMessage: "#0f0f0f", // Assistant message background
    input: "#333333",            // Input area background
  }
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
  normal: colors.success,
  reasoning: colors.processing,
  tool: colors.accent,
} as const;

// Export individual color values for convenience
export const {
  primary,
  processing, 
  success,
  muted,
  accent,
  text,
  backgrounds
} = colors;

// Type definitions for theme values
export type ColorName = keyof typeof colors;
export type BackgroundColor = keyof typeof colors.backgrounds;
export type StatusColor = keyof typeof statusColors;
export type RoleColor = keyof typeof roleColors;
export type ContentTypeColor = keyof typeof contentTypeColors;