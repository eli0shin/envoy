import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createCliSession,
  launchCli,
  sendInput,
  submitInput,
  capturePane,
  wait,
  exitCli,
  killSession,
  sessionExists,
  type TmuxSession,
} from './helpers/tmux.js';

describe('Todo List Functionality', () => {
  let session: TmuxSession;

  beforeEach(async () => {
    session = await createCliSession();
    launchCli(session);
    // Wait for CLI to be ready
    await wait(10000);
  });

  afterEach(async () => {
    await exitCli(session);
    if (sessionExists(session)) {
      killSession(session);
    }
  });

  it('should display todos with correct status icons', async () => {
    // Send prompt to create 3 todos with different statuses
    sendInput(
      session,
      'create a todo list with these items: pending task (pending), active task (in progress), and done task (completed)'
    );
    submitInput(session);

    // Wait for response
    await wait(10000);

    const output = capturePane(session, 100);

    // Assert that todo items are displayed with correct icons
    expect(output).toContain('☐'); // pending icon
    expect(output).toContain('◐'); // in-progress icon
    expect(output).toContain('☑'); // completed icon

    // Assert that task names appear
    expect(output).toContain('pending task');
    expect(output).toContain('active task');
    expect(output).toContain('done task');
  }, 25000);
});
