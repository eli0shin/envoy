# Conversation Persistence and Resume Feature

**Product Requirements and Design Document**

## Overview

This document outlines the design and implementation strategy for persistent conversation history in the Envoy CLI agent, enabling users to resume conversations across sessions and maintain conversation context over time.

## Problem Statement

Currently, the Envoy CLI agent loses all conversation history when the session ends. Users cannot:

- Resume previous conversations
- Reference past interactions within a project context
- Maintain conversation context across CLI invocations
- Review historical conversations for debugging or reference

## Goals

### Primary Goals

1. **Conversation Persistence**: Save completed conversation messages using AI SDK completion detection
2. **Project-Scoped Sessions**: Organize conversations by project/repository context
3. **Resume Functionality**: Allow users to continue previous conversations with full context
4. **Crash Recovery**: Persist completed messages using reliable stream completion signals

### Secondary Goals

1. **Conversation Management**: Provide tools to list, view, and manage historical conversations
2. **Storage Efficiency**: Use efficient storage format (JSONL) consistent with existing logging
3. **Privacy**: Keep conversations project-scoped and locally stored

## Success Metrics

- Users can successfully resume conversations after CLI restart
- No conversation data loss during normal operation or crashes
- Fast conversation loading (< 1 second for typical conversations)
- Clean separation between debug logs and conversation history

## User Stories

### Core Functionality

1. **As a developer**, I want my conversation with the agent to persist when I restart the CLI, so I can continue where I left off
2. **As a developer**, I want conversations to be project-specific, so my work on different codebases doesn't interfere
3. **As a developer**, I want to use `/clear` to start a fresh conversation while preserving the previous one
4. **As a developer**, I want to use `--resume` to continue my most recent conversation in this project

### Advanced Functionality

1. **As a developer**, I want to list previous conversations to reference past solutions
2. **As a developer**, I want conversation history to survive crashes and interruptions
3. **As a developer**, I want old conversations to be automatically cleaned up to save disk space

## Technical Architecture

### Current Implementation Analysis

**Key Components:**

- `runAgent()` - Main agent execution with streaming loop (`agent.ts:271-454`)
- `SessionBridge` - UI/agent interface with real-time message updates (`ui/SessionBridge.ts`)
- `InteractiveSession` - Session state management (`interactiveSession.ts`)
- `Logger` - Existing persistence layer with session ID management (`logger.ts`)

**AI SDK Integration:**

- Uses `streamText()` from Vercel AI SDK with `fullStream` iteration
- Stream completion detected via `await streamResult.response` and `finishReason`
- Message accumulation in `messages` array after streaming completes
- Tool calls and results available in `response.messages` after completion

**Message Flow:**

```
User Input → SessionBridge → runAgent → streamText → Post-Stream Completion → Persistence
```

### Proposed Architecture

#### Directory Structure

```
envPaths('envoy').data/
├── sessions/           # Debug logs (existing)
├── mcp-tools/         # MCP tool logs (existing)
└── conversations/     # NEW: Conversation history
    └── {project-identifier}/
        ├── 01932d4a-0123-7890-abcd-123456789abc.jsonl  # Older conversation
        ├── 01932d4b-4567-7890-abcd-123456789def.jsonl  # Newer conversation
        └── 01932d4c-89ab-7890-abcd-123456789ghi.jsonl  # Latest conversation
```

**Project Boundaries and Identification:**

- **Project path:** Simple `process.cwd()` (current working directory)
- **Project identifier:** Full path with slashes replaced by underscores for readability
- **Directory creation:** Auto-create conversation directories on CLI startup
- Human-readable directory names for easy navigation

```typescript
function getProjectIdentifier(): string {
  return process
    .cwd()
    .replace(/^\//, '') // Remove leading slash
    .replace(/\//g, '_'); // Replace slashes with underscores
}

async function ensureConversationDirectory(
  projectIdentifier: string
): Promise<string> {
  const conversationDir = join(
    envPaths('envoy').data,
    'conversations',
    projectIdentifier
  );
  await fs.mkdir(conversationDir, { recursive: true });
  return conversationDir;
}
```

