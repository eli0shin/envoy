# Todo List Tool Implementation Design

## Overview

This document outlines the design for implementing a todo list tool as an MCP server for the CLI AI Agent. The todo list will help agents track and manage multi-step tasks, improving organization and ensuring all requested work is completed.

## Architecture Decision

**Implementation: MCP Server** (similar to `agentSpawnerServer.ts`)

Rationale:

- Maintains consistency with existing tool architecture
- Leverages established MCP infrastructure (schema validation, error handling)
- Provides clean separation of concerns
- Enables proper session lifecycle management

## Core Design Principles

1. **Order-based organization**: Items maintain insertion order, no priority system
2. **Full list returns**: Every operation returns the complete todo list for consistency
3. **Session coupling**: Todo lists are tied to agent sessions and cleared appropriately
4. **Dual format output**: JSON internally, Markdown for human readability
5. **Hidden timestamps**: Log creation/completion times to files but not exposed in API

## Schema Design

```typescript
// Internal representation
type TodoItem = {
  id: string; // UUID for unique identification
  content: string; // Task description
  status: 'pending' | 'in_progress' | 'completed';
  order: number; // Explicit order field for sorting
};

type TodoList = {
  sessionId: string; // Links to agent session
  items: TodoItem[]; // Ordered array of todos
  lastModified: Date; // For cleanup purposes
};

// API response format
type TodoResponse = {
  success: boolean;
  todos: Array<{
    id: string;
    content: string;
    status: string;
  }>;
  error?: string;
};
```

## Tool Operations

### 1. `todo_add`

- **Parameters**: `{ content: string }`
- **Behavior**: Adds new todo at end of list with 'pending' status
- **Returns**: Full todo list

### 2. `todo_list`

- **Parameters**: None
- **Behavior**: Returns current todo list
- **Returns**: Full todo list

### 3. `todo_update`

- **Parameters**: `{ id: string, status: 'pending' | 'in_progress' | 'completed' }`
- **Behavior**: Updates status of specified todo
- **Returns**: Full todo list

### 4. `todo_remove`

- **Parameters**: `{ id: string }`
- **Behavior**: Removes specified todo
- **Returns**: Full todo list

### 5. `todo_clear`

- **Parameters**: None
- **Behavior**: Removes all todos
- **Returns**: Empty todo list

### 6. `todo_reorder`

- **Parameters**: `{ id: string, newPosition: number }`
- **Behavior**: Moves todo to new position (0-indexed)
- **Returns**: Full todo list

## Session Management

### Storage Strategy

- In-memory Map: `Map<sessionId, TodoList>`
- Session ID obtained from environment variable `AGENT_SESSION_ID`
- Automatic cleanup of stale sessions (> 24 hours)

### Lifecycle Integration

- Create new todo list on first access per session
- Persist across messages within same session
- Clear on `/clear` command in interactive mode
- Clean up on session termination

## Output Formatting

### Human-Readable Format (Markdown)

```
## Todo List

1. [✓] Completed task description
2. [▶] In-progress task description
3. [ ] Pending task description
```

### JSON Format (for `--json` mode)

```json
{
  "todos": [
    { "id": "uuid-1", "content": "Completed task", "status": "completed" },
    { "id": "uuid-2", "content": "In-progress task", "status": "in_progress" },
    { "id": "uuid-3", "content": "Pending task", "status": "pending" }
  ]
}
```

## Logging Strategy

### Visible Logs

- Use `[todo-list]` prefix for consistency with existing output
- Respect `--log-progress` settings
- Brief operation confirmations (e.g., "Added todo: <content>")

### Hidden Timestamp Logs

- Log to `~/.local/share/envoy/todos/<sessionId>.jsonl`
- Include operation type, timestamp, before/after state
- Format: JSONL for easy parsing
- Example entry:

```json
{"timestamp":"2024-01-15T10:30:00Z","operation":"add","todoId":"uuid-1","content":"Task description"}
{"timestamp":"2024-01-15T10:35:00Z","operation":"update","todoId":"uuid-1","oldStatus":"pending","newStatus":"in_progress"}
```

## Integration Points

### 1. Interactive Mode

- Hook into `/clear` command to reset todos
- Display todo count in prompt or status line (optional)

### 2. Logger Integration

- Use existing logger for `[todo-list]` prefixed output
- Leverage session ID from logger
- Respect log level and progress settings

### 3. MCP Infrastructure

- Register as MCP server in `constants.ts`
- Use existing MCP loader patterns
- Implement standard MCP tool interface

## Implementation Plan

### Phase 1: Core MCP Server

1. Create `src/todoServer.ts` with basic MCP server setup
2. Implement in-memory storage with session management
3. Add core CRUD operations (add, list, update, remove)

### Phase 2: Enhanced Operations

1. Add reorder functionality
2. Implement clear operation
3. Add session cleanup logic

### Phase 3: Output Formatting

1. Implement Markdown formatter for human output
2. Add JSON output support
3. Integrate with logger for proper prefixing

### Phase 4: Integration

1. Register server in `constants.ts`
2. Add environment variable passing for session ID
3. Test with interactive mode
4. Add `/clear` hook for todo reset

### Phase 5: Logging

1. Implement timestamp logging to files
2. Add JSONL formatter
3. Ensure proper error handling for file operations

## Error Handling

- Invalid session ID: Create new session
- Todo not found: Return error with current list
- Invalid status: Return error with valid options
- Storage full: Implement LRU eviction for old sessions

## Testing Strategy

1. Unit tests for todo operations
2. Integration tests with MCP client
3. E2E tests in interactive mode
4. Session lifecycle tests
5. Error condition tests

## Future Enhancements

- Todo templates for common workflows
- Bulk operations (mark multiple as complete)
- Export/import functionality
- Todo dependencies (blocked by another todo)
- Time estimates and tracking
