# Interactive CLI Tests with tmux

This directory contains interactive tests for the CLI using tmux to control and observe the TUI.

## Setup

The tests use tmux to create isolated sessions where the CLI can be launched and controlled programmatically.

### Requirements

- tmux must be installed
- Tests run with Vitest

## Utilities

The `helpers/tmux.ts` module provides utilities for controlling tmux sessions:

### Session Management

```typescript
import { createCliSession, launchCli, killSession } from './helpers/tmux.js';

// Create a new tmux session
const session = await createCliSession('my-test-session');

// Launch the CLI in the session
launchCli(session);

// Clean up when done
killSession(session);
```

### Sending Input

```typescript
import { sendInput, submitInput, sendControlKey } from './helpers/tmux.js';

// Type text (without submitting)
sendInput(session, 'hello world');

// Press Enter to submit
submitInput(session);

// Send control keys
sendControlKey(session, 'C-c'); // Single Ctrl+C
sendControlKey(session, 'C-c', 2); // Two Ctrl+C presses
sendControlKey(session, 'escape'); // Escape key
```

### Capturing Output

```typescript
import { capturePane, waitForText } from './helpers/tmux.js';

// Get current pane content
const output = capturePane(session);

// Wait for specific text to appear (with timeout)
const found = await waitForText(session, 'Expected text', {
  timeout: 5000,
  interval: 100,
});
```

### Exiting the CLI

```typescript
import { exitCli } from './helpers/tmux.js';

// Exit the CLI gracefully (double Ctrl+C)
await exitCli(session);
```

## Writing Tests

Use Vitest's standard test structure with beforeEach/afterEach hooks:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createCliSession,
  launchCli,
  sendInput,
  submitInput,
  waitForText,
  exitCli,
  killSession,
  type TmuxSession,
} from './helpers/tmux.js';

describe('My Test Suite', () => {
  let session: TmuxSession;

  beforeEach(async () => {
    session = await createCliSession();
    launchCli(session);
    await waitForText(session, 'Type your message');
  });

  afterEach(async () => {
    await exitCli(session);
    killSession(session);
  });

  it('should do something', async () => {
    sendInput(session, 'test input');
    submitInput(session);

    const found = await waitForText(session, 'expected response');
    expect(found).toBe(true);
  });
});
```

## Running Tests

```bash
bun run test interactive-tests/
```

## Key Differences from node-pty Tests

- Uses real tmux sessions instead of pseudo-terminals
- Can manually inspect sessions by attaching: `tmux attach -t <session-name>`
- More reliable for testing full TUI interactions
- Easier to debug by viewing actual tmux panes
