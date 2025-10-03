# OpenTUI Upgrade: 0.1.23 → 0.1.25

**Source:** `/Users/elioshinsky/code/opentui/CHANGELOG-0.1.23-to-0.1.25.md`
**Target versions:** `@opentui/core@0.1.25`, `@opentui/react@0.1.25`
**Current versions:** `@opentui/core@0.1.23`, `@opentui/react@0.1.23`

---

## Required Changes

### 1. **Update package.json dependencies**

**Location:** `/Users/elioshinsky/code/language-learner/package.json:14-15`

**Current:**
```json
"@opentui/core": "^0.1.23",
"@opentui/react": "^0.1.23"
```

**Change to:**
```json
"@opentui/core": "^0.1.25",
"@opentui/react": "^0.1.25"
```

---

### 2. **Test and fix flexShrink default behavior change** ⚠️ HIGH PRIORITY

**BREAKING CHANGE:** `flexShrink` default changed from `0` to `1`
**Impact:** Layouts that relied on implicit `flexShrink: 0` may shrink unexpectedly

**Affected areas:**
- All components using `<box>` without explicit `flexShrink` (ALL TUI components)
- Especially components with explicit widths/heights that should maintain size

**Action required:**
1. Run interactive tests: `bun run test:interactive`
2. Visually inspect all TUI screens for layout issues:
   - Header (src/tui/components/Header.tsx)
   - StatusBar (src/tui/components/StatusBar.tsx)
   - MessageList (src/tui/components/MessageList.tsx)
   - MultiLineInput (src/tui/components/MultiLineInput.tsx)
   - HelpModal (src/tui/components/HelpModal.tsx)
   - FileAutocomplete (src/tui/components/FileAutocomplete.tsx)
   - CommandAutocomplete (src/tui/components/CommandAutocomplete.tsx)
   - All tool formatters in src/tui/toolFormatters/components/
3. Add explicit `flexShrink: 0` to any components that should maintain their size

**Example fix if needed:**
```tsx
// Before (implicit flexShrink: 0):
<box width={80}>Fixed width content</box>

// After (explicit to maintain old behavior):
<box width={80} flexShrink={0}>Fixed width content</box>
```

---

### 3. **Review Input key handling behavior** ⚠️ MEDIUM PRIORITY

**BREAKING CHANGE:** Input renderable now calls `preventDefault()` on keydown
**Impact:** Global key handlers won't receive key events when input is focused

**Affected files:**
- src/tui/components/MultiLineInput.tsx:183-433 (useKeys handlers)
- src/tui/keys/dispatcher.tsx:11 (central keyboard dispatcher)

**Current behavior:**
- Custom `useKeys` hook with scoped handlers
- Input scope has its own key handlers
- Global handlers also exist

**Potential issue:**
- Global handlers may not fire when input is focused (e.g., app.exit, help.toggle)
- Need to verify that Ctrl+C to exit still works during input

**Action required:**
1. Test all global keybindings while input is focused:
   - `Ctrl+C` (app.exit)
   - `Ctrl+E h` (help.toggle)
   - `Ctrl+E c` (global.cancel)
2. If global handlers don't work, may need to add them to input scope or use new preventDefault feature

---

### 4. **Verify hook imports are compatible** ✅ LOW PRIORITY

**CHANGE:** Hook files renamed from .tsx to .ts (internal change)
**Impact:** None - we import from `@opentui/react` not direct files

**Current imports:**
```typescript
import { useKeyboard, useTerminalDimensions, useRenderer, render } from '@opentui/react';
```

**Action required:**
- None - imports are already correct

---

### 5. **Verify TypeScript peer dependency removal** ✅ LOW PRIORITY

**CHANGE:** TypeScript moved from peerDependencies to devDependencies
**Impact:** None - we already have TypeScript installed

**Action required:**
- None - TypeScript is already in devDependencies

---

## Optional Improvements

### 6. **Consider adopting text modifier components** 💡 RECOMMENDED

**New feature:** React text modifiers `<b>`, `<i>`, `<u>`, `<span>`, `<br>`
**Benefit:** Simpler, more declarative text styling

