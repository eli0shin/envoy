# UI-Only Messages Implementation Plan

## Problem Statement

The `/help` command and other special commands currently use direct `console.log()` calls that bypass the Ink UI system, resulting in inconsistent left padding compared to regular messages (user, assistant, tool, thinking). This creates a visual inconsistency in the interactive mode interface.

## Root Cause Analysis

1. **Two Output Systems**:

   - Regular messages flow through Ink UI components (`MessageGroup`, `PaddedText`) with consistent padding
   - Special commands use direct `console.log()` calls that bypass the UI padding system

2. **Current Message Flow**:

   - Regular messages: `CoreMessage` → `SessionBridge` → `MessageList` → `MessageGroup` → `PaddedText` (with `leftOffset={5}`)
   - Special commands: `handleSpecialCommand()` → `console.log()` (no padding)

3. **Session Storage Issue**:
   - All messages currently stored in `session.messages: CoreMessage[]` are sent to the agent
   - We need UI-only messages that display in the interface but don't affect agent conversation

## Solution Design

### 1. Dual Message Storage System

Create a separation between agent conversation messages and UI display messages:

```typescript
// Current: single storage for everything
type InteractiveSession = {
  messages: CoreMessage[]; // Sent to agent
  // ... other fields
};

// Proposed: separate storage for different message types
type InteractiveSession = {
  messages: CoreMessage[]; // Sent to agent (conversation history)
  uiMessages: UIMessage[]; // UI-only messages (help, status, etc.)
  // ... other fields
};
```

### 2. New UIMessage Type System

```typescript
type UIMessage = {
  id: string;
  type: 'help' | 'status' | 'info' | 'error';
  content: string;
  timestamp: Date;
  metadata?: {
    isSystemCommand?: boolean;
    commandName?: string;
  };
};
```

### 3. Enhanced Display Message System

Extend the existing `DisplayMessage` type to handle UI-only messages:

```typescript
// Update messageTransform.ts DisplayMessage type
type DisplayMessage = {
  id: string;
  type:
    | 'user'
    | 'assistant'
    | 'tool-call'
    | 'system'
    | 'help'
    | 'status'
    | 'info'
    | 'error';
  content: string;
  timestamp: Date;
  isUIOnly?: boolean; // Flag to indicate this message is not part of agent conversation
  // ... existing fields
};
```

### 4. Theme Integration

Add new message types to the theme system:

```typescript
// Update theme.ts
export type UITheme = {
  colors: {
    // Existing colors...
    help: ThemeColor;
    status: ThemeColor;
    // info and error already exist
  };

  icons: {
    // Existing icons...
    help: string;
    status: string;
    // info already exists
  };
};

// Update getMessageColor and getMessageIcon functions
```

## Implementation Steps

### Phase 1: Core Infrastructure

#### 1.1 Update InteractiveSession Type

- **File**: `src/interactiveSession.ts`
- **Changes**:
  - Add `uiMessages: UIMessage[]` field to `InteractiveSession`
  - Create `UIMessage` type definition
  - Add helper functions: `addUIMessage()`, `clearUIMessages()`

#### 1.2 Extend DisplayMessage Type

- **File**: `src/ui/utils/messageTransform.ts`
- **Changes**:
  - Add new message types: `'help' | 'status' | 'info' | 'error'`
  - Add `isUIOnly?: boolean` flag
  - Update `transformMessagesForDisplay()` to merge agent messages + UI messages

#### 1.3 Update Theme System

- **File**: `src/ui/theme.ts`
- **Changes**:
  - Add colors for new message types
  - Add icons for new message types (📖 for help, ℹ️ for status)
  - Update helper functions to handle new types

### Phase 2: Message Processing

#### 2.1 Update SessionBridge

- **File**: `src/ui/SessionBridge.ts`
- **Changes**:
  - Add method: `addUIMessage(message: UIMessage)`
  - Update `handleUserInput()` to emit UI messages instead of console.log for special commands
  - Modify message merging logic to include UI messages in display

#### 2.2 Update MessageTransform

- **File**: `src/ui/utils/messageTransform.ts`
- **Changes**:
  - Create new function: `transformUIMessagesForDisplay(uiMessages: UIMessage[]): DisplayMessage[]`
  - Update main transform function to merge both message streams
  - Ensure proper sorting by timestamp

#### 2.3 Update MessageGroup Component

