# Multi-Line Input Support Design Document

## Overview

This document outlines the design and implementation plan for adding multi-line input support to the CLI agent's interactive mode. Currently, the CLI agent only supports single-line input, which significantly limits the user experience when working with longer prompts, code blocks, or structured data.

## Problem Statement

### Current Limitations

- **Single-line input only**: The Enter key always submits the message
- **No multi-line editing**: Users cannot input code blocks, structured data, or long-form text
- **Limited text editing**: Basic cursor movement and character insertion/deletion only
- **Poor user experience**: Users must work around the single-line constraint

### User Impact

- **Reduced prompt quality**: Users cannot easily input well-structured, detailed prompts
- **Code sharing difficulty**: No easy way to share code snippets or configuration files
- **Workflow interruptions**: Users must use external tools to prepare complex inputs

## Research Findings

### Current Implementation Analysis

The current input system is implemented in `src/ui/components/InputPrompt.tsx`:

- **Framework**: React Ink for terminal UI
- **Input handling**: Uses `useInput` hook for keyboard events
- **Text storage**: Single string value with 1D cursor positioning
- **Key bindings**: Enter submits, arrow keys for navigation, basic text editing

### Industry Patterns

Research across various applications reveals common patterns:

#### CLI Applications

- **Heredoc patterns**: Multi-line input using delimiter syntax
- **Line continuation**: Backslash for command continuation
- **Interactive editors**: Ctrl+X Ctrl+E to open external editor

#### Chat Applications

- **Discord**: Enter sends, Shift+Enter for new lines
- **Slack**: Configurable Enter behavior (send vs. new line)
- **Telegram**: Shift+Enter for new lines, configurable send key

#### Code Editors

- **VSCode**: Enter for new lines, Ctrl+Enter for special actions
- **Terminal editors**: Standard text editing patterns

### Key Insights

1. **User expectations**: Most users expect Ctrl+Enter or Shift+Enter patterns
2. **Visual feedback**: Line numbers and continuation indicators improve usability
3. **Configurable behavior**: Users prefer customizable key bindings
4. **Graceful degradation**: Single-line mode should remain for simple inputs

## Design Requirements

### Functional Requirements

1. **Multi-line text input**: Support for entering text across multiple lines
2. **Intuitive key bindings**: Follow established patterns for line breaks and submission
3. **Visual feedback**: Clear indication of multi-line mode and line structure
4. **Editing capabilities**: Full cursor navigation and text manipulation
5. **Mode switching**: Seamless transition between single-line and multi-line modes

### Non-Functional Requirements

1. **Performance**: Smooth operation with large inputs (1000+ lines)
2. **Responsiveness**: No noticeable lag during typing or navigation
3. **Accessibility**: Screen reader compatibility and keyboard navigation
4. **Cross-platform**: Consistent behavior across different terminals and OS

### User Experience Requirements

1. **Discoverability**: Users should easily discover multi-line capabilities
2. **Flexibility**: Support for different input patterns and use cases
3. **Error recovery**: Graceful handling of edge cases and invalid inputs
4. **Backward compatibility**: Existing single-line workflows remain unchanged

## User Interface Design

### Key Bindings

**Primary Option (Recommended)**:

**Windows/Linux:**

- **Enter**: Create new line
- **Ctrl+Enter**: Submit message
- **Shift+Enter**: Alternative for new line (compatibility)

**Mac:**

- **Enter**: Create new line
- **Cmd+Enter**: Submit message
- **Shift+Enter**: Alternative for new line (compatibility)

**Alternative Option**:

**Windows/Linux:**

- **Enter**: Submit message (current behavior)
- **Shift+Enter**: Create new line
- **Ctrl+Enter**: Submit message (redundant)

**Mac:**

- **Enter**: Submit message (current behavior)
- **Shift+Enter**: Create new line
- **Cmd+Enter**: Submit message (redundant)

### Visual Design

#### Single-Line Mode (Current)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ > Hello, how can I help you?                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Multi-Line Mode (Proposed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1 > Hello, I need help with implementing                                     │
│ 2   a complex feature that requires                                          │
│ 3   multiple lines of explanation.                                           │
│                                                                             │
│ Multi-line mode • Ctrl+Enter to send                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Features

