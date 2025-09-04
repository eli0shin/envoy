# Interactive Mode Performance Optimization

## Current State (Ink UI Implementation)

The Ink-based interactive mode has been optimized to address performance issues through session-based caching and persistent resource management.

### Performance Optimizations Implemented

The current Ink UI interactive mode (`src/ui/inkInteractiveMode.ts`) implements these optimizations:

1. **Agent Session Caching** - MCP connections and tool schemas are loaded once per session
2. **Persistent Tool Loading** - Tools remain loaded throughout the interactive session
3. **Cached System Prompts** - System prompt construction is done once per session
4. **Reused Model Providers** - Provider instances are created once and reused
5. **Session State Management** - Conversation history is maintained efficiently

### Architecture Overview

The current implementation uses a session-based design where expensive setup is done once:

```typescript
// In src/ui/inkInteractiveMode.ts
export async function runInkInteractiveMode(config: RuntimeConfiguration) {
  // Initialize agent session once (expensive setup)
  const agentSession = await initializeAgentSession(config);

  // Create interactive session for message history
  const session = createInteractiveSession(config);

  // Render Ink interface with persistent session
  renderInkInterface(session, agentSession, config);
}
```

### Session Bridge Pattern

The `SessionBridge` class manages the interaction between the UI and the agent:

```typescript
// In src/ui/SessionBridge.ts
export class SessionBridge {
  private session: InteractiveSession;
  private agentSession: AgentSession; // Persistent, expensive resources
  private config: RuntimeConfiguration;

  async handleUserInput(input: string): Promise<void> {
    // Uses pre-initialized agentSession - no expensive setup per message
    const result = await runAgent(
      this.session.messages,
      this.config,
      this.agentSession,
      true,
      onMessageUpdate
    );
  }
}
```

### Performance Benefits

**Before (Legacy Interactive Mode):**

- 200-500ms setup time per message
- Repeated MCP server connections
- Tool schema reloading on every message
- Fresh system prompt construction

**After (Ink UI Implementation):**

- ~5-20ms per message after initial setup
- Persistent MCP connections throughout session
- Cached tool schemas and system prompts
- Reused model provider instances

### Key Components

1. **`AgentSession`** - Manages persistent expensive resources:

   - MCP client connections
   - Tool schemas and wrappers
   - Model provider instances

2. **`InteractiveSession`** - Manages conversation state:

   - Message history
   - Session configuration
   - UI state management

3. **Ink UI Components** - Provide responsive interface:
   - Real-time message updates
   - Loading indicators
   - Error handling

### Implementation Details

The optimization pattern follows this flow:

1. **One-time Setup** (expensive):

   ```typescript
   const agentSession = await initializeAgentSession(config);
   ```

2. **Per-Message Processing** (fast):

   ```typescript
   await runAgent(messages, config, agentSession, true, onMessageUpdate);
   ```

3. **Session Cleanup** (on exit):
   ```typescript
   await cleanupAgentSession(agentSession);
   ```

This architecture provides optimal performance for interactive usage while maintaining the flexibility and error recovery capabilities of the original design.
