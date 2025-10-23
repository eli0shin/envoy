import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  createCliSession,
  launchCli,
  sendInput,
  submitInput,
  sendNewline,
  capturePane,
  wait,
  exitCli,
  killSession,
  sessionExists,
  type TmuxSession,
} from './helpers/tmux.js';

describe('CLI Basic Functionality', () => {
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

  it('should launch and display the input prompt', async () => {
    const output = capturePane(session);
    expect(output).toContain('Type your message');
    expect(output).toContain('Ready');
  });

  it('should respond to a simple message', async () => {
    sendInput(session, 'hello');
    submitInput(session);

    // Wait for response
    await wait(10000);

    const output = capturePane(session);
    expect(output).toContain('hello');
  }, 20000);

  it('should handle multiline input with Shift+Enter', async () => {
    sendInput(session, 'line 1');
    sendNewline(session);
    sendInput(session, 'line 2');

    await wait(500);

    const output = capturePane(session);
    expect(output).toContain('line 1');
    expect(output).toContain('line 2');
  });
});