- **Line numbers**: Show line numbers for multi-line content
- **Mode indicator**: Display current mode and send instructions
- **Dynamic height**: Input box expands to accommodate content
- **Cursor visualization**: 2D cursor position indication

### Mode Detection

1. **Automatic detection**: When user types or pastes content with newlines
2. **Manual activation**: Keyboard shortcut (Ctrl+M) to toggle multi-line mode
3. **Visual feedback**: Mode indicator shows current state

## Technical Implementation

### Data Structure Changes

#### Current Structure

```typescript
// Single-line input
const [cursorPosition, setCursorPosition] = useState<number>(0);
const value: string; // Single string value
```

#### Proposed Structure

```typescript
// Multi-line input
type CursorPosition = {
  row: number;
  col: number;
};

type InputState = {
  lines: string[];
  cursor: CursorPosition;
  mode: 'single' | 'multi';
};
```

### Core Components

#### 1. InputPrompt.tsx (Major Refactor)

- **Text rendering**: Support for multi-line text display
- **Cursor management**: 2D cursor positioning and navigation
- **Input handling**: Enhanced keyboard event processing
- **Mode switching**: Dynamic mode detection and switching

#### 2. Text Utilities (New)

```typescript
// Text manipulation functions
export const splitLines = (text: string): string[] => {
  /* ... */
};
export const joinLines = (lines: string[]): string => {
  /* ... */
};
export const insertAtCursor = (
  lines: string[],
  cursor: CursorPosition,
  text: string
): [string[], CursorPosition] => {
  /* ... */
};
export const deleteAtCursor = (
  lines: string[],
  cursor: CursorPosition
): [string[], CursorPosition] => {
  /* ... */
};
```

#### 3. Cursor Navigation (New)

```typescript
// Cursor movement functions
export const moveCursorUp = (
  lines: string[],
  cursor: CursorPosition
): CursorPosition => {
  /* ... */
};
export const moveCursorDown = (
  lines: string[],
  cursor: CursorPosition
): CursorPosition => {
  /* ... */
};
export const moveCursorToLineStart = (
  cursor: CursorPosition
): CursorPosition => {
  /* ... */
};
export const moveCursorToLineEnd = (
  lines: string[],
  cursor: CursorPosition
): CursorPosition => {
  /* ... */
};
```

### Key Binding Implementation

```typescript
useInput((input, key) => {
  if (key.return) {
    if (key.ctrl || key.meta) {
      // Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac): Submit message
      onSubmit(joinLines(lines));
      resetInput();
    } else {
      // Enter: New line
      const [newLines, newCursor] = insertAtCursor(lines, cursor, '\n');
      setLines(newLines);
      setCursor(newCursor);
      setMode('multi');
    }
  } else if (key.upArrow) {
    setCursor(moveCursorUp(lines, cursor));
  } else if (key.downArrow) {
    setCursor(moveCursorDown(lines, cursor));
  }
  // ... other key handlers
});
```

### Performance Considerations

1. **Efficient text operations**: Use immutable operations with structural sharing
2. **Lazy rendering**: Only render visible lines for large inputs
3. **Debounced updates**: Batch rapid key presses to avoid excessive re-renders
4. **Memory management**: Implement line limits for extremely large inputs

## Implementation Phases

### Phase 1: Core Multi-Line Support (2-3 weeks)

- [ ] Implement multi-line text storage and cursor management
- [ ] Add basic Enter → new line, Ctrl+Enter → send functionality
- [ ] Create 2D cursor navigation (arrow keys)
- [ ] Update text rendering for multi-line display
- [ ] Basic mode detection and switching

### Phase 2: Enhanced UI/UX (1-2 weeks)

- [ ] Add visual mode indicator and line numbers
- [ ] Implement scrolling for inputs exceeding terminal height
- [ ] Add proper text wrapping and terminal size handling
- [ ] Enhanced visual feedback and styling
- [ ] Improve cursor visualization

### Phase 3: Advanced Features (1-2 weeks)

- [ ] Add configuration options for key bindings
- [ ] Implement advanced navigation (Home/End, Ctrl+Home/End)
- [ ] Add paste handling and format preservation
- [ ] Optimize performance for large inputs
- [ ] Add undo/redo functionality

### Phase 4: Testing & Polish (1 week)

- [ ] Comprehensive test suite implementation
- [ ] Edge case handling and error recovery
- [ ] Performance testing and optimization
- [ ] Documentation and user guides
- [ ] User acceptance testing