- **File**: `src/ui/components/messages/MessageGroup.tsx`
- **Changes**:
  - Add cases for new message types in `getMessageIcon()` and `getMessageColor()` calls
  - Add special rendering logic for help messages (e.g., formatted command lists)

### Phase 3: Special Command Refactoring

#### 3.1 Update Special Command Handlers

- **File**: `src/interactiveSession.ts`
- **Changes**:
  - Modify `/help` command handler to return formatted content instead of console.log
  - Update `/clear`, `/history` handlers to emit UI messages
  - Return structured data from command handlers

#### 3.2 SessionBridge Integration

- **File**: `src/ui/SessionBridge.ts`
- **Changes**:
  - Update special command handling to use `addUIMessage()` instead of direct console output
  - Format help content appropriately for UI display

### Phase 4: Enhanced Help System

#### 4.1 Rich Help Content

Create structured help content with better formatting:

```typescript
const HELP_CONTENT = `Available commands:
  /exit - Exit interactive mode
  /quit - Exit interactive mode (alias for /exit)
  /clear - Clear conversation history
  /help - Show available commands
  /history - Show conversation history count

Press Ctrl+C to exit at any time.`;
```

#### 4.2 Extensible Command System

- Allow commands to specify their help text
- Support command categories and detailed descriptions
- Enable dynamic help generation

## Technical Considerations

### 1. Message Ordering and Display

- UI messages should be inserted at the correct chronological position
- Need to maintain proper ordering when merging agent messages and UI messages
- Consider message priority (some UI messages might need to appear immediately)

### 2. Session Persistence

- Agent conversation messages (`session.messages`) remain unchanged for agent context
- UI messages are ephemeral and don't need to persist between sessions
- Clear UI messages on session reset/clear commands

### 3. Testing Strategy

- Unit tests for new message transformation logic
- Integration tests for special command UI message generation
- Interactive tests to verify visual consistency
- Ensure no regression in agent conversation flow

### 4. Performance Considerations

- Efficient merging of message streams during display
- Minimal overhead for UI message storage
- Consider message limits for UI messages to prevent memory growth

## Migration Plan

### 1. Backward Compatibility

- Existing `CoreMessage[]` system remains unchanged
- All agent functionality continues to work as before
- Progressive enhancement approach - fallback to console.log if UI system fails

### 2. Gradual Rollout

1. Implement infrastructure (Phase 1)
2. Update `/help` command first as proof of concept
3. Migrate other special commands
4. Add enhanced formatting and features

### 3. Validation

- Compare visual output before/after changes
- Ensure all special commands maintain functionality
- Verify agent conversations are unaffected

## Expected Benefits

### 1. Visual Consistency

- All messages have consistent left padding and formatting
- Unified color scheme and iconography
- Professional, polished appearance

### 2. Enhanced User Experience

- Better formatted help content
- Contextual information display
- Improved readability

### 3. Extensibility

- Easy to add new types of UI-only messages
- Support for rich content formatting
- Foundation for advanced UI features (notifications, status updates, etc.)

### 4. Maintainability

- Clear separation between agent conversation and UI display
- Centralized message formatting logic
- Consistent pattern for special command output

## Files to be Modified

1. **Core Types**:

   - `src/interactiveSession.ts` - Add UIMessage type and helpers
   - `src/ui/utils/messageTransform.ts` - Extend DisplayMessage handling

2. **UI Components**:

   - `src/ui/components/messages/MessageGroup.tsx` - Add new message type rendering
   - `src/ui/theme.ts` - Add colors and icons for new types

3. **Session Management**:

   - `src/ui/SessionBridge.ts` - Integrate UI message handling
   - `src/ui/components/MessageList.tsx` - Update message merging logic

4. **Testing**:
   - `src/interactiveSession.test.ts` - Test new UI message functionality
   - `src/ui/SessionBridge.test.ts` - Test UI message integration
   - Interactive tests for visual validation

## Success Criteria

1. **Visual Consistency**: `/help` command output has same left padding as other messages
2. **Functional Preservation**: All special commands work exactly as before
3. **Agent Isolation**: UI messages don't affect agent conversation history
4. **Extensibility**: Easy to add new UI-only message types
5. **Performance**: No measurable impact on conversation response times
6. **Test Coverage**: >90% test coverage for new functionality

## Future Enhancements

After successful implementation, this system enables:

- Rich help content with syntax highlighting
- Status messages during long operations
- Error/warning notifications
- Command completion suggestions
- Interactive command documentation
- Multi-line formatted responses for complex commands