#### Session ID Strategy

- Use `uuidv7()` for time-ordered session IDs via existing Logger class
- Extend existing Logger singleton with session management methods
- Generate new session ID on:
  - CLI startup (if no --resume flag)
  - `/clear` command execution
- Leverage time-ordering to find latest conversation (no symlinks needed)

**Logger Extensions:**

```typescript
class Logger {
  getSessionId(): string;
  generateNewSessionId(): string;
  setSessionId(sessionId: string): void; // For resume functionality
}
```

### Data Model

#### AI SDK Completion-Based Persistence Strategy

**Core Principle**: Leverage AI SDK's built-in completion detection to persist only fully completed messages. Use `await streamResult.response` and `finishReason` for reliable completion detection.

#### Message Types and Completion Detection

**1. User Messages (Always Complete)**

```typescript
{ role: 'user', content: string }
// Persist: Immediately (already complete)
```

**2. Assistant Text Messages (Complete after Stream Finishes)**

```typescript
{ role: 'assistant', content: string }
// Persist: After await streamResult.response completes
// Available: In response.messages array from AI SDK
```

**3. Thinking Messages (Complete with Signature)**

```typescript
{
  role: 'assistant',
  content: string,
  thinking: true,
  isThinkingComplete: true,  // Completion signal from streaming
  thinkingSignature?: string
}
// Persist: When isThinkingComplete === true
// Available: In accumulated thinking messages during streaming
```

**4. Tool Interactions (Complete with Results)**

```typescript
{
  role: 'tool',
  content: any,
  toolName: string,
  toolArgs: Record<string, unknown>,
  toolCallId: string,
  toolResult: unknown  // Available after tool execution
}
// Persist: Available in response.messages after streaming
// Source: AI SDK automatically assembles complete tool interactions
```

**Session Metadata:**

```typescript
{
  type: 'session-start',
  timestamp: string,
  projectPath: string,
  provider: string,
  gitCommit?: string
}
```

#### Message Completion Detection Logic

```typescript
class MessageCompletionDetector {
  static isComplete(message: CoreMessage): boolean {
    const enhanced = message as ExtendedCoreMessage;

    switch (message.role) {
      case 'user':
        return true; // Always complete

      case 'assistant':
        if (enhanced.thinking) {
          return enhanced.isThinkingComplete === true;
        }
        return true; // Text messages complete after streaming

      case 'tool':
        return !!(
          enhanced.toolName &&
          enhanced.toolArgs &&
          enhanced.toolResult
        );

      default:
        return false;
    }
  }
}
```

#### Messages NOT to Persist

**Streaming/Intermediate States:**

- Text delta chunks during assistant response streaming
- Reasoning chunks with `isThinkingComplete: false`
- Tool calls without results (incomplete tool interactions)
- Partial updates during streaming

**UI/System Messages:**

- UIMessage types (`help`, `status`, `info`, `error`) - ephemeral UI feedback
- Loading states (`working`, `tool-execution`, `thinking`) - transient UI states
- Step boundaries (`__STEP_BOUNDARY__`) - internal streaming signals

**Impact**: This approach results in cleaner conversation files with only meaningful, complete conversation turns. Each persisted message represents a finished action or response, making conversation resumption more reliable.

#### Storage Format (JSONL)

```typescript
{
  timestamp: string,        // ISO 8601 timestamp
  messageIndex: number,     // Sequential message index
  message: CoreMessage,     // The actual message content
  sessionId: string,        // Session identifier
  messageType: 'conversation' | 'session-meta'
}
```

### Implementation Plan

#### Phase 1: Post-Stream Persistence

1. **Extend AgentSession with ConversationPersistence**

   ```typescript
   export type AgentSession = {
     model: LanguageModel;
     tools: Record<string, WrappedTool>;
     systemPrompt: string | string[];
     mcpClients: MCPClientWrapper[];
     authInfo: AuthenticationInfo;
     conversationPersistence?: ConversationPersistence; // NEW
   };
   ```

