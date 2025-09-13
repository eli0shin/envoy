import { describe, it, expect } from 'vitest';
import {
  createPTYTestEnvironment,
  CLI_PATHS,
  TEST_TIMEOUTS,
} from './helpers/ptyTestUtils.js';

describe('PTY Input/Output Test', () => {
  it(
    'should handle user input and respond interactively',
    { timeout: 30000 },
    async () => {
      const env = await createPTYTestEnvironment();

      try {
        const process = await env.spawn('node', [CLI_PATHS.built]);

        await process.waitForText(
          'Press Ctrl+C to exit at any time.',
          TEST_TIMEOUTS.startup
        );

        await process.waitForText('>', TEST_TIMEOUTS.startup);


        await process.typeText('what is 2+2?');
        process.sendEnter();

        await process.waitForText('Working...', TEST_TIMEOUTS.response);

        const finalOutput = process.getCleanOutput();

        expect(finalOutput).toContain('Press Ctrl+C to exit at any time.');
        expect(finalOutput).toContain('what is 2+2?');
        expect(finalOutput).toContain('Working...');

        process.kill();
      } finally {
        await env.cleanup();
      }
    }
  );
});
