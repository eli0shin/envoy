# Interactive Mode Implementation Plan

## Overview

This document outlines the plan to implement interactive mode for the CLI AI agent. Interactive mode will allow users to have ongoing conversations with the AI without needing to re-invoke the CLI for each message.

## User Experience

### Activation

- Interactive mode activates when no message argument is provided: `npx .`
- Can be explicitly disabled with a flag like `--no-interactive`

### Flow

1. User runs `npx .` without a message
2. CLI displays a welcome message and initial prompt
3. User enters their message and presses Enter
4. Agent processes the message and displays response
5. New prompt appears for the next message
6. Process continues until user exits (Ctrl+C or special exit command)

### Default Behaviors

- `--log-progress` defaults to `all` in interactive mode
- All other flags work as expected
- JSON mode (`--json`) should output structured data for each turn

## Architecture Changes

### 1. Conversation State Management

Create a new module `src/interactiveSession.ts`:

```typescript
type InteractiveSession = {
  messages: CoreMessage[];
  model: LanguageModel;
  tools: Record<string, CoreTool>;
  config: AgentConfig;
  isActive: boolean;
};
```

This module will:

- Maintain conversation history across turns
- Handle message accumulation
- Manage session lifecycle

### 2. Interactive Loop

Implement in `src/interactive.ts`:

```typescript
async function runInteractiveMode(config: AgentConfig): Promise<void> {
  // Initialize session
  const session = createInteractiveSession(config);

  // Display welcome message
  displayWelcome();

  // Main loop
  while (session.isActive) {
    // Display prompt
    const userInput = await promptUser();

    // Handle special commands
    if (isSpecialCommand(userInput)) {
      handleSpecialCommand(userInput, session);
      continue;
    }

    // Add user message to conversation
    session.messages.push({ role: 'user', content: userInput });

    // Run agent with accumulated messages
    const response = await runAgentWithSession(session);

    // Display response
    displayResponse(response);
  }

  // Cleanup
  displayGoodbye();
}
```

### 3. Prompt Interface

Use the existing `inquirer` library (already installed v12.6.3) for consistency:

```typescript
import inquirer from 'inquirer';

async function promptUser(): Promise<string> {
  const { message } = await inquirer.prompt([
    {
      type: 'input',
      name: 'message',
      message: '>',
      validate: (value) => value.trim().length > 0 || 'Please enter a message',
    },
  ]);
  return message;
}
```

This leverages the same library used for `--interactive-prompt` feature, maintaining consistency across the codebase.

### 4. Modified Agent Runner

Update `src/agent.ts` to accept conversation history:

```typescript
export async function runAgent(
  userMessage: string,
  conversationHistory: CoreMessage[] = []
): Promise<AgentResult> {
  // Combine history with new message
  const messages: CoreMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // Rest of the implementation remains similar
  // ...
}
```

## Implementation Steps

### Phase 1: Foundation (Days 1-2)

1. Create `interactiveSession.ts` with session management
2. Create `interactive.ts` with basic loop structure
3. Add prompt library dependency
4. Update types to support interactive mode

### Phase 2: Core Loop (Days 3-4)

1. Implement main interactive loop
2. Integrate with existing agent runner
3. Handle conversation history accumulation
4. Implement graceful exit handling

### Phase 3: CLI Integration (Days 5-6)

1. Update `cli.ts` to detect interactive mode
2. Set default `--log-progress all` for interactive mode
3. Ensure all existing flags work in interactive mode
4. Update help text and documentation

### Phase 4: Special Commands (Day 7)

1. Implement special commands:
   - `/exit` or `/quit` - Exit interactive mode
   - `/clear` - Clear conversation history
   - `/save [filename]` - Save conversation to file
   - `/model [name]` - Switch model mid-conversation
   - `/help` - Show available commands

### Phase 5: Polish & Edge Cases (Days 8-9)

1. Handle multi-line input (with continuation characters)
2. Implement command history (up/down arrows)
3. Add syntax highlighting for code blocks
4. Handle network interruptions gracefully
5. Implement conversation truncation for token limits

### Phase 6: Testing (Days 10-11)

1. Unit tests for session management
2. Integration tests for interactive loop
3. E2E tests with mock stdin/stdout
4. Manual testing of various scenarios

## Technical Considerations

### 1. Token Management

- Track token usage across conversation
- Implement smart truncation when approaching limits
- Warn user when conversation is getting long

### 2. State Persistence (Future Enhancement)

- Option to save/resume sessions
- Store conversation history in `.envoy/sessions/`

### 3. Streaming Support

- Ensure streaming responses work in interactive mode
- Update progress indicators appropriately

### 4. Signal Handling

```typescript
process.on('SIGINT', async () => {
  // Graceful shutdown
  await session.cleanup();
  process.exit(0);
});
```

### 5. Error Recovery

- Don't exit on errors, show error and continue
- Implement retry mechanism for network errors
- Clear error messages for user

## Testing Strategy

### Unit Tests

- Session management functions
- Message accumulation logic
- Special command parsing

### Integration Tests

- Interactive loop with mocked prompt
- Agent integration with conversation history
- Error handling scenarios

### E2E Tests

- Full interactive sessions with mock stdin/stdout
- Multi-turn conversations
- Special command execution

## Migration Path

1. Interactive mode is opt-in initially
2. Existing CLI behavior unchanged when message provided
3. Consider making interactive mode default in future version

## Future Enhancements

1. **Rich Terminal UI**: Use `blessed` or similar for better interface
2. **Conversation Branching**: Allow users to "undo" and try different paths
3. **Context Awareness**: Show token usage, model info in status bar
4. **Plugins**: Allow custom commands and integrations
5. **Collaborative Mode**: Multiple users in same session

## Success Criteria

- [ ] Users can have multi-turn conversations without re-invoking CLI
- [ ] All existing functionality works in interactive mode
- [ ] Clean, intuitive prompt interface
- [ ] Graceful handling of errors and edge cases
- [ ] Comprehensive test coverage
- [ ] Updated documentation and examples

## Timeline

- **Total Duration**: 11 days
- **Developer Effort**: 1 developer full-time
- **Review Checkpoints**: After Phase 2, 4, and 6

## Dependencies

- `inquirer` (already installed v12.6.3) for interactive prompts
- No new dependencies required
- No breaking changes to existing dependencies
- Optional: `chalk` for colored output enhancement (consider using existing logger capabilities)
