# Tool Message Formatter Design

## Overview

This document outlines the design for a flexible, component-based tool message formatting system that allows complete customization of how different tool calls and their results are displayed in the TUI.

## Problem Statement

The current tool message rendering system uses a one-size-fits-all approach that:
- Shows all tool arguments regardless of relevance
- Displays results uniformly across all tool types
- Cannot customize layout or styling per tool type
- Makes it difficult to create rich UI experiences for specific tools

### Requirements

1. **UI Customization**: Full control over how each tool's messages are rendered
2. **Selective Display**: Ability to filter which arguments are shown
3. **Custom Result Rendering**: Different tools need different result presentations:
   - File reads: Omit result for successful operations
   - File edits: Show diff views
   - Bash commands: Truncate output to 5 lines
   - Todo updates: Render full markdown formatting
4. **Tool Renaming**: Display user-friendly names instead of internal tool IDs
5. **Backwards Compatibility**: Maintain support for unknown/new tools
6. **Integration**: Work seamlessly with existing Message/MessageList components

## Architecture

### Component Structure

```
src/tui/
├── components/
│   ├── Message.tsx          (modified to support tool components)
│   └── MessageList.tsx      (modified to pass tool data)
└── toolFormatters/
    ├── index.ts             (main exports)
    ├── types.ts             (type definitions)
    ├── registry.tsx         (tool component registry)
    └── components/
        ├── DefaultToolMessage.tsx
        ├── EditToolMessage.tsx
        ├── ReadToolMessage.tsx
        ├── BashToolMessage.tsx
        ├── TodoToolMessage.tsx
        └── ... (more tool-specific components)
```

### Core Types

```typescript
// toolFormatters/types.ts

export type ToolMessageComponentProps = {
  toolName: string;           // Original tool identifier
  displayName?: string;       // User-friendly display name
  args: unknown;             // Tool arguments
  result?: unknown;          // Tool execution result
  isError?: boolean;         // Whether the result is an error
  width: number;             // Available width for rendering
};

export type ToolConfig = {
  displayName?: string;
  component: React.FC<ToolMessageComponentProps>;
  // Future extensions:
  // icon?: string;
  // collapsible?: boolean;
  // showTimestamp?: boolean;
};

export type ToolRegistry = Record<string, ToolConfig>;
```

### Registry System

```typescript
// toolFormatters/registry.tsx

import { DefaultToolMessage } from './components/DefaultToolMessage';
import { EditToolMessage } from './components/EditToolMessage';
import { ReadToolMessage } from './components/ReadToolMessage';
import { BashToolMessage } from './components/BashToolMessage';
import { TodoToolMessage } from './components/TodoToolMessage';
import { GrepToolMessage } from './components/GrepToolMessage';
import { WebFetchToolMessage } from './components/WebFetchToolMessage';
import type { ToolRegistry, ToolConfig } from './types';

export const toolRegistry: ToolRegistry = {
  // File operations
  'edit': {
    displayName: 'Edit File',
    component: EditToolMessage
  },
  'multi_edit': {
    displayName: 'Multi-Edit File',
    component: EditToolMessage  // Can reuse same component
  },
  'read': {
    displayName: 'Read File',
    component: ReadToolMessage
  },
  'write': {
    displayName: 'Write File',
    component: EditToolMessage  // Shows diff for new files
  },

  // Command execution
  'bash': {
    displayName: 'Run Command',
    component: BashToolMessage
  },
  'bash_output': {
    displayName: 'Check Output',
    component: BashToolMessage
  },

  // Search operations
  'grep': {
    displayName: 'Search Files',
    component: GrepToolMessage
  },
  'glob': {
    displayName: 'Find Files',
    component: GrepToolMessage
  },

  // Task management
  'todo_write': {
    displayName: 'Update Todos',
    component: TodoToolMessage
  },

  // Web operations
  'web_fetch': {
    displayName: 'Fetch URL',
    component: WebFetchToolMessage
  },
  'web_search': {
    displayName: 'Web Search',
    component: WebFetchToolMessage
  }
};

// Get tool configuration with fallback to default
export function getToolConfig(toolName: string): ToolConfig {
  return toolRegistry[toolName] || {
    component: DefaultToolMessage,
    displayName: formatToolName(toolName) // Convert snake_case to Title Case
  };
}

// Helper to convert snake_case to Title Case
function formatToolName(toolName: string): string {
  return toolName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

### Integration with Existing Components

#### Modified Message.tsx

```typescript
// components/Message.tsx

import { getToolConfig } from '../toolFormatters/registry';
import type { CoreMessage } from 'ai';

type MessageProps = {
  message: CoreMessage & { toolData?: any };
  contentType?: 'normal' | 'reasoning' | 'tool';
  width: number;
  key: string;
};

