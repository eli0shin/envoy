# TUI State Management Hooks

This directory contains custom React hooks for managing state in the TUI components. These hooks follow a hybrid architecture pattern:

- **Context** for truly shared state (conversation messages, agent status)
- **Custom hooks** for self-contained features (history, cursor, autocomplete)
- **Local state** for simple UI (selected indices, editing flags)

## Available Hooks

### useConversation (Context-based)

**Purpose**: Manages shared conversation state including messages, queue, and agent processing status.

**Location**: `src/tui/hooks/useConversation.tsx`

**Usage**:
```typescript
import { ConversationProvider, useConversation } from '../hooks/useConversation.js';

// Wrap your app with the provider
function App({ config, session }: Props) {
  return (
    <ConversationProvider config={config} session={session}>
      <YourComponent />
    </ConversationProvider>
  );
}

// Inside components, use the hook
function YourComponent() {
  const {
    messages,              // Current conversation messages
    queuedMessages,        // Messages queued while agent is processing
    status,                // 'READY' | 'PROCESSING'
    abortController,       // Current abort controller (if processing)
    sendMessage,           // Function to send a message
    cancelAgent,           // Function to cancel current agent execution
    clearQueue,            // Function to clear queued messages
    getUserMessageHistory, // Helper to extract user messages
  } = useConversation();
}
```

**Features**:
- Automatic queue processing when agent becomes ready
- Abort controller management for cancellation
- Message ID generation
- Error handling with error messages added to conversation

---

### useMessageHistory

**Purpose**: Manages input history navigation with queue integration.

**Location**: `src/tui/hooks/useMessageHistory.tsx`

**Usage**:
```typescript
import { useMessageHistory } from '../hooks/useMessageHistory.js';

function InputComponent({ value, onChange }: Props) {
  const history = useMessageHistory({
    currentValue: value,
    onChange,
    onQueuePop: handleQueuePop,      // Optional: function to pop from queue
    queuedMessagesCount: 0,           // Optional: number of queued messages
  });

  // Navigate history
  const handled = history.navigate('up', userMessageArray, shouldHandle);

  // Reset history state
  history.reset();

  // Check current position
  console.log(history.historyIndex); // -1 = not navigating
}
```

**Features**:
- Arrow up/down navigation through message history
- Preserves original input when entering history mode
- Integrates with queue (pressing up when at top pops from queue)
- Returns boolean indicating if navigation was handled

---

### useCursorPosition

**Purpose**: Manages cursor position synchronization between absolute (full text) and relative (line + position) coordinates.

**Location**: `src/tui/hooks/useCursorPosition.tsx`

**Usage**:
```typescript
import { useCursorPosition } from '../hooks/useCursorPosition.js';

function MultiLineInput({ value, externalCursorPosition }: Props) {
  const lines = value.split('\n');

  const cursor = useCursorPosition({
    lines,
    externalCursorPosition,  // Optional: set cursor from external source
    onCursorChange,          // Optional: notify parent of cursor changes
  });

  // Update cursor programmatically
  cursor.updateCursorPosition(10, 2); // position 10 on line 2

  // Get absolute position
  const absolute = cursor.getAbsoluteCursorPosition(2, 10);

  // Access current state
  console.log(cursor.editingLine);     // Current line index
  console.log(cursor.cursorPosition);   // Position within line
}
```

**Features**:
- Converts between absolute and relative cursor positions
- Handles external cursor position updates (e.g., from autocomplete)
- Notifies parent component of cursor changes
- Automatic sync when lines array changes

---

### useAutocomplete

**Purpose**: Generic autocomplete logic with keyboard navigation and selection.

**Location**: `src/tui/hooks/useAutocomplete.tsx`

