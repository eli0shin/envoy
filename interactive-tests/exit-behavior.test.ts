import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  createCliSession,
  launchCli,
  sendControlKey,
  capturePane,
  wait,
  killSession,
  sessionExists,
  type TmuxSession,
} from './helpers/tmux.js';

describe('CLI Exit Behavior', () => {
  let session: TmuxSession;

  beforeEach(async () => {
    session = await createCliSession();
    launchCli(session);
    await wait(10000);
  });

  afterEach(() => {
    if (sessionExists(session)) {
      killSession(session);
    }
  });

  it('should show exit confirmation on first Ctrl+C', async () => {
    sendControlKey(session, 'C-c');

    // Give it a moment to update
    await new Promise((resolve) => setTimeout(resolve, 200));

    const output = capturePane(session);
    // The CLI should still be running, just showing confirmation state
    expect(output).toContain('Type your message');
  });

  it('should exit on second Ctrl+C within 3 seconds', async () => {
    sendControlKey(session, 'C-c');
    await new Promise((resolve) => setTimeout(resolve, 100));
    sendControlKey(session, 'C-c');

    // Wait for exit
    await new Promise((resolve) => setTimeout(resolve, 500));

    const output = capturePane(session);
    // Should be back at shell prompt (no longer showing CLI UI)
    expect(output).not.toContain('Type your message');
  });

  it('should reset confirmation if second Ctrl+C is after 3 seconds', async () => {
    sendControlKey(session, 'C-c');

    // Wait longer than 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3500));

    sendControlKey(session, 'C-c');
    await new Promise((resolve) => setTimeout(resolve, 200));

    const output = capturePane(session);
    // Should still be in CLI (first Ctrl+C again)
    expect(output).toContain('Type your message');
  });
});