**Current pattern (21 files):**
```tsx
<text>{bold(fg(colors.primary)('Claude Code'))}</text>
<text>{fg(colors.dim)('Exit: Ctrl+C')}</text>
<text>{italic(fg(colors.reasoning)('thinking...')}</text>
```

**Could become:**
```tsx
<text>
  <b><span fg={colors.primary}>Claude Code</span></b>
</text>
<text>
  <span fg={colors.dim}>Exit: Ctrl+C</span>
</text>
<text>
  <i><span fg={colors.reasoning}>thinking...</span></i>
</text>
```

**Affected files:**
- src/tui/utils/markdown.ts (extensive use of fg(), bold(), italic(), underline(), strikethrough())
- src/tui/components/Header.tsx
- src/tui/components/StatusBar.tsx
- src/tui/components/MultiLineInput.tsx
- All tool formatters (13 files)

**Note:** Would require significant refactoring. Consider as future improvement.

---

### 7. **Add text wrapping support** 💡 RECOMMENDED

**New feature:** Text components support `wrap` and `wrapMode` props
**Benefit:** Better text layout for long messages

**Potential usage:**
```tsx
// MessageList.tsx - wrap long assistant messages
<text wrap={true} wrapMode="word">
  {message.content}
</text>

// Tool formatters - wrap long file paths or content
<text wrap={true}>
  {filePath}
</text>
```

**Affected files:**
- src/tui/components/MessageList.tsx (message content display)
- All tool formatters that display file paths/content

**Action required:**
- Test if wrapping improves UX for long messages
- Add `wrap={true}` to text components where appropriate

---

### 8. **Replace manual paste with onPaste handler** 💡 RECOMMENDED

**New feature:** `onPaste` callback for handling pasted text
**Benefit:** Native bracketed paste support, simpler code

**Current implementation:**
- src/tui/components/MultiLineInput.tsx:366-382 (manual paste handling via input.paste keybinding)

**Current code:**
```typescript
parseKeys(key, 'input.paste', async () => {
  try {
    const clipboard = await readClipboard();
    const newLines = [...lines];
    const [lineIdx, charIdx] = cursorPosition;
    const line = newLines[lineIdx] || '';
    newLines[lineIdx] = line.slice(0, charIdx) + clipboard + line.slice(charIdx);
    setLines(newLines);
    setCursorPosition([lineIdx, charIdx + clipboard.length]);
  } catch {
    // ignore
  }
}, 'input')
```

**Could become:**
```tsx
<input
  onPaste={(text) => {
    const newLines = [...lines];
    const [lineIdx, charIdx] = cursorPosition;
    const line = newLines[lineIdx] || '';
    newLines[lineIdx] = line.slice(0, charIdx) + text + line.slice(charIdx);
    setLines(newLines);
    setCursorPosition([lineIdx, charIdx + text.length]);
  }}
/>
```

**Note:** Verify that OpenTUI's Input component supports onPaste. If not, this only applies to custom renderables.

---

### 9. **Adopt testing utilities for TUI tests** 💡 OPTIONAL

**New feature:** `@opentui/core/testing` export with testing utilities
**Benefit:** Better test coverage for TUI components

**Available utilities:**
```typescript
import {
  createTestRenderer,
  createMockKeys,
  createMockMouse,
  createSpy
} from '@opentui/core/testing';
```

**Potential usage:**
- Mock keyboard input for testing MultiLineInput
- Mock mouse clicks for testing interactive components
- Snapshot testing for component output

**Action required:**
- Evaluate if TUI component tests would benefit
- Add tests using testing utilities

---

### 10. **Use preventDefault for better global key handling** 💡 OPTIONAL

**New feature:** Global key handlers can call `preventDefault()` to stop propagation
**Benefit:** More control over key event flow

**Potential usage in dispatcher:**
```typescript
// src/tui/keys/dispatcher.tsx
renderer.keyInput.on('keydown', (event) => {
  if (event.key === 'Ctrl+C') {
    event.preventDefault(); // Stop propagation to input
    handleExit();
  }
});
```

**Action required:**
- Review if custom dispatcher could be simplified with preventDefault
- Consider if it solves any current key handling issues

---

### 11. **Add Kitty keyboard protocol support** 💡 OPTIONAL

**New feature:** Support for keypress, keyrepeat, keyrelease events
**Benefit:** Better keyboard UX in supporting terminals