**Usage**:
```typescript
import { useAutocomplete } from '../hooks/useAutocomplete.js';

function AutocompleteComponent({ inputValue }: Props) {
  const autocomplete = useAutocomplete({
    trigger: inputValue.startsWith('/') ? inputValue : null,
    loadSuggestions: async (trigger) => {
      // Return array of suggestions
      return await fetchSuggestions(trigger);
    },
    onSelect: (suggestion, index) => {
      // Handle selection
      console.log('Selected:', suggestion);
    },
    enabled: true, // Optional: enable/disable autocomplete
  });

  // Autocomplete automatically handles:
  // - Tab to complete
  // - Arrow up/down to navigate
  // - Escape to close

  if (!autocomplete.shouldShowAutocomplete) {
    return null;
  }

  return (
    <div>
      {autocomplete.suggestions.map((item, index) => (
        <div key={index} selected={index === autocomplete.selectedIndex}>
          {item}
        </div>
      ))}
    </div>
  );
}
```

**Features**:
- Automatic suggestion loading when trigger changes
- Keyboard navigation (up/down arrows, tab, escape)
- Selection state management
- Built-in keybindings using the existing keys system

---

### useScrollBox

**Purpose**: Manages scrolling behavior with keyboard bindings and auto-scroll.

**Location**: `src/tui/hooks/useScrollBox.tsx`

**Usage**:
```typescript
import { useScrollBox } from '../hooks/useScrollBox.js';

function MessageList({ messages }: Props) {
  const scroll = useScrollBox({
    autoScrollOnChange: true,           // Auto-scroll to bottom on changes
    scrollDependencies: [messages],     // Dependencies to watch
    keybindingsScope: 'messages',       // Keybindings scope name
    enableKeybindings: true,            // Enable/disable keybindings
  });

  return (
    <scrollBox ref={scroll.scrollBoxRef}>
      {messages.map(msg => <Message key={msg.id} {...msg} />)}
    </scrollBox>
  );
}
```

**Features**:
- Auto-scroll to bottom when dependencies change
- Keyboard bindings for:
  - Page up/down scrolling
  - Jump to top/bottom
  - Line-by-line scrolling
- Manual scroll control via exposed functions

**Exposed functions**:
- `scrollBy(delta)` - Scroll by specific amount
- `scrollPage(direction)` - Scroll by page (1 or -1)
- `scrollTop()` - Jump to top
- `scrollBottom()` - Jump to bottom
- `scrollToBottom()` - Same as scrollBottom

---

## Integration Strategy

The refactoring follows a **hybrid approach**:

1. **Start with ConversationProvider**: Wrap TUIApp with ConversationProvider to manage messages, queue, and agent status
2. **Integrate hooks incrementally**: Replace component state one hook at a time
3. **Test after each change**: Ensure functionality works before moving to next component

### Recommended Integration Order

1. **TUIApp**: Wrap with ConversationProvider, use useConversation hook
2. **MessageList**: Integrate useScrollBox hook
3. **InputArea**: Integrate useMessageHistory hook
4. **MultiLineInput**: Integrate useCursorPosition hook
5. **CommandAutocomplete & FileAutocomplete**: Integrate useAutocomplete hook

### Benefits

- **Reduced complexity**: Components focus on rendering, hooks handle logic
- **Better testability**: Hooks can be tested independently
- **Code reuse**: Shared logic extracted into reusable hooks
- **Clearer separation of concerns**: State management vs UI rendering
- **Easier debugging**: State logic centralized in hooks

## File Structure

```
src/tui/hooks/
├── README.md                   # This file
├── useConversation.tsx         # Conversation context and hook
├── useMessageHistory.tsx       # History navigation hook
├── useCursorPosition.tsx       # Cursor position management hook
├── useAutocomplete.tsx         # Generic autocomplete hook
└── useScrollBox.tsx            # Scroll management hook
```

## Next Steps

To complete the refactoring:

1. Update TUIApp to wrap with ConversationProvider
2. Refactor each component to use its respective hook
3. Remove duplicate state management code
4. Add tests for each hook (currently skipped due to test environment setup)
5. Update documentation with real-world usage examples

## Notes

- All hooks follow React hooks best practices
- Hooks use proper dependency arrays to avoid stale closures
- The useConversation hook includes agent lifecycle management
- Keyboard bindings are integrated into hooks where appropriate
- All hooks are TypeScript-first with proper type definitions
