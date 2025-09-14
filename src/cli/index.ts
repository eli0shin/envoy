#!/usr/bin/env node

/**
 * CLI entry point for the AI Agent
 * Now uses extracted modules for better organization
 */

// Import extracted CLI modules
import { main } from './handlers/executionFlow.js';

/**
 * Handle uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', async (error) => {
  process.stderr.write(`Uncaught exception: ${error.message}\n`);
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  process.stderr.write(`Unhandled rejection: ${reason}\n`);
  process.exit(1);
});

// Run the CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
