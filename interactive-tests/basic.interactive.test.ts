import { describe, it, expect } from 'vitest';
import {
  createPTYTestEnvironment,
  CLI_PATHS,
  TEST_TIMEOUTS,
} from './helpers/ptyTestUtils.js';

describe('PTY Interactive Test', () => {
  it(
    'should start interactive mode with TTY support',
    { timeout: 20000 },
    async () => {
      const env = await createPTYTestEnvironment();

      try {
        const process = await env.spawn('node', [CLI_PATHS.built]);

        await process.waitForText(
          'Press Ctrl+C to exit at any time.',
          TEST_TIMEOUTS.startup
        );

        const output = process.getCleanOutput();

        expect(output).toContain('Press Ctrl+C to exit at any time.');
        expect(output).toContain('>');

        process.kill();
      } finally {
        await env.cleanup();
      }
    }
  );
});