2. **Create ConversationPersistence Service**

   ```typescript
   class ConversationPersistence {
     private sessionId: string;
     private projectIdentifier: string;
     private conversationDir: string;

     async persistMessages(messages: CoreMessage[]): Promise<void>;
     async loadConversation(sessionId?: string): Promise<CoreMessage[]>;
     async getLatestConversation(): Promise<string | null>;
     private getProjectIdentifier(): string;
     private ensureDirectory(): Promise<void>;
   }
   ```

3. **Persistence Integration in runAgent**

   **Primary Integration Point**: After stream completion in `runAgent()` (~line 454)

   ```typescript
   export async function runAgent(/*...*/): Promise<AgentResult> {
     // ... existing streaming loop ...

     // Stream completion detection (existing)
     const response = await streamResult.response;
     const finishReason = await streamResult.finishReason;

     // Add response messages to conversation (existing)
     if (response?.messages && response.messages.length > 0) {
       messages.push(...response.messages);
     }

     // NEW: Persist completed conversation
     if (
       session.conversationPersistence &&
       (finishReason === 'stop' || finishReason === 'length')
     ) {
       try {
         // Calculate new messages to persist
         const startMessageCount = Array.isArray(messagesOrUserMessage)
           ? messagesOrUserMessage.length
           : 1; // String input = 1 user message

         const newMessages = messages.slice(startMessageCount);

         if (newMessages.length > 0) {
           await session.conversationPersistence.persistMessages(newMessages);
           logger.debug(`Persisted ${newMessages.length} messages`);
         }
       } catch (error) {
         logger.warn(`Conversation persistence failed: ${error.message}`);
         // Continue execution - don't break agent for persistence failures
       }
     }

     return result;
   }
   ```

4. **Initialize ConversationPersistence in AgentSession**

   ```typescript
   export async function initializeAgentSession(
     config: RuntimeConfiguration
   ): Promise<AgentSession> {
     // ... existing initialization ...

     // NEW: Initialize persistence if enabled
     const conversationPersistence = config.persistence?.enabled
       ? new ConversationPersistence(
           logger.getSessionId(),
           getProjectIdentifier()
         )
       : undefined;

     return {
       model,
       tools,
       systemPrompt,
       mcpClients,
       authInfo,
       conversationPersistence, // NEW
     };
   }
   ```

5. **Modify /clear Command**

   Update both SessionBridge and interactiveSession handlers:

   ```typescript
   // In SessionBridge.ts
   case '/clear':
     // Generate new session ID for fresh conversation
     logger.generateNewSessionId();

     // Clear in-memory message arrays
     this.session.messages = [];
     this.session.uiMessages = [];

     // Initialize new conversation persistence
     if (this.agentSession.conversationPersistence) {
       this.agentSession.conversationPersistence = new ConversationPersistence(
         logger.getSessionId(),
         getProjectIdentifier()
       );
     }

     this.addUIMessage('status', 'Conversation history cleared.', {
       isSystemCommand: true,
       commandName: 'clear',
     });
     break;
   ```

#### Phase 2: Resume Functionality

1. **Add --resume CLI Flag**

   ```bash
   npx . --resume  # Resume latest conversation
   npx . --resume {sessionId}  # Resume specific conversation
   ```

   **CLI Options Extension:**

   ```typescript
   export type CLIOptions = {
     // ... existing options ...
     resume?: boolean | string; // NEW
   };
   ```

2. **Session ID Initialization for Resume**

   ```typescript
   async function initializeSessionId(options: CLIOptions): Promise<void> {
     if (options.resume !== undefined) {
       if (options.resume === true || options.resume === '') {
         // Find latest conversation for this project
         const conversationPersistence = new ConversationPersistence(
           '', // Temporary session ID
           getProjectIdentifier()
         );
         const latestSessionId =
           await conversationPersistence.getLatestConversation();
         logger.setSessionId(latestSessionId || logger.generateNewSessionId());
       } else {
         // Use specific session ID
         logger.setSessionId(options.resume as string);
       }
     } else {
       // Generate new session ID
       logger.generateNewSessionId();
     }
   }
   ```