## Testing Strategy

### Unit Tests

- **Text manipulation functions**: Test all utility functions with various inputs
- **Cursor navigation**: Verify correct cursor movement in all scenarios
- **Input validation**: Test handling of edge cases and malformed input
- **State management**: Verify proper state transitions and updates

### Integration Tests

- **Component rendering**: Test InputPrompt with various multi-line content
- **Key binding handling**: Verify all keyboard shortcuts work correctly
- **State propagation**: Test communication between components
- **Theme integration**: Verify styling works with different themes

### Interactive Tests

Using the existing PTY testing framework:

- **Multi-line input flow**: Test entering and sending multi-line content
- **Navigation testing**: Test cursor movement and text editing
- **Mode switching**: Test automatic and manual mode transitions
- **Copy-paste scenarios**: Test pasting large multi-line content

### Performance Tests

- **Large input handling**: Test with 1000+ lines of content
- **Memory usage**: Monitor memory consumption with large inputs
- **Rendering performance**: Measure render times for different input sizes
- **Responsiveness**: Verify no noticeable lag during typing

## Edge Cases and Error Handling

### Terminal Size Constraints

- **Narrow terminals**: Graceful handling of very small widths
- **Height limits**: Scrolling when input exceeds terminal height
- **Resize events**: Dynamic layout adjustment during terminal resize

### Input Validation

- **Special characters**: Proper handling of Unicode, emojis, control characters
- **Mixed line endings**: Normalize different line ending types (\n, \r\n, \r)
- **Large inputs**: Memory and performance limits for very large content

### Error Recovery

- **Malformed input**: Graceful handling of corrupted or invalid text
- **State corruption**: Recovery mechanisms for inconsistent state
- **Terminal limitations**: Fallback behavior for unsupported terminals

## Configuration Options

### User Settings

```json
{
  "multilineInput": {
    "enabled": true,
    "keyBindings": {
      "newLine": "Enter",
      "submit": "Ctrl+Enter", // Windows/Linux
      "submitMac": "Cmd+Enter" // Mac
    },
    "ui": {
      "showLineNumbers": true,
      "showModeIndicator": true,
      "maxLines": 1000
    }
  }
}
```

### Default Behavior

- **Multi-line mode**: Enabled by default
- **Key bindings**: Enter for new line, Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac) to send
- **Visual indicators**: Line numbers and mode indicator enabled
- **Performance limits**: 1000 line maximum for performance

## Success Metrics

### User Experience

- **Adoption rate**: Percentage of users utilizing multi-line input
- **User satisfaction**: Feedback scores for input experience
- **Task completion**: Improved success rate for complex prompts

### Technical Performance

- **Response time**: No measurable degradation in input responsiveness
- **Memory usage**: Memory consumption within acceptable limits
- **Test coverage**: 100% code coverage for new functionality

### Quality Metrics

- **Bug reports**: Minimal issues reported in production
- **Accessibility**: Full keyboard navigation and screen reader support
- **Cross-platform**: Consistent behavior across all supported platforms

## Future Enhancements

### Advanced Features

- **Syntax highlighting**: Code highlighting for different languages
- **Auto-completion**: Intelligent suggestions based on context
- **Snippet support**: Pre-defined text snippets for common patterns
- **Template system**: Reusable prompt templates

### Integration Opportunities

- **External editors**: Integration with system text editors
- **File import**: Direct file loading into input area
- **Format conversion**: Automatic format detection and conversion
- **Collaboration**: Shared editing capabilities

## Conclusion

This design document provides a comprehensive plan for implementing multi-line input support in the CLI agent. The proposed solution addresses current limitations while maintaining backward compatibility and following established UX patterns. The phased implementation approach ensures manageable development cycles and thorough testing.

The key to success will be maintaining the intuitive user experience while providing the flexibility users need for complex AI interactions. By following industry standards and implementing robust testing, this enhancement will significantly improve the overall user experience of the CLI agent.

## References

- [CLI Design Guidelines](https://clig.dev/)
- [React Ink Documentation](https://github.com/vadimdemedes/ink)
- [Terminal UI Best Practices](https://github.com/rothgar/awesome-tuis)
- [Accessibility Guidelines for CLI](https://www.w3.org/WAI/WCAG21/Understanding/)
