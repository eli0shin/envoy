import { DefaultToolMessage } from './components/DefaultToolMessage.js';
import { EditToolMessage } from './components/EditToolMessage.js';
import { ReadToolMessage } from './components/ReadToolMessage.js';
import { ReadMultipleFilesToolMessage } from './components/ReadMultipleFilesToolMessage.js';
import { WriteToolMessage } from './components/WriteToolMessage.js';
import { ListDirectoryToolMessage } from './components/ListDirectoryToolMessage.js';
import { BashToolMessage } from './components/BashToolMessage.js';
import { SearchFilesToolMessage } from './components/SearchFilesToolMessage.js';
import { WebSearchToolMessage } from './components/WebSearchToolMessage.js';
import { CreateDirectoryToolMessage } from './components/CreateDirectoryToolMessage.js';
import { MoveFileToolMessage } from './components/MoveFileToolMessage.js';
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
  filesystem_list_directory_with_sizes: {
    displayName: 'List Directory',
    component: ListDirectoryToolMessage,
  },
  filesystem_write_file: {
    displayName: 'Write File',
    component: WriteToolMessage,
  },
  filesystem_create_directory: {
    displayName: 'Create Directory',
    component: CreateDirectoryToolMessage,
  },
  filesystem_move_file: {
    displayName: 'Move File',
    component: MoveFileToolMessage,
  },
  filesystem_search_files: {
    displayName: 'Search Files',
    component: SearchFilesToolMessage,
  },
  shell_run_command: {
    displayName: 'Bash',
    component: BashToolMessage,
  },
  'brave-search_brave_web_search': {
    displayName: 'Web Search',
    component: WebSearchToolMessage,
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
