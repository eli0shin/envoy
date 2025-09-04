import { describe, it, expect } from 'vitest';
import {
  createPTYTestEnvironment,
  CLI_PATHS,
  TEST_TIMEOUTS,
} from './helpers/ptyTestUtils.js';

describe('Interactive Tool Call Test', () => {
  it(
    'should trigger tool call and handle subsequent user messages',
    { timeout: 150000 }, // Increased timeout for extended agent processing
    async () => {
      const env = await createPTYTestEnvironment();

      try {
        // Spawn CLI with PTY
        const process = await env.spawn('node', [CLI_PATHS.built]);

        // Wait for interactive mode to start
        await process.waitForText(
          'Press Ctrl+C to exit at any time.',
          TEST_TIMEOUTS.startup
        );

        // Wait for prompt to appear
        await process.waitForText('>', TEST_TIMEOUTS.startup);

        // Send user input that should trigger a tool call (using todo list tool)
        await process.typeText('think about this and add a task: test task');
        process.sendEnter();

        // Wait for the working indicator to appear (indicates tool execution)
        await process.waitForText('Working...', TEST_TIMEOUTS.response);

        // Wait for assistant response to appear (thinking might take longer)
        await process.waitForText('🤖', 60000); // 60 second timeout for thinking

        await process.waitForText('🔧 todo-list_todo_add', 60000);

        // Wait for assistant response and prompt to return
        await process.waitForText('>', TEST_TIMEOUTS.interaction);

        // Send a follow-up message to test if subsequent messages work
        await process.typeText('think about this - what is 2+2?');
        process.sendEnter();

        await process.waitForText('👤 think about this - what is 2+2?');

        // Wait for second agent response to appear with extended timeout
        try {
          await process.waitForText('🤖', 60000); // 60 second timeout for second response
          // Wait for the response to complete
          await new Promise(resolve => setTimeout(resolve, 10000));
        } catch (_error) {
          void _error;
          console.log(
            'Timeout waiting for second agent response, proceeding with test...'
          );
        }

        // Add extra wait to ensure we capture the full conversation
        await new Promise(resolve => setTimeout(resolve, 5000));

        const finalOutput = process.getCleanOutput();

        // Verify tool call sequence worked
        expect(finalOutput).toContain('Working...');
        expect(finalOutput).toContain('🤖');
        expect(finalOutput).toContain('todo list');

        // Verify both messages were processed
        expect(finalOutput).toContain(
          'think about this and add a task: test task'
        );
        expect(finalOutput).toContain('think about this - what is 2+2?');
        expect(finalOutput).toContain('💭 Thinking...');
        expect(finalOutput).toContain('🔧 todo-list_todo_add');

        // Verify multi-turn conversation worked properly
        const agentResponseCount = (finalOutput.match(/🤖/g) || []).length;
        const userMessageCount = (finalOutput.match(/👤/g) || []).length;
        const toolCallCount = (finalOutput.match(/🔧/g) || []).length;

        // Should have multiple agent responses (significantly more than just startup message)
        expect(agentResponseCount).toBeGreaterThanOrEqual(10); // Much more than just the startup

        // Should have both user messages
        expect(userMessageCount).toBe(2);

        // Should have tool calls
        expect(toolCallCount).toBeGreaterThanOrEqual(1);

        // Verify the agent answered the math question in the second response
        expect(finalOutput).toMatch(/2\s*\+\s*2\s*=\s*4|four/i);

        process.kill();
      } finally {
        await env.cleanup();
      }
    }
  );
});
