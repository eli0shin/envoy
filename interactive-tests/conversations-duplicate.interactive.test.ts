/**
 * Interactive test to reproduce the /conversations command duplicate message issue
 */

import { describe, it, expect } from 'vitest';
import { createPTYTestEnvironment, CLI_PATHS } from './helpers/ptyTestUtils.js';

describe('Conversations Command Duplicate Messages', () => {
  it(
    'should not show duplicate messages when running /conversations command once',
    { timeout: 60000 },
    async () => {
      const env = await createPTYTestEnvironment();

      try {
        // Spawn CLI with PTY and debug logging
        const process = await env.spawn('node', [CLI_PATHS.built]);

        // Wait for interactive mode to start
        await process.waitForText('Press Ctrl+C to exit at any time.', 10000);

        // Wait for prompt to appear
        await process.waitForText('>', 5000);

        // Send /conversations command ONCE
        await process.typeText('/conversations');
        process.sendEnter();

        // Wait for response to appear
        await new Promise(resolve => setTimeout(resolve, 8000));

        // Get final output and analyze
        const finalOutput = process.getCleanOutput();

        // Count how many times conversation response appears
        const conversationMatches = (
          finalOutput.match(
            /Recent conversations|No conversation sessions found/g
          ) || []
        ).length;

        // For debugging, don't fail the test yet
        expect(conversationMatches).toBe(1);

        // Clean exit
        await process.typeText('/exit');
        process.sendEnter();
        process.kill();
      } finally {
        await env.cleanup();
      }
    }
  );
});
