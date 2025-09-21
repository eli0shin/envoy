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
  output: unknown;
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
  | 'shell_run_command'
  | 'brave-search_brave_web_search';

// Example outputs for all tools
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

export const FILESYSTEM_READ_TEXT_FILE_EXAMPLE_OUTPUT = `/**
 * Tool call types for all available tools
 * 
 * Available Tools:
 * - filesystem_read_text_file: Read complete contents of a text file (with optional head/tail)
 * - filesystem_read_media_file: Read image or audio files (returns base64 + MIME type)
 * - filesystem_read_multiple_files: Read multiple files simultaneously
 */

// Tool call arguments
export type FilesystemReadTextFileArgs = {
  path: string;
  head?: number;
  tail?: number;
};`;

export const FILESYSTEM_READ_MEDIA_FILE_EXAMPLE_OUTPUT = `Error: [
  {
    "code": "invalid_union",
    "unionErrors": [
      {
        "issues": [
          {
            "received": "blob",
            "code": "invalid_literal",
            "expected": "text",
            "path": [
              "content",
              0,
              "type"
            ],
            "message": "Invalid literal value, expected \\"text\\""
          }
        ]
      }
    ]
  }
]`;

export const FILESYSTEM_READ_MULTIPLE_FILES_EXAMPLE_OUTPUT = `=== src/tui/toolTypes.ts ===
/**
 * Tool call types for all available tools
 */

// Tool call arguments
export type FilesystemReadTextFileArgs = {
  path: string;
  head?: number;
  tail?: number;
};

=== package.json ===
{
  "name": "language-learner",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsx src/index.ts"
  }
}`;

export const FILESYSTEM_LIST_DIRECTORY_EXAMPLE_OUTPUT = `[DIR] .claude
[DIR] .git
[FILE] .gitignore
[FILE] .prettierrc
[DIR] bin
[FILE] bun.lock
[FILE] CLAUDE.md
[DIR] docs
[FILE] eslint.config.mjs
[DIR] interactive-tests
[DIR] node_modules
[FILE] package.json
[FILE] README.md
[DIR] src
[FILE] test-config.json
[DIR] test-utils
[FILE] tsconfig.build.json
[FILE] tsconfig.json
[FILE] vitest.config.ts
[FILE] vitest.e2e.config.ts
[FILE] vitest.interactive.config.ts
[FILE] vitest.setup.ts`;

export const FILESYSTEM_LIST_DIRECTORY_WITH_SIZES_EXAMPLE_OUTPUT = `[DIR] .claude                        
[DIR] .git                           
[FILE] .gitignore                           22 B
[FILE] .prettierrc                          85 B
[DIR] bin                            
[FILE] bun.lock                        174.76 KB
[FILE] CLAUDE.md                         2.44 KB
[DIR] docs                           
[FILE] eslint.config.mjs                 2.43 KB
[DIR] interactive-tests              
[DIR] node_modules                   
[FILE] package.json                      2.71 KB
[FILE] README.md                        10.31 KB
[DIR] src                            
[FILE] test-config.json                    726 B
[DIR] test-utils                     
[FILE] tsconfig.build.json                 609 B
[FILE] tsconfig.json                       555 B
[FILE] vitest.config.ts                  1.55 KB
[FILE] vitest.e2e.config.ts              1.64 KB
[FILE] vitest.interactive.config.ts        649 B
[FILE] vitest.setup.ts                   5.63 KB

Total: 14 files, 8 directories
Combined size: 204.04 KB`;

export const FILESYSTEM_WRITE_FILE_EXAMPLE_OUTPUT = `Successfully wrote to test-file.txt`;

export const FILESYSTEM_CREATE_DIRECTORY_EXAMPLE_OUTPUT = `Successfully created directory test-temp-dir`;

export const FILESYSTEM_MOVE_FILE_EXAMPLE_OUTPUT = `Successfully moved test-temp-dir to test-temp-renamed`;

export const FILESYSTEM_SEARCH_FILES_EXAMPLE_OUTPUT = `/Users/elioshinsky/code/language-learner/src/tui/components/CommandAutocomplete.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/ErrorBoundary.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/FileAutocomplete.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/Header.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/HelpModal.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/InputArea.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/Message.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/MessageList.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/Modal.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/ModalDisplay.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/ModalProvider.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/MultiLineInput.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/StatusBar.tsx
/Users/elioshinsky/code/language-learner/src/tui/components/TUIApp.tsx
/Users/elioshinsky/code/language-learner/src/tui/index.tsx
/Users/elioshinsky/code/language-learner/src/tui/keys/dispatcher.tsx
/Users/elioshinsky/code/language-learner/src/tui/keys/prefixContext.tsx
/Users/elioshinsky/code/language-learner/src/tui/toolFormatters/components/DefaultToolMessage.tsx
/Users/elioshinsky/code/language-learner/src/tui/toolFormatters/components/EditToolMessage.tsx
/Users/elioshinsky/code/language-learner/src/tui/toolFormatters/components/ListDirectoryToolMessage.tsx
/Users/elioshinsky/code/language-learner/src/tui/toolFormatters/components/ReadMultipleFilesToolMessage.tsx
/Users/elioshinsky/code/language-learner/src/tui/toolFormatters/components/ReadToolMessage.tsx
/Users/elioshinsky/code/language-learner/src/tui/toolFormatters/components/WriteToolMessage.tsx
/Users/elioshinsky/code/language-learner/src/tui/toolFormatters/registry.tsx`;

export const SHELL_RUN_COMMAND_EXAMPLE_OUTPUT = `Hello from shell command test`;

export const BRAVE_SEARCH_BRAVE_WEB_SEARCH_EXAMPLE_OUTPUT = `Title: TypeScript Formatter online to format TS code.
Description: Online Typescript Code Formatter to beautify and prettier Typescript code.
URL: https://codebeautify.org/typescript-formatter-online

Title: TypeScript in Visual Studio Code
Description: For more specialized code formatting styles, try installing one of the formatting extensions from the VS Code Marketplace. VS Code includes some handy refactorings for TypeScript such as Extract function and Extract constant.
URL: https://code.visualstudio.com/docs/languages/typescript

Title: typescript-formatter - npm
Description: Formatter of TypeScript code. Latest version: 7.2.2, last published: 7 years ago. Start using typescript-formatter in your project by running \`npm i typescript-formatter\`. There are 118 other projects in the npm registry using typescript-formatter.
URL: https://www.npmjs.com/package/typescript-formatter`;
