# Todo Tool Simplification

## Summary

Simplified the todo tools from 3 tools (`todo_add`, `todo_list`, `todo_update`) to 2 tools (`todo_write`, `todo_list`).

## Changes

### Tools
- **Removed**: `todo_add` - was used to add individual todo items
- **Removed**: `todo_update` - was used to update status of individual items by ID
- **Added**: `todo_write` - accepts full markdown todo list with statuses
- **Kept**: `todo_list` - returns the current todo list

### Markdown Format
The tools now use a simpler markdown format:
- `- [ ]` for pending tasks
- `- [~]` for in-progress tasks  
- `- [x]` for completed tasks

### Output Format
- Tool output is **only** the markdown todo list
- No extra newlines at the beginning
- No headings or descriptions
- Empty list returns empty string (not "*No todos*")

### Status Icons
Changed from Unicode symbols to standard markdown:
- Pending: `[ ]` (was `[ ]`)
- In Progress: `[~]` (was `[▶]`)
- Completed: `[x]` (was `[✓]`)

## Example Usage

```typescript
// Write a new todo list
await todoWrite.execute({ 
  todos: '- [ ] First task\n- [~] In progress\n- [x] Done' 
});

// List current todos
const result = await todoList.execute({});
// Returns: "- [ ] First task\n- [~] In progress\n- [x] Done"
```

## Benefits

1. **Simpler API**: Only 2 tools instead of 3
2. **No ID management**: No need to track or pass UUIDs
3. **Atomic updates**: Entire list is replaced, avoiding sync issues
4. **Cleaner output**: Just the markdown list, no extra formatting
5. **Easier to understand**: Standard markdown checkbox format
