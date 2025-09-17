# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development

- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npx .` - Run the built CLI from dist/
- `npm run clean` - Remove dist/ directory
- `npm run type` - Run tsc type checking

### Testing

- `npm test` - Run all tests with Vitest
- `npm run test:coverage` - Run tests with coverage report

### Interactive Testing

- `npm run test:interactive` - Run interactive CLI tests with real TTY support

**Testing Interactive CLI Functionality**: To test the interactive mode of this CLI, use the dedicated interactive testing framework. Create test files with the pattern `*.interactive.test.ts` in the `interactive/` directory. These tests use `node-pty` to provide real TTY emulation, enabling full testing of OpenTUI-based interactive UI components.

### Code Quality

- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run lint` - Run ESLint to check code quality

### CLI Usage

After building with `npm run build`:

- `npx . "message"` - Run the agent with a message
- `npx . --stdin` - Read input from stdin
- `npx . --log-level DEBUG` - Set log level (DEBUG, INFO, WARN, ERROR, SILENT)
- `npx . --log-progress all` - Set progress output (none, assistant, tool, all)
- `npx . --json` - Output structured JSON

### Testing Strategy

- Unit tests for all new code
- Coverage thresholds set at 70% for all metrics
- Tests use Vitest with Node.js environment
- **Tests must meaningfully test code. They should never assert on the response of a mock or call a mock directly**
- it is never acceptable to leave tests in a failing state

### Debugging

When debugging errors in control flow, use the application debug logs to understand what's happening. The logs directory can be found by running `npx . --help`:

- **Logs Directory**: `/Users/{username}/Library/Application Support/envoy`
  - `sessions/` - Session logs for debugging conversation flow
  - `mcp-tools/` - Tool execution logs for debugging MCP tool calls

Use `--log-level DEBUG` to enable detailed logging during development.

### Code guidelines

- Use types instead of interfaces for typescript - ALWAYS use `type` keyword, never `interface`
- Use zod for validations
- do not mock in test unless the mock simulates a network call.
- always reference the theme file when adding colors. never add color values inline