**Current usage:**
- Only uses 'keydown' events

**Potential usage:**
```typescript
renderer.keyInput.on('keypress', (event) => {
  // Initial key press
});

renderer.keyInput.on('keyrepeat', (event) => {
  // Key is being held down
});

renderer.keyInput.on('keyrelease', (event) => {
  // Key was released
});
```

**Action required:**
- Evaluate if distinguishing press/repeat/release improves UX
- Consider for features like scrolling acceleration

---

### 12. **Leverage data paths for persistent storage** 💡 OPTIONAL

**New feature:** `getDataPaths()` for XDG-compliant storage
**Benefit:** Standard location for app data

**Potential usage:**
```typescript
import { getDataPaths } from '@opentui/core';

const dataPathsManager = getDataPaths();
console.log(dataPathsManager.globalDataPath); // ~/.local/share/opentui
console.log(dataPathsManager.cacheDataPath);  // ~/.cache/opentui
```

**Current state:**
- App uses `env-paths` package for application data
- Located in src/utils/paths.ts

**Action required:**
- Evaluate if switching to opentui's data paths is beneficial
- Consider for future when needing opentui-specific storage

---

## Migration Completed

**Date:** October 3, 2025
**Status:** ✅ SUCCESS

### Changes Made

1. ✅ Updated `package.json` dependencies from 0.1.23 to 0.1.25
2. ✅ Ran `bun install` to install new versions
3. ✅ Fixed markdown rendering double newline issue (not related to upgrade, pre-existing bug)

### Issues Discovered and Fixed

**Double newline between headings and lists** (src/tui/utils/markdown.ts)

This was a pre-existing bug unrelated to the opentui upgrade, but was caught by running tests after the upgrade.

- **Issue:** Headings followed by lists had double newlines instead of single newlines
- **Root cause:** The `parseMarkdown` function adds a leading newline to lists, but doesn't check if previous content already ends with a newline
- **Fix:** Added logic in `parseMarkdown` to detect when a list follows content that ends with newline, and skip the list's leading newline chunk

### Test Results

✅ All unit tests passing (1061/1061)
✅ All interactive tmux tests passing (6/6)

### Testing Checklist

After upgrading, verified:

- [x] All layouts render correctly (especially with flexShrink default change)
- [x] Header displays properly at top
- [x] StatusBar displays properly at bottom
- [x] MessageList scrolling works correctly
- [x] MultiLineInput maintains correct size
- [x] Modals display at correct size and position
- [x] Autocomplete popups position correctly
- [x] Tool formatter messages display correctly
- [x] Global keybindings work (Ctrl+C to exit)
- [x] Global keybindings work while input is focused
- [x] Help modal (Ctrl+E h) works
- [x] Agent cancel (Ctrl+E c) works
- [x] Message scrolling works (Page Up/Down, g/G)
- [x] Input keybindings work (arrows, newline, submit, clear)
- [x] Autocomplete navigation works (Tab, arrows, Escape)
- [x] Text styling displays correctly (colors, bold, italic)
- [x] All interactive tests pass: `bun run test:interactive`

### Observations

**No regressions detected from the opentui upgrade.**

The flexShrink default change from 0 to 1 did not affect this codebase because:
- Most layouts use explicit flexGrow: 1 for expanding components
- Fixed-size components (Header, StatusBar) have explicit heights
- The TUI layout structure already handles sizing correctly

The Input preventDefault behavior change also had no impact:
- The custom key handling system uses scoped handlers via the dispatcher
- Global handlers are properly integrated with input scope
- Exit behavior (Ctrl+C) works correctly even when input is focused

---

## References

- **Changelog:** `/Users/elioshinsky/code/opentui/CHANGELOG-0.1.23-to-0.1.25.md`
- **OpenTUI Core Docs:** `/Users/elioshinsky/code/opentui/packages/core/docs/`
- **Tree-sitter Guide:** `/Users/elioshinsky/code/opentui/packages/core/docs/tree-sitter.md`
- **Environment Variables:** `/Users/elioshinsky/code/opentui/packages/core/docs/env-vars.md`
- **Testing Utilities:** `/Users/elioshinsky/code/opentui/packages/core/src/testing/README.md`
