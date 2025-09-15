/**
 * Tool call types extracted from conversation logs
 */

// Tool call arguments
export type FilesystemReadTextFileArgs = {
  path: string;
  head?: number;
};

export type FilesystemListDirectoryArgs = {
  path: string;
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
};

// Tool call results
export type FilesystemReadTextFileResult = {
  result: string;
};

export type FilesystemListDirectoryResult = {
  result: string;
};

export type FilesystemWriteFileResult = {
  result: string;
};

export type FilesystemEditFileResult = {
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
  | 'filesystem_list_directory'
  | 'filesystem_write_file'
  | 'filesystem_edit_file';

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

