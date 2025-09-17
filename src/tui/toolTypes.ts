/**
 * Tool call types for all available tools
 * 
 * Available Tools:
 * - filesystem_read_text_file: Read complete contents of a text file (with optional head/tail)
 * - filesystem_read_media_file: Read image or audio files (returns base64 + MIME type)
 * - filesystem_read_multiple_files: Read multiple files simultaneously
 * - filesystem_list_directory: List files and directories with [FILE]/[DIR] prefixes
 * - filesystem_list_directory_with_sizes: List files and directories with sizes
 * - filesystem_write_file: Create new file or overwrite existing file
 * - filesystem_edit_file: Make line-based edits to text files (returns git-style diff)
 * - filesystem_create_directory: Create directories (can create nested paths)
 * - filesystem_move_file: Move or rename files and directories
 * - filesystem_search_files: Recursively search for files matching a pattern
 * - filesystem_directory_tree: Get recursive tree view as JSON (NOT RECOMMENDED FOR USE)
 * - shell_run_command: Execute shell commands
 * - brave-search_brave_web_search: Perform web searches using Brave Search API
 */

// Tool call arguments
export type FilesystemReadTextFileArgs = {
  path: string;
  head?: number;
  tail?: number;
};

export type FilesystemReadMediaFileArgs = {
  path: string;
};

export type FilesystemListDirectoryArgs = {
  path: string;
};

export type FilesystemListDirectoryWithSizesArgs = {
  path: string;
  sortBy?: string;
};

export type FilesystemWriteFileArgs = {
  path: string;
  content: string;
};

export type FilesystemEditFileArgs = {
  path: string;
  edits: Array<{
    oldText: string;
    newText: string;
  }>;
  dryRun?: boolean;
};

export type FilesystemReadMultipleFilesArgs = {
  paths: string[];
};

export type FilesystemCreateDirectoryArgs = {
  path: string;
};

export type FilesystemMoveFileArgs = {
  source: string;
  destination: string;
};

export type FilesystemSearchFilesArgs = {
  path: string;
  pattern: string;
  excludePatterns?: string[];
};

export type FilesystemDirectoryTreeArgs = {
  path: string;
}; // Returns recursive JSON structure with files/directories

export type ShellRunCommandArgs = {
  command: string;
}; // Example output: "Hello World"

export type BraveSearchBraveWebSearchArgs = {
  query: string;
  count?: number;
  offset?: number;
}; // Returns web search results with titles, URLs, and snippets

// Tool call results
export type FilesystemReadTextFileResult = {
  result: string;
};

export type FilesystemReadMediaFileResult = {
  result: string;
};

export type FilesystemListDirectoryResult = {
  result: string;
};

export type FilesystemListDirectoryWithSizesResult = {
  result: string;
};

export type FilesystemWriteFileResult = {
  result: string;
};

export type FilesystemEditFileResult = {
  result: string;
};

export type FilesystemReadMultipleFilesResult = {
  result: string;
};

export type FilesystemCreateDirectoryResult = {
  result: string;
};

export type FilesystemMoveFileResult = {
  result: string;
};

export type FilesystemSearchFilesResult = {
  result: string;
};

export type FilesystemDirectoryTreeResult = {
  result: string;
};

export type ShellRunCommandResult = {
  result: string;
};

export type BraveSearchBraveWebSearchResult = {
  result: string;
};

// Tool call message structure
export type ToolCall = {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: unknown;
};

export type ToolResult = {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: {
    result: string;
  };
};

// Tool names as seen in conversation
export type ToolName =
  | 'filesystem_read_text_file'
  | 'filesystem_read_media_file'
  | 'filesystem_read_multiple_files'
  | 'filesystem_list_directory'
  | 'filesystem_list_directory_with_sizes'
  | 'filesystem_write_file'
  | 'filesystem_edit_file'
  | 'filesystem_create_directory'
  | 'filesystem_move_file'
  | 'filesystem_search_files'
  | 'filesystem_directory_tree'
  | 'shell_run_command'
  | 'brave-search_brave_web_search';

// Example output for filesystem_edit_file tool
export const FILESYSTEM_EDIT_FILE_EXAMPLE_OUTPUT = `\`\`\`diff
Index: /Users/elioshinsky/code/language-learner/README_EXPLANATION.md
===================================================================
--- /Users/elioshinsky/code/language-learner/README_EXPLANATION.md	original
+++ /Users/elioshinsky/code/language-learner/README_EXPLANATION.md	modified
@@ -1,14 +1,14 @@
 # Envoy - AI Agent Messenger

-This README describes **Envoy**, a sophisticated command-line AI agent built with **Vercel AI SDK 4.2** and **Model Context Protocol (MCP)**. Here's what it does:
+**Envoy** is a command-line tool that lets you chat with different AI models from your terminal.

-## Core Purpose
-Envoy is a unified CLI tool that provides access to multiple AI models (OpenAI, Anthropic, Google Gemini, OpenRouter) with advanced reasoning capabilities and tool integration.
+## What It Does
+Envoy connects you to popular AI services like ChatGPT, Claude, and Google Gemini all from one place. It can also run commands, read files, and perform tasks on your computer.

 ## Key Features

-### 🤖 **Multi-Provider AI Support**
+### 🤖 **Multiple AI Models**
 - Works with OpenAI, Anthropic, Google Gemini, and OpenRouter
 - Easy provider switching with \`--provider\` flag
 - Flexible model selection

\`\`\`

`;