export function Message({ message, contentType, width }: MessageProps) {
  // NEW: Handle tool messages with custom components
  if (contentType === 'tool' && message.toolData) {
    const { toolName, args, result, isError } = message.toolData;
    const config = getToolConfig(toolName);
    const ToolComponent = config.component;

    return (
      <box
        padding={0}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={formatBackground(message.role)}
        width={width - 4}
      >
        <ToolComponent
          toolName={toolName}
          displayName={config.displayName}
          args={args}
          result={result}
          isError={isError}
          width={width}
        />
      </box>
    );
  }

  // Existing message rendering for non-tool messages
  const displayContent = getDisplayContent(message);
  const wrappedContent = wrapText(displayContent, textWidth);
  const styledContent = formatContent(
    message.role,
    contentType,
    wrappedContent
  );

  return (
    <box
      padding={contentType === 'tool' ? 0 : 1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={formatBackground(message.role)}
      width={width - 4}
    >
      <text style={{ width: textWidth, flexWrap: 'wrap' }}>
        {styledContent}
      </text>
    </box>
  );
}
```

#### Modified MessageList.tsx

```typescript
// components/MessageList.tsx

const renderMessage = (
  message: CoreMessage & { id: string },
  messageIndex: number,
  allMessages: (CoreMessage & { id: string })[],
  consumedMessageIndices: Set<number>
) => {
  // ... existing code ...

  else if (part?.type === 'tool-call' && 'toolName' in part) {
    // Look ahead for matching tool result (existing logic)
    let matchingResult = null;
    // ... matching logic ...

    // NEW: Pass raw tool data instead of formatting to string
    const partMessage: CoreMessage & { toolData?: any } = {
      role: 'assistant',
      content: '', // Empty since component will render
      toolData: {
        toolName: part.toolName,
        args: part.args,
        result: matchingResult?.result,
        isError: matchingResult?.isError
      }
    };

    parts.push(
      <Message
        key={`${message.id}-part-${partIndex}`}
        message={partMessage}
        contentType="tool"
        width={width}
      />
    );
  }

  // ... rest of existing code ...
};
```

## Component Examples

### Default Tool Message

```typescript
// toolFormatters/components/DefaultToolMessage.tsx

import { formatToolName, formatToolArgs, truncateValue } from '../../utils/toolFormatting';
import { parseMarkdown } from '../../utils/markdown';
import type { ToolMessageComponentProps } from '../types';

export function DefaultToolMessage({
  toolName,
  displayName,
  args,
  result,
  isError,
  width
}: ToolMessageComponentProps) {
  const formattedArgs = formatToolArgs(args);

  return (
    <box flexDirection="column" width={width - 4}>
      {/* Tool name and args */}
      <text>
        {parseMarkdown(`**${displayName || formatToolName(toolName)}**${
          formattedArgs ? ` (${formattedArgs})` : ''
        }`)}
      </text>

      {/* Result */}
      {result && (
        <text paddingLeft={2} color={isError ? 'red' : 'green'}>
          └ {isError ? 'Error' : 'Result'}: {truncateValue(String(result))}
        </text>
      )}
    </box>
  );
}
```

### Edit Tool Message

```typescript
// toolFormatters/components/EditToolMessage.tsx

import { basename } from 'path';
import { DiffView } from '../DiffView';
import type { ToolMessageComponentProps } from '../types';

export function EditToolMessage({
  displayName,
  args,
  result,
  isError,
  width
}: ToolMessageComponentProps) {
  const { file_path, old_string, new_string } = args as {
    file_path: string;
    old_string: string;
    new_string: string;
  };

  const oldLines = old_string.split('\n').length;
  const newLines = new_string.split('\n').length;
  const lineChange = newLines - oldLines;

  return (
    <box flexDirection="column" width={width - 4}>
      {/* Header with file name */}
      <text bold>
        ✏️ {displayName || 'Edit'}: {basename(file_path)}
      </text>

      {/* Line count change */}
      <text dim paddingLeft={2}>
        {oldLines} → {newLines} lines
        {lineChange !== 0 && ` (${lineChange > 0 ? '+' : ''}${lineChange})`}
      </text>

      {/* Diff view for successful edits */}
      {result && !isError && (
        <box paddingTop={1}>
          <DiffView
            oldText={old_string}
            newText={new_string}
            width={width - 6}
            maxLines={10}
          />
        </box>
      )}

      {/* Error message */}
      {isError && (
        <text color="red" paddingLeft={2}>
          ❌ {String(result)}
        </text>
      )}
    </box>
  );
}
```

### Read Tool Message

```typescript
// toolFormatters/components/ReadToolMessage.tsx

import { basename } from 'path';
import type { ToolMessageComponentProps } from '../types';

export function ReadToolMessage({
  displayName,
  args,
  result,
  isError,
  width
}: ToolMessageComponentProps) {
  const { file_path, offset, limit } = args as {
    file_path: string;
    offset?: number;
    limit?: number;
  };

  return (
    <box flexDirection="column" width={width - 4}>
      {/* Header */}
      <text bold>
        📖 {displayName || 'Read'}: {basename(file_path)}
      </text>

      {/* Show range if partial read */}
      {(offset || limit) && (
        <text dim paddingLeft={2}>
          Lines {offset || 1} - {limit ? (offset || 0) + limit : 'end'}
        </text>
      )}

      {/* Success - just confirm file was read, don't show content */}
      {!isError && result && (
        <text dim paddingLeft={2}>
          ✓ File loaded
        </text>
      )}

      {/* Error */}
      {isError && (
        <text color="red" paddingLeft={2}>
          ❌ {String(result)}
        </text>
      )}
    </box>
  );
}
```

### Bash Tool Message

```typescript
// toolFormatters/components/BashToolMessage.tsx

import type { ToolMessageComponentProps } from '../types';

const MAX_OUTPUT_LINES = 5;

export function BashToolMessage({
  args,
  result,
  isError,
  width
}: ToolMessageComponentProps) {
  const { command, timeout, run_in_background } = args as {
    command: string;
    timeout?: number;
    run_in_background?: boolean;
  };

  const outputLines = result ? String(result).split('\n') : [];
  const truncated = outputLines.length > MAX_OUTPUT_LINES;
  const displayLines = truncated
    ? outputLines.slice(0, MAX_OUTPUT_LINES)
    : outputLines;

  return (
    <box flexDirection="column" width={width - 4}>
      {/* Command */}
      <text bold color="cyan">
        $ {command}
      </text>

      {/* Background/timeout info */}
      {(run_in_background || timeout) && (
        <text dim paddingLeft={2}>
          {run_in_background && '🔄 Background'}
          {timeout && ` ⏱️ ${timeout}ms timeout`}
        </text>
      )}

      {/* Output */}
      {result && (
        <box paddingLeft={2} paddingTop={1}>
          <text color={isError ? 'red' : 'gray'}>
            {displayLines.join('\n')}
            {truncated && `\n... (${outputLines.length - MAX_OUTPUT_LINES} more lines)`}
          </text>
        </box>
      )}
    </box>
  );
}
```

### Todo Tool Message

```typescript
// toolFormatters/components/TodoToolMessage.tsx

import { parseMarkdown } from '../../utils/markdown';
import type { ToolMessageComponentProps } from '../types';

type Todo = {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
};

export function TodoToolMessage({
  args,
  width
}: ToolMessageComponentProps) {
  const { todos } = args as { todos: Todo[] };

  // Group todos by status
  const grouped = {
    in_progress: todos.filter(t => t.status === 'in_progress'),
    pending: todos.filter(t => t.status === 'pending'),
    completed: todos.filter(t => t.status === 'completed')
  };

  // Build markdown formatted list
  const sections = [];

  if (grouped.in_progress.length > 0) {
    sections.push('**🔄 In Progress**');
    grouped.in_progress.forEach(todo => {
      sections.push(`  • ${todo.activeForm || todo.content}`);
    });
  }

  if (grouped.pending.length > 0) {
    sections.push('**⏳ Pending**');
    grouped.pending.forEach(todo => {
      sections.push(`  • ${todo.content}`);
    });
  }

  if (grouped.completed.length > 0) {
    sections.push('**✅ Completed**');
    grouped.completed.forEach(todo => {
      sections.push(`  • ~~${todo.content}~~`);
    });
  }

  const markdown = sections.join('\n');

  return (
    <box flexDirection="column" width={width - 4}>
      <text bold>📝 Todo List Updated</text>
      <box paddingLeft={2} paddingTop={1}>
        {parseMarkdown(markdown)}
      </box>
    </box>
  );
}
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create toolFormatters directory structure
2. Define types in types.ts
3. Implement registry system
4. Create DefaultToolMessage component

### Phase 2: Integration
1. Modify Message.tsx to support tool components
2. Update MessageList.tsx to pass tool data
3. Test with DefaultToolMessage

### Phase 3: Tool-Specific Components
1. Implement EditToolMessage with diff view
2. Implement ReadToolMessage with success confirmation
3. Implement BashToolMessage with output truncation
4. Implement TodoToolMessage with markdown rendering
5. Add more tool components as needed

### Phase 4: Enhancements
1. Add configuration options (icons, colors, etc.)
2. Implement collapsible sections for long output
3. Add timestamp display options
4. Create tool grouping/categorization

## Benefits

1. **Flexibility**: Each tool can have completely custom UI
2. **Maintainability**: Tool-specific logic isolated in components
3. **Extensibility**: Easy to add new tool formatters
4. **User Experience**: Rich, tool-appropriate displays
5. **Performance**: Only render what's needed for each tool
6. **Consistency**: Shared components for common patterns

## Migration Strategy

1. Implement new system alongside existing
2. Gradually migrate tools to custom components
3. Maintain DefaultToolMessage for backwards compatibility
4. Remove old formatting system once all tools migrated

## Future Enhancements

1. **Tool Aliases**: Multiple names mapping to same tool
2. **User Preferences**: Allow users to customize tool display
3. **Themes**: Different visual styles for tool messages
4. **Interactive Elements**: Collapsible sections, copy buttons
5. **Tool Grouping**: Visual grouping of related tool calls
6. **Execution Status**: Show pending/running/complete states
7. **Performance Metrics**: Display execution time, resource usage