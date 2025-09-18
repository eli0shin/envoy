# Tool Formatter Implementation Plan

## Overview

This document outlines the implementation plan for creating formatters for the remaining MCP tools that currently use the DefaultToolMessage component.

## Formatters to Implement

### 1. CreateDirectoryToolMessage

**Tool:** `filesystem_create_directory`

- **Display Name:** "Create Directory"
- **Arguments Display:**
  - Show `path` value without argument name label
  - Example: `/path/to/directory`
- **Result Display:**
  - Use `result.result` exactly as-is without truncation
  - Example output: "Successfully created directory test-temp-dir"

### 2. MoveFileToolMessage

**Tool:** `filesystem_move_file`

- **Display Name:** "Move File"
- **Arguments Display:**
  - Show `source` → `destination` without argument name labels
  - Use arrow to indicate movement direction
  - Example: `/old/path` → `/new/path`
- **Result Display:**
  - Use `result.result` exactly as-is without truncation
  - Example output: "Successfully moved test-temp-dir to test-temp-renamed"

### 3. SearchFilesToolMessage

**Tool:** `filesystem_search_files`

- **Display Name:** "Search Files"
- **Arguments Display:**
  - Show `path` and `pattern` values without argument name labels
  - Example: `/src` `*.tsx`
- **Result Display:**
  - Count the number of lines in the output
  - Show: "Found n results"
  - Example: "Found 24 results"

### 4. BashToolMessage

**Tool:** `shell_run_command`

- **Display Name:** "Bash" (not "Shell Run Command")
- **Arguments Display:**
  - Show `command` value without argument name label
  - Example: `npm run build`
- **Result Display:**
  - Show only the last 20 lines of command output
  - If output has fewer than 20 lines, show all lines
  - Preserve output formatting

### 5. WebSearchToolMessage

**Tool:** `brave-search_brave_web_search`

- **Display Name:** "Web Search" (not "Brave Search")
- **Arguments Display:**
  - Show `query` value without argument name label
  - Example: `TypeScript formatter`
- **Result Display:**
  - Count results by splitting on double newlines (empty lines between results)
  - Show: "Found n results"
  - Example: "Found 3 results"

## Implementation Guidelines

### Component Structure

Each formatter should follow the existing pattern:

1. Import necessary types and theme
2. Parse arguments and results safely
3. Format display according to specifications above
4. Use theme colors consistently
5. Handle errors gracefully with fallback to DefaultToolMessage

### Theme Usage

- Tool names: `theme.toolName`
- Arguments: `theme.muted` or appropriate semantic color
- Results: `theme.text` for normal output, `theme.success` for success messages
- Counts/Statistics: `theme.info`

### Registry Updates

After implementing each formatter:

1. Import the new component in `registry.tsx`
2. Add entry to `toolRegistry` object
3. Map the MCP tool name to the formatter component
4. Use appropriate display name as specified above

## Testing Checklist

- [ ] Each formatter renders without errors
- [ ] Arguments display correctly without labels where specified
- [ ] Results display according to specifications
- [ ] Error cases handled gracefully
- [ ] Theme colors applied consistently
- [ ] Line counting works correctly for SearchFiles and WebSearch
- [ ] Output truncation works for Bash (last 20 lines)
- [ ] Arrow formatting works for MoveFile

## Priority Order

1. BashToolMessage - Most commonly used
2. SearchFilesToolMessage - Frequently used for code navigation
3. WebSearchToolMessage - Common for research tasks
4. CreateDirectoryToolMessage - File operations
5. MoveFileToolMessage - File operations
