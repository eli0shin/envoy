# Command Autocomplete Implementation Proposal

## Overview

This proposal outlines the implementation of autocomplete functionality for built-in commands and their arguments in the Envoy CLI's Ink-based interactive UI.

## Expected User Experience

### 1. Command Autocomplete

When a user types `/`, the system will:

- Display a suggestion list below the input box showing all available commands
- Filter the list as the user continues typing
- Allow navigation with arrow keys (up/down)
- Allow selection with Tab or Enter
- Dismiss with Escape

Example flow:

```
User types: /h
Shows: /help, /history
User presses Tab → completes to /help
```

### 2. Subcommand/Argument Autocomplete

For commands with arguments:

```
User types: /conversations
Shows: clean, clean-all
User types: /conversations cl
Shows: clean, clean-all (filtered)
User presses Tab → completes to /conversations clean
```

### 3. Visual Design

The autocomplete suggestions appear below the input box with consistent padding and no borders:

```
┌─────────────────────────────────────────┐
│                                         │
│ > /h█                                   │
│                                         │
└─────────────────────────────────────────┘
  /help     - Show available commands
  /history  - Show conversation stats

```

With selection highlighting:

```
┌─────────────────────────────────────────┐
│                                         │
│ > /conversations █                      │
│                                         │
└─────────────────────────────────────────┘
  clean     - Remove old conversations
▸ clean-all - Remove all conversations

```

## Technical Architecture

### 1. Command Metadata Enhancement

Augment the existing `SpecialCommand` type to include argument specifications:

```typescript
// Existing type in interactiveSession.ts
export type SpecialCommand = {
  command: string;
  description: string;
  handler: (_session: InteractiveSession, args?: string) => Promise<void>;
};

// Augment with autocomplete metadata
export type CommandArgument = {
  name: string;
  description: string;
  required: boolean;
  values?: string[]; // For predefined options like ['clean', 'clean-all']
};

// Extend the existing type
export type SpecialCommand = {
  command: string;
  description: string;
  handler: (_session: InteractiveSession, args?: string) => Promise<void>;
  arguments?: CommandArgument[]; // New optional field
};
```

### 2. Autocomplete State Management

Add autocomplete state to the InputPrompt component:

```typescript
type AutocompleteState = {
  isActive: boolean;
  suggestions: string[];
  selectedIndex: number;
  prefix: string;
  position: 'command' | 'argument';
};
```

### 3. UI Layout Structure

The autocomplete UI will be structured as follows:

```typescript
<Box flexDirection="column">
  {/* Existing input box */}
  <Box borderStyle="round" paddingX={1}>
    <InputPrompt />
  </Box>

  {/* Autocomplete suggestions - appears conditionally below */}
  {showAutocomplete && (
    <Box paddingX={1} marginTop={0}>
      <AutocompleteOverlay />
    </Box>
  )}
</Box>
```

### 4. Key Components

#### A. CommandRegistry

- Wraps `getSpecialCommands()` to provide autocomplete functionality
- Provides autocomplete suggestions based on input
- Handles command/argument parsing
- Works with the existing command definitions

#### B. AutocompleteOverlay Component

- Renders the suggestion list below the input box
- Handles keyboard navigation
- No borders, uses consistent padding matching input box
- Positioned as a sibling to the input container

#### C. Enhanced InputPrompt

- Integrates autocomplete functionality
- Manages autocomplete state
- Handles special key bindings (Tab, Escape, Arrow keys)

## Implementation Steps

### Phase 1: Foundation (Refactoring)

1. **Augment existing command definitions** (2-3 hours)

   - Extend `SpecialCommand` type in `interactiveSession.ts`
   - Add `CommandArgument` type definition
   - Update `getSpecialCommands()` to include argument metadata
   - Add argument specifications for commands like `/conversations`

2. **Create CommandRegistry class** (2 hours)
   - Build on top of existing `getSpecialCommands()`
   - Implement suggestion engine using existing command data
   - Add command/argument parsing logic
   - Create tests for registry

### Phase 2: UI Components (Core Feature)

3. **Create AutocompleteOverlay component** (3-4 hours)

   - Implement suggestion list rendering below input box
   - Add keyboard navigation
   - Handle selection events
   - Style with Ink components (no borders, consistent padding)

4. **Enhance InputPrompt component** (4-5 hours)
   - Add autocomplete state management
   - Integrate Tab key handling
   - Implement suggestion filtering
   - Connect to CommandRegistry

### Phase 3: Integration & Polish

5. **Wire up autocomplete flow** (2-3 hours)

   - Connect all components
   - Handle edge cases
   - Add dismiss on Escape
   - Test with all commands

6. **Add comprehensive tests** (2-3 hours)

   - Unit tests for CommandRegistry
   - Integration tests for autocomplete flow
   - Ink component tests

7. **Documentation & cleanup** (1 hour)
   - Update CLAUDE.md
   - Add inline documentation
   - Clean up any technical debt

## Refactoring Opportunities

### 1. Command Organization

- Keep commands in their current location to maintain compatibility
- Add argument metadata alongside existing definitions
- Consider future modularization if command list grows significantly

### 2. Input Handling Abstraction

- Create a KeyboardManager for centralized key handling
- Separate input processing from UI rendering
- Make input handling more testable

### 3. State Management

- Consider using a reducer pattern for complex UI state
- Centralize autocomplete state management
- Make state updates more predictable

## Technical Considerations

### 1. Performance

- Lazy load command suggestions
- Debounce filtering for large command lists
- Minimize re-renders during typing

### 2. Accessibility

- Ensure keyboard-only navigation works smoothly
- Add ARIA labels for screen readers (if Ink supports)
- Maintain focus management

### 3. Styling Consistency

- No borders on autocomplete items (unlike the input box)
- Padding should match the input box (paddingX={1})
- Selected item indicated with color/symbol, not borders
- Maintain visual hierarchy with the input box as primary focus

### 4. Edge Cases

- Handle multiline input scenarios
- Deal with rapid typing/key presses
- Support undo/redo with autocomplete

### 5. Future Extensions

- Command history with up/down arrows
- Fuzzy matching for suggestions
- Command shortcuts/aliases
- Context-aware suggestions

## Estimated Timeline

- Phase 1 (Foundation): 4-5 hours
- Phase 2 (Core Feature): 7-9 hours
- Phase 3 (Polish): 5-6 hours
- **Total: 16-20 hours**

## Success Criteria

1. Users can autocomplete all built-in commands
2. Subcommands/arguments are suggested appropriately
3. Keyboard navigation works intuitively
4. No regression in existing input functionality
5. Test coverage remains above 70%
6. Performance impact is negligible

## Next Steps

1. Review and approve this proposal
2. Create feature branch
3. Begin Phase 1 implementation
4. Regular testing and feedback cycles
5. Final review and merge
