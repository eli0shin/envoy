/**
 * Type definitions for the tool message formatter system
 */

import type { ReactNode } from 'react';

export type ToolMessageComponentProps = {
  toolName: string; // Original tool identifier
  displayName?: string; // User-friendly display name
  args: unknown; // Tool arguments
  output?: unknown; // Tool execution output payload (v5)
  error?: unknown; // Tool execution error payload
  isError?: boolean; // Whether the result is an error
  width: number; // Available width for rendering
};

export type ToolMessageComponent = (
  props: ToolMessageComponentProps
) => ReactNode;

export type ToolConfig = {
  displayName?: string;
  component: ToolMessageComponent;
  // Future extensions:
  // icon?: string;
  // collapsible?: boolean;
  // showTimestamp?: boolean;
};

export type ToolRegistry = Record<string, ToolConfig>;