3. **Conversation Loading Before runAgent**

   ```typescript
   // In CLI main function
   async function main(): Promise<void> {
     // 1. Parse arguments and create config
     const { options, message } = await parseArguments();
     const configResult = await createRuntimeConfiguration(options);

     // 2. Initialize session ID (with resume detection)
     await initializeSessionId(options);

     // 3. Initialize agent session
     agentSession = await initializeAgentSession(configResult.config);

     // 4. Load conversation history if resuming
     let messageInput = enhancedMessage;
     if (options.resume !== undefined && agentSession.conversationPersistence) {
       const history =
         await agentSession.conversationPersistence.loadConversation();
       if (history.length > 0) {
         messageInput = [
           ...history,
           { role: 'user', content: enhancedMessage },
         ];
       }
     }

     // 5. Run agent with loaded history
     result = await runAgent(
       messageInput,
       configResult.config,
       agentSession,
       false
     );
   }
   ```

4. **SessionBridge Resume Integration**

   ```typescript
   // In SessionBridge constructor or initialization
   private async loadExistingConversation(): Promise<void> {
     if (this.agentSession.conversationPersistence) {
       const history = await this.agentSession.conversationPersistence.loadConversation();
       if (history.length > 0) {
         this.session.messages = history;
         this.addUIMessage('info', `Resumed conversation with ${history.length} messages`);
       }
     }
   }
   ```

#### Phase 3: Advanced Features

1. **Enhanced Conversation Listing**

   Improve the existing `/conversations` command:

   - Show first 100 characters of the first message for context
   - Show first 100 characters of the last assistant message
   - Keep current limit of 10 most recent conversations
   - Maintain existing session ID, timestamp, message count, and file size display

2. **Manual Conversation Cleanup**

   ```bash
   /conversations clean      # Clean up conversations older than 7 days
   /conversations clean-all  # Delete all conversations for this project
   ```

   **Architecture and Separation of Concerns:**

   **Core Business Logic (ConversationPersistence.ts):**

   ```typescript
   // Query methods - determine what to clean
   async getOldConversations(daysThreshold: number = 7): Promise<string[]>
   async getAllConversations(): Promise<string[]>
   async getConversationStats(sessionId: string): Promise<{ size: number; age: number }>

   // Atomic operations
   async deleteConversation(sessionId: string): Promise<ConversationDeleteResult>

   // Batch operations with detailed results
   async deleteConversations(sessionIds: string[]): Promise<CleanupResult>

   // Helper methods
   private async getConversationAge(sessionId: string): Promise<number> // days
   ```

   **UI and Command Handling (SessionBridge.ts):**

   ```typescript
   private async handleConversationsCommand(args?: string): Promise<void> {
     const [subcommand] = (args?.trim().split(' ') || []);

     switch (subcommand) {
       case 'clean':
         await this.handleCleanOldConversations();
         break;
       case 'clean-all':
         await this.handleCleanAllConversations();
         break;
       default:
         await this.handleConversationsList(); // existing logic
     }
   }

   private async handleCleanOldConversations(): Promise<void>
   private async handleCleanAllConversations(): Promise<void>
   private formatCleanupResults(result: CleanupResult): string
   ```

   **Data Flow Pattern:**

   ```
   SessionBridge (UI) → ConversationPersistence (Business Logic) → File System
                 ↑ Results formatting ← CleanupResult ←
   ```

   **Result Types:**

   ```typescript
   type ConversationDeleteResult = {
     success: boolean;
     sessionId: string;
     sizeFreed: number;
     error?: string;
   };

   type CleanupResult = {
     deletedCount: number;
     totalSizeFreed: number;
     successes: ConversationDeleteResult[];
     failures: ConversationDeleteResult[];
   };
   ```

   **Key Integration Points:**

   - **Persistence Availability**: SessionBridge checks `this.agentSession.conversationPersistence` exists
   - **Business Logic Delegation**: SessionBridge calls ConversationPersistence methods but doesn't implement cleanup logic
   - **Result Formatting**: SessionBridge formats CleanupResult for user display
   - **Error Boundary**: SessionBridge handles and presents errors from ConversationPersistence layer
   - **Configuration**: Default policies (7 days) as constants in ConversationPersistence, parameters allow future policy injection

   **Error Handling Strategy:**

   - ConversationPersistence methods never throw for individual file failures
   - Return detailed results with successes/failures for partial operation scenarios
   - SessionBridge presents partial success clearly to users
   - Missing persistence handled gracefully at UI layer

