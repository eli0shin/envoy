# Message History Navigation Feature

## Overview
Implement up/down arrow navigation through user message history when input is focused and cursor is on the first/last line.

## Requirements

### Core Behavior
- When input is focused and up arrow is pressed while cursor is on first line:
  - Fill input with last user-submitted message
  - Move cursor to end of line
  - Apply same parsing as Message component (strip user command decorations)

### Navigation Sequence
- **Index mapping**: `-1` = current input, `0` = last message, `1` = second-to-last, etc.
- **Up/Up/Down behavior**: Should navigate -1 → 0 → 1 → 0 (current → last → second-to-last → last)
- **Down arrow**: Move back toward current input (decrease index)
- **Reset on submit**: Clear history index back to -1 when message is submitted

### Edge Cases
- **Empty history**: No navigation if no user messages exist
- **Single message**: Up goes to that message, down returns to current input
- **User starts typing**: Reset to current input mode (index -1)
- **Input changes during navigation**: Preserve new input as "current"

## Implementation Plan

### 1. State Management (TUIApp.tsx)
Add minimal state for history navigation:
```typescript
const [historyIndex, setHistoryIndex] = useState(-1);
const [originalInput, setOriginalInput] = useState('');
```

### 2. Message History Extraction
Create helper function to extract user messages:
```typescript
const getUserMessageHistory = (messages: (CoreMessage & { id: string })[]): string[] => {
  return messages
    .filter(message => message.role === 'user')
    .map(message => {
      let content = typeof message.content === 'string' ? message.content : '';

      // Apply same parsing as Message.tsx
      content = content.replace(/<user-command>(.*?)<\/user-command>/gs, '$1');
      content = content.replace(/<system-hint>.*?<\/system-hint>/gs, '');

      return content.trim();
    })
    .filter(content => content.length > 0);
};
```

### 3. Navigation Logic (InputArea.tsx)
Implement arrow key handler:
```typescript
const handleInputArrowKey = (direction: 'up' | 'down', isOnFirstLine: boolean, isOnLastLine: boolean): boolean => {
  const userHistory = getUserMessageHistory(messages);

  if (direction === 'up' && isOnFirstLine) {
    // Save original input when first entering history mode
    if (historyIndex === -1) {
      setOriginalInput(inputValue);
    }

    const newIndex = historyIndex + 1;
    if (newIndex < userHistory.length) {
      setHistoryIndex(newIndex);
      setInputValue(userHistory[userHistory.length - 1 - newIndex]);
      // Move cursor to end
      return true;
    }
  } else if (direction === 'down' && historyIndex >= 0) {
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);

    if (newIndex >= 0) {
      setInputValue(userHistory[userHistory.length - 1 - newIndex]);
    } else {
      setInputValue(originalInput); // Restore original input
    }
    // Move cursor to end
    return true;
  }

  return false; // Not handled, use default behavior
};
```

### 4. Input Change Handling
Reset history mode when user types:
```typescript
const handleInputChange = (value: string) => {
  setInputValue(value);

  // If user modifies input while in history mode, reset to current input
  if (historyIndex !== -1) {
    setHistoryIndex(-1);
    setOriginalInput(value);
  }
};
```

### 5. Submit Handling
Clear history state on message submission:
```typescript
const handleSendMessage = async (content: string) => {
  // Reset history navigation state
  setHistoryIndex(-1);
  setOriginalInput('');

  // Existing submit logic...
};
```

### 6. MultiLineInput Integration
Extend MultiLineInput to provide line position info:
```typescript
// In MultiLineInput component
const isOnFirstLine = editingLine === 0;
const isOnLastLine = editingLine === lines.length - 1;

// Pass to arrow key callback
onArrowKey?.(direction, isOnFirstLine, isOnLastLine);
```

## Files to Modify

### Required Changes
1. **`src/tui/components/TUIApp.tsx`**
   - Add history state (`historyIndex`, `originalInput`)
   - Add `getUserMessageHistory` helper
   - Reset history state in `handleSendMessage`

2. **`src/tui/components/InputArea.tsx`**
   - Implement `handleInputArrowKey` function
   - Add input change handler to reset history mode
   - Pass arrow key handler to MultiLineInput

3. **`src/tui/components/MultiLineInput.tsx`**
   - Update `onArrowKey` callback signature to include line position
   - Pass `isOnFirstLine`/`isOnLastLine` to callback

### Optional Enhancements
4. **`src/tui/keys/types.ts`**
   - Add `input.historyUp`/`input.historyDown` key actions

5. **`src/tui/keys/defaults.ts`**
   - Add default keybindings for history navigation

## Testing Scenarios

### Basic Navigation
- [ ] Up arrow on first line loads last message
- [ ] Cursor moves to end after navigation
- [ ] Down arrow returns to previous state
- [ ] Navigation wraps correctly at boundaries

### Edge Cases
- [ ] Empty history (no user messages)
- [ ] Single message in history
- [ ] Very long messages
- [ ] Messages with command decorations are cleaned

### State Management
- [ ] History index resets on submit
- [ ] Typing during navigation resets to current input
- [ ] Original input is preserved and restored
- [ ] Navigation state survives input focus changes

### Integration
- [ ] Works with existing multi-line input
- [ ] Doesn't interfere with normal cursor navigation
- [ ] Works with existing keybinding system
- [ ] Persists across app restarts (via message persistence)

## Benefits
- **No state duplication**: Uses existing messages array
- **Automatic sync**: History updates when messages change
- **Consistent parsing**: Same logic as Message display
- **Minimal overhead**: Only tracks navigation index
- **Clean architecture**: Extends existing input callback system