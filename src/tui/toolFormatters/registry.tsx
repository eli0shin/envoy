import { DefaultToolMessage } from './components/DefaultToolMessage.js';
import { EditToolMessage } from './components/EditToolMessage.js';
import { ReadToolMessage } from './components/ReadToolMessage.js';
import { ReadMultipleFilesToolMessage } from './components/ReadMultipleFilesToolMessage.js';
import { WriteToolMessage } from './components/WriteToolMessage.js';
import { ListDirectoryToolMessage } from './components/ListDirectoryToolMessage.js';
import type { ToolRegistry, ToolConfig } from './types.js';

// Helper to convert snake_case to Title Case
function formatToolName(toolName: string): string {
  return toolName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const toolRegistry: ToolRegistry = {
  // File operations - MCP tool names
  filesystem_edit_file: {
    displayName: 'Edit File',
    component: EditToolMessage,
  },
  filesystem_read_text_file: {
    displayName: 'Read File',
    component: ReadToolMessage,
  },
  filesystem_read_multiple_files: {
    displayName: 'Read Files',
    component: ReadMultipleFilesToolMessage,
  },
  filesystem_list_directory: {
    displayName: 'List Directory',
    component: ListDirectoryToolMessage,
  },
  filesystem_write_file: {
    displayName: 'Write File',
    component: WriteToolMessage,
  },

  // Command execution
  bash: {
    displayName: 'Run Command',
    component: DefaultToolMessage, // Will be replaced with BashToolMessage
  },
  bash_output: {
    displayName: 'Check Output',
    component: DefaultToolMessage,
  },

  // Search operations
  grep: {
    displayName: 'Search Files',
    component: DefaultToolMessage,
  },
  glob: {
    displayName: 'Find Files',
    component: DefaultToolMessage,
  },

  // Task management
  todo_write: {
    displayName: 'Update Todos',
    component: DefaultToolMessage, // Will be replaced with TodoToolMessage
  },

  // Web operations
  web_fetch: {
    displayName: 'Fetch URL',
    component: DefaultToolMessage,
  },
  web_search: {
    displayName: 'Web Search',
    component: DefaultToolMessage,
  },
};

// Get tool configuration with fallback to default
export function getToolConfig(toolName: string): ToolConfig {
  return (
    toolRegistry[toolName] || {
      component: DefaultToolMessage,
      displayName: formatToolName(toolName),
    }
  );
}