3. **Export Functionality**

   Export conversations to configurable directory (default: user's Downloads folder):

   - **JSON format**: Complete conversation data with full metadata and tool calls
   - **Markdown format**: Human-readable transcript with truncated tool calls (same truncation as Ink UI)
   - **HTML format**: Interactive format with expandable tool call sections for arguments and results
   - **Export directory**: Configurable via config file only (no CLI flags)
   - **Commands**:
     ```bash
     /export {sessionId} [format]  # Export specific conversation
     /export-all [format]          # Export all conversations for project
     ```

### Integration Points

#### Post-Stream Persistence Benefits

**Why This Approach is Optimal:**

1. **Reliable Completion Detection**: Uses AI SDK's built-in `finishReason` and `response.messages`
2. **Minimal Code Changes**: Leverages existing completion detection in `runAgent()`
3. **Complete Message State**: Access to fully assembled messages including tool interactions
4. **Error Safety**: Persistence failures don't disrupt streaming or agent execution
5. **Performance**: Single persistence operation per conversation turn

#### Error Handling Strategy

**Graceful Degradation Pattern:**

```typescript
async function persistWithGracefulDegradation(
  messages: CoreMessage[]
): Promise<void> {
  try {
    await this.persistMessages(messages);
  } catch (error) {
    // Log error but don't break conversation
    logger.warn(`Persistence failed: ${error.message}`);

    // Optional: Queue for background retry
    this.retryQueue.push({
      messages,
      attempts: 0,
      timestamp: Date.now(),
    });
  }
}
```

#### Logger Integration

**Shared Infrastructure:**

- Use same `envPaths('envoy')` base directory
- Reuse directory creation logic from Logger.initialize()
- Maintain separation: conversations ≠ debug logs
- Share session ID between Logger and ConversationPersistence

### File Format Specification

#### Conversation File Structure

```jsonl
{"timestamp":"2025-01-15T10:30:00.000Z","messageIndex":0,"messageType":"session-meta","sessionId":"01932d4c-89ab-7890-abcd-123456789ghi","message":{"type":"session-start","projectPath":"/Users/dev/myproject","provider":"anthropic","gitCommit":"abc123"}}
{"timestamp":"2025-01-15T10:30:15.123Z","messageIndex":1,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789ghi","message":{"role":"user","content":"Help me implement a new feature"}}
{"timestamp":"2025-01-15T10:30:45.789Z","messageIndex":2,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789ghi","message":{"role":"assistant","content":"I'd be happy to help you implement a new feature. Let me start by reading your current codebase...","thinking":true,"isThinkingComplete":true,"thinkingSignature":"sig_abc123"}}
{"timestamp":"2025-01-15T10:31:02.456Z","messageIndex":3,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789ghi","message":{"role":"tool","content":"Tool call: Read","toolName":"Read","toolArgs":{"file_path":"src/app.ts"},"toolCallId":"tool_123","toolResult":"// App.tsx content here..."}}
{"timestamp":"2025-01-15T10:31:15.234Z","messageIndex":4,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789ghi","message":{"role":"assistant","content":"Based on your current code structure, here's how I recommend implementing the new feature..."}}
```

**Note**: Each line represents a **completed** message from AI SDK's `response.messages` - no streaming chunks, no partial tool calls, no incomplete thinking. The conversation file contains only the final state of each interaction.

### Configuration

#### New Configuration Options

```typescript
type ConversationConfig = {
  enabled: boolean; // Default: true
  retentionDays: number; // Default: 30
  maxConversationsPerProject: number; // Default: 100
  directory?: string; // Override default directory
};
```

#### CLI Flags

```bash
--resume [sessionId]        # Resume conversation (latest if no ID)
--no-persistence           # Disable conversation persistence
--conversation-dir PATH     # Override conversation directory
```

### Performance Considerations

#### Write Performance

- **Post-stream persistence**: Single write operation per conversation turn
- **Append-only JSONL**: O(1) write operations
- **Batch persistence**: Write all new messages from turn together
- **Async writes**: Non-blocking message persistence using graceful degradation
- **Error recovery**: Background retry for failed writes

#### Read Performance

- **Lazy loading**: Load conversations only when needed for resume
- **Complete messages only**: Faster parsing with fewer, complete messages
- **Streaming parser**: Handle large conversation files efficiently
- **Project filtering**: Only scan relevant project directories

#### Storage Efficiency

- **Smaller files**: No redundant streaming chunks or intermediate states
- **AI SDK optimization**: Leverage built-in message deduplication
- **Cleanup**: Automatic removal of old conversations
- **Size limits**: Configurable limits on conversation file size

### Security and Privacy

#### Data Protection

- **Local storage only**: No cloud synchronization by default
- **Project isolation**: Conversations scoped to specific projects
- **Secure permissions**: Restrict file access to user only (600)
- **No sensitive data**: Avoid persisting API keys or credentials

#### Data Retention

- **User control**: Clear deletion mechanisms
- **Automatic cleanup**: Configurable retention policies
- **Secure deletion**: Proper file deletion (not just unlinking)
- **Export control**: User-initiated export only

### Testing Strategy

#### Unit Tests by Layer

**ConversationPersistence.test.ts (Business Logic Layer):**

- **Core persistence**: Message serialization/deserialization and JSONL parsing
- **Message completion detection**: Verify completion logic for all message types
- **Session ID management**: Proper uuidv7 time ordering and validation
- **Cleanup operations**: Test getOldConversations(), getAllConversations(), deleteConversations()
- **File age calculation**: Mock fs.stat() to test age detection logic
- **Edge cases**: Missing directories, permission errors, invalid session IDs, corrupted files
- **Batch operations**: Test mixed success/failure scenarios in deleteConversations()
- **Error handling**: Verify methods never throw, return detailed results

**SessionBridge.test.ts (UI Layer):**

- **Command routing**: Test parsing of "clean" vs "clean-all" subcommands
- **Persistence availability**: Test graceful handling when conversationPersistence is unavailable
- **User feedback**: Mock ConversationPersistence methods to test result formatting
- **Error presentation**: Test how partial failures are presented to users
- **UI integration**: Verify addUIMessage() calls with appropriate content and metadata

#### Integration Tests

- **Post-stream persistence**: Message flow from runAgent completion to file
- **Resume functionality**: Load and continue conversations
- **Error scenarios**: Disk full, permission denied, corrupted files
- **AI SDK integration**: Verify completion detection with actual streamText calls
- **End-to-end cleanup**: Test actual conversation files are deleted correctly
- **Command flow**: Verify /conversations clean commands work with real file operations

#### Interactive Tests

- **Real conversation persistence**: Manual testing with streaming responses
- **Tool call persistence**: Verify complete tool interactions are saved
- **Performance testing**: Large conversation loading and cleanup operations
- **Crash recovery**: Terminate process mid-conversation
- **Cleanup user experience**: Test user feedback matches actual operations performed

### Migration and Rollback

#### Forward Migration

- **Automatic activation**: Enable persistence on first CLI usage
- **No data migration**: Fresh start for new feature
- **Graceful fallback**: Continue operation if persistence fails
- **User notification**: Inform users about new persistence feature

#### Rollback Strategy

- **Configuration disable**: `persistence.enabled = false`
- **Clean removal**: Delete conversation directory if needed
- **No breaking changes**: Maintain compatibility with existing sessions
- **Data preservation**: Keep conversation files for future re-enabling

## Implementation Timeline

### Week 1: Post-Stream Persistence Foundation

- [ ] Extend AgentSession with ConversationPersistence
- [ ] Implement ConversationPersistence service with JSONL storage
- [ ] Add persistence integration point in runAgent after stream completion
- [ ] Implement message completion detection logic
- [ ] Test with simple conversation scenarios

### Week 2: Resume Functionality

- [ ] Add --resume CLI flag and argument parsing
- [ ] Implement session ID management for resume scenarios
- [ ] Add conversation loading before runAgent execution
- [ ] Integrate resume functionality with SessionBridge
- [ ] Test conversation loading and continuation

### Week 3: Interactive Mode Integration

- [ ] Integrate conversation persistence with SessionBridge
- [ ] Update /clear command to generate new session IDs
- [ ] Add conversation loading in interactive mode
- [ ] Implement graceful error handling and recovery
- [ ] End-to-end testing for both CLI and interactive modes

### Week 4: Manual Cleanup Commands

**Phase 1: Core Business Logic (ConversationPersistence.ts)**

- [ ] Add getOldConversations() method with file age calculation logic
- [ ] Add getAllConversations() method for project conversation discovery
- [ ] Add deleteConversation() method for atomic file deletion operations
- [ ] Add deleteConversations() batch method with detailed result tracking
- [ ] Add getConversationStats() method for file size and age information
- [ ] Write comprehensive unit tests with mocked file operations

**Phase 2: UI Integration (SessionBridge.ts)**

- [ ] Enhance handleConversationsCommand() to parse "clean" and "clean-all" subcommands
- [ ] Add handleCleanOldConversations() method that delegates to ConversationPersistence
- [ ] Add handleCleanAllConversations() method with proper user feedback
- [ ] Add formatCleanupResults() method for presenting CleanupResult to users
- [ ] Write unit tests for command routing and result formatting

**Phase 3: Integration and Testing**

- [ ] End-to-end testing with real file operations
- [ ] Test cleanup operations with mixed success/failure scenarios
- [ ] Verify user feedback matches actual operations performed
- [ ] Test graceful handling when conversationPersistence is unavailable

### Week 5: Polish and Advanced Features

- [ ] Comprehensive test suite with AI SDK integration
- [ ] Performance optimization for large conversations
- [ ] Enhanced conversation listing (Phase 3 from advanced features)
- [ ] Documentation and user migration guide

### Future Enhancements

- [ ] Automatic cleanup policies with background execution
- [ ] Export/import functionality
- [ ] Advanced search and filtering
- [ ] Conversation analytics and insights

## Success Criteria

### Functional Requirements ✅

- [ ] Conversations persist across CLI sessions using AI SDK completion detection
- [ ] --resume flag successfully loads previous conversations
- [ ] /clear creates new session while preserving old ones
- [ ] Project-scoped conversation isolation works correctly
- [ ] No data loss during normal operation or crashes

### Performance Requirements ✅

- [ ] Conversation loading completes in < 1 second for typical conversations
- [ ] Post-stream persistence doesn't impact response time
- [ ] Storage usage remains reasonable (< 100MB per project typical)

### Quality Requirements ✅

- [ ] Robust error handling with graceful degradation
- [ ] Comprehensive test coverage (>80%)
- [ ] Clear user documentation and migration path
- [ ] No breaking changes to existing functionality

---

_This document serves as the comprehensive specification for implementing conversation persistence in the Envoy CLI agent using AI SDK's built-in completion detection. It should be updated as implementation details are refined and user feedback is incorporated._
