import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { stripANSI } from 'bun';
import {
  createCliSession,
  launchCli,
  sendInput,
  sendTab,
  capturePane,
  wait,
  exitCli,
  killSession,
  sessionExists,
  type TmuxSession,
} from './helpers/tmux.js';

describe('Autocomplete Cursor Positioning', () => {
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

  it('should move cursor to end after slash command completion', async () => {
    // Type partial command
    sendInput(session, '/he');
    await wait(500);

    // Send Tab to complete
    sendTab(session);
    await wait(500);

    // Type additional text - it should appear at the end
    sendInput(session, 'extra');
    await wait(500);

    const output = capturePane(session);

    // The completed command should be "/help " with "extra" at the end
    expect(output).toContain('/help extra');
    // Should NOT have "extra" in the middle like "/heextrалp"
    expect(output).not.toMatch(/\/he.*extra.*lp/);
  });

  it('should move cursor to end after file mention completion', async () => {
    // Type partial file mention
    sendInput(session, '@REA');
    await wait(500);

    // Send Tab to complete
    sendTab(session);
    await wait(500);

    // Type additional text - it should appear at the end
    sendInput(session, ' more text');
    await wait(500);

    const output = capturePane(session);

    // Strip ANSI escape codes and normalize whitespace
    const cleanOutput = stripANSI(output).replace(/\s+/g, ' ');

    // The completed file mention should have "more text" at the end
    expect(cleanOutput).toContain('@README.md more text');
  });
});
