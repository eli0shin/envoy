# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development

- `bun run build` - Compile TypeScript to JavaScript in dist/
- `npx .` - Run the built CLI from dist/
- `bun run clean` - Remove dist/ directory
- `bun run type` - Run tsc type checking

### Testing

- `bun run test` - Run all tests with Vitest
- `bun run test:coverage` - Run tests with coverage report

### Interactive Testing

- `bun run test:interactive` - Run interactive CLI tests with tmux

**Testing Interactive CLI Functionality**: To test the interactive mode of this CLI, use the tmux-based testing framework. Create test files in the `interactive-tests/` directory. These tests use tmux sessions to provide real terminal environments, enabling full testing of OpenTUI-based interactive UI components. See `interactive-tests/README.md` for usage details.

### Code Quality

- `bun run format` - Format code with Prettier
- `bun run format:check` - Check code formatting
- `bun run lint` - Run ESLint to check code quality

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
- do not use try-catch in tests or test utilities. tests should fail loudly when something goes wrong.
- always reference the theme file when adding colors. never add color values inline
- use bun run test to run the tests. never run the test with bun test