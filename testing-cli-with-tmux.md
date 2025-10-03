# Testing the CLI with tmux

## Overview

The MCP tmux tools provide an effective way to test the interactive CLI by creating tmux sessions, sending commands, and capturing output.

## Key Learnings

### Creating and Launching

```typescript
// Create a new tmux session
mcp__tmux__create-session({ name: "envoy-test" })

// List windows and panes to get IDs
mcp__tmux__list-windows({ sessionId: "$11" })
mcp__tmux__list-panes({ windowId: "@12" })

// Launch CLI in the pane with rawMode for interactive apps
mcp__tmux__execute-command({
  paneId: "%15",
  command: "npx .",
  rawMode: true  // Required for TUI apps - disables command wrapper
})
```

### Sending Input

```typescript
// Send text input without pressing Enter
mcp__tmux__execute-command({
  paneId: "%15",
  command: "hello",
  noEnter: true
})

// Send Enter key to submit
mcp__tmux__execute-command({
  paneId: "%15",
  command: "Enter",
  noEnter: true
})
```

### Sending Control Keys

The MCP tmux tools don't properly send control characters like Ctrl+C. Use bash `tmux send-keys` instead:

```bash
# Single Ctrl+C
tmux send-keys -t %15 C-c

# Multiple keys in sequence (needed for exit confirmation)
tmux send-keys -t %15 C-c && sleep 0.5 && tmux send-keys -t %15 C-c
```

### Capturing Output

```typescript
// Capture pane content to verify CLI state
mcp__tmux__capture-pane({
  paneId: "%15",
  lines: 50
})
```

## CLI Exit Behavior

The CLI requires two Ctrl+C presses within 3 seconds to exit (src/tui/components/TUIApp.tsx:111-123):
- First Ctrl+C: Starts 3-second confirmation timer
- Second Ctrl+C within 3 seconds: Exits immediately

## Best Practices

1. Always use `rawMode: true` when launching interactive TUI applications
2. Use `capture-pane` after commands to verify state
3. Use bash `tmux send-keys` for control characters (C-c, C-d, etc.)
4. Add small delays between sequential control key presses when needed
5. Clean up input field with `C-u` before sending control sequences if needed
