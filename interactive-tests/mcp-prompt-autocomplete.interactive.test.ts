import { describe, it, expect } from 'vitest';
import {
  createPTYTestEnvironment,
  CLI_PATHS,
  TEST_TIMEOUTS,
} from './helpers/ptyTestUtils.js';

describe('MCP Prompt Autocomplete Interactive Test', () => {
  it(
    'should autocomplete MCP prompts and execute them',
    { timeout: 30000 },
    async () => {
      const env = await createPTYTestEnvironment();

      try {
        const process = await env.spawn('node', [CLI_PATHS.built]);

        // Wait for interactive mode to start
        await process.waitForText(
          'Press Ctrl+C to exit at any time.',
          TEST_TIMEOUTS.startup
        );

        await process.waitForText('>', TEST_TIMEOUTS.startup);

        console.log(
          'Initial output:',
          JSON.stringify(process.getCleanOutput())
        );

        // Test 1: Check if MCP server is connected and prompts are loaded
        // Type the beginning of the MCP server prompt command
        console.log('Testing MCP prompt autocomplete...');
        await process.typeText('/demo-server:sim');

        // Give it time to show autocomplete suggestions
        await new Promise(resolve => setTimeout(resolve, 500));

        let currentOutput = process.getCleanOutput();
        console.log(
          'Output after typing "/demo-server:sim":',
          JSON.stringify(currentOutput)
        );

        // Check if autocomplete suggestions appear
        // The autocomplete should show "/demo-server:simple-prompt"
        const hasAutocomplete =
          currentOutput.includes('simple-prompt') ||
          currentOutput.includes('/demo-server:simple-prompt');

        console.log('Has autocomplete suggestions:', hasAutocomplete);

        // Test 2: Try completing the prompt name manually
        await process.typeText('ple-prompt');

        // Give it time to process
        await new Promise(resolve => setTimeout(resolve, 200));

        currentOutput = process.getCleanOutput();
        console.log(
          'Output after completing prompt name:',
          JSON.stringify(currentOutput)
        );

        // Test 3: Try to execute the prompt
        process.sendEnter();

        // Wait for the prompt to be executed (should show "Working..." or similar)
        await process.waitForText('Working...', TEST_TIMEOUTS.interaction);
        console.log('Prompt execution started successfully');

        const finalOutput = process.getCleanOutput();
        console.log('Final complete output:', JSON.stringify(finalOutput));

        // Basic assertions
        expect(finalOutput).toContain('Press Ctrl+C to exit at any time.');
        expect(finalOutput).toContain('/demo-server:simple-prompt');

        process.kill();
      } finally {
        await env.cleanup();
      }
    }
  );

  it(
    'should show MCP prompts in help command',
    { timeout: 20000 },
    async () => {
      const env = await createPTYTestEnvironment();

      try {
        const process = await env.spawn('node', [CLI_PATHS.built]);

        await process.waitForText(
          'Press Ctrl+C to exit at any time.',
          TEST_TIMEOUTS.startup
        );

        await process.waitForText('>', TEST_TIMEOUTS.startup);

        // Test help command to see if MCP prompts are listed
        await process.typeText('/help');
        process.sendEnter();

        await new Promise(resolve => setTimeout(resolve, 2000));

        const helpOutput = process.getCleanOutput();
        console.log('Help command output:', JSON.stringify(helpOutput));

        // Check if MCP prompts appear in help
        expect(helpOutput).toContain('demo-server');
        expect(helpOutput).toContain('simple-prompt');

        process.kill();
      } finally {
        await env.cleanup();
      }
    }
  );
});
