# TUI Keybindings: Design and Implementation

## Goals

- Centralize keyboard handling with semantic actions (e.g., `messages.scrollPageUp`) instead of hardcoding physical keys.
- Support configurable key descriptors (e.g., `C-u`, `S-enter`, `tab`) that map to actions per UI scope.
- Provide defaults and allow user overrides via `config.keybindings`.
- Avoid double-handling of keys by multiple components using a single dispatcher and a priority system.

## Concepts

- Action: string identifiers for intents (e.g., `app.exit`, `help.toggle`, `input.submit`).
- Scope: where an action applies; one of `global`, `modal`, `autocomplete`, `input`, `messages`.
- Descriptor grammar:
  - Modifiers: `C-` (Ctrl), `S-` (Shift), `M-` (Alt/Meta), `Cmd-` (Command/macOS).
  - Keys: `a`..`z`, digits, named keys (`enter`, `return`, `escape`, `tab`, `up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown`, `backspace`, `delete`).
  - Aliases: `esc` ↔ `escape`, `return` ↔ `enter`, `pgup` ↔ `pageup`, `pgdown` ↔ `pagedown`.
- Binding config shape: `Record<Scope, Record<Action, string | string[]>>`.

## API

- `KeyScope`: `'global' | 'modal' | 'autocomplete' | 'input' | 'messages'`.
- `KeyAction`: union of string literals for actions.
- `parseKeyDescriptor(descriptor: string): (ev) => boolean`
  - Compiles a descriptor into a matcher against `{ name, ctrl, shift, alt, meta }` key events from `@opentui/react`.
- `mergeKeybindings(defaults, overrides)`
  - Deep-merge per-scope, per-action; arrays and strings both supported.
- `KeybindingsRegistry`
  - `set(bindings)`, `getDescriptors(scope, action)`, `getMatchers(scope)`.
- `KeyEventBus` (singleton)
  - A registry of active handlers with `{ scope, priority, enabled, handle(ev): boolean }`.
  - Dispatch order: higher `priority` first; stop on first `true`.
- `KeyDispatcher` (React component)
  - The only place that calls `useKeyboard` from `@opentui/react`.
  - On each key event, delegates to `KeyEventBus.dispatch(ev)`.
- `useKeys(handler, { scope, enabled, priority })`
  - Registers/unregisters a handler in `KeyEventBus`.
- `parseKeys(ev, action, onMatch, { scope })`
  - Helper that checks the current registry for the given `scope` + `action`, and runs `onMatch()` if any descriptor matches the event. Returns `true` if handled.

## Default Actions and Bindings

- Global
  - `app.exit`: `C-c`
  - `help.toggle`: `?`, `f1`
- Modal
  - `modal.close`: `escape`
- Input
  - `input.submit`: `enter`
  - `input.newline`: `S-enter`
  - `input.cursorUp`: `up`
  - `input.cursorDown`: `down`
- Autocomplete
  - `command.accept`: `tab`
  - `command.prev`: `up`
  - `command.next`: `down`
  - `command.close`: `escape`
- Messages
  - `messages.scrollPageUp`: `C-u`, `pageup`
  - `messages.scrollPageDown`: `C-d`, `pagedown`
  - `messages.scrollTop`: `home`
  - `messages.scrollBottom`: `end`

## Priorities

Default priority by scope (higher first):

- `modal`: 100
- `autocomplete`: 80
- `input`: 60
- `messages`: 40
- `global`: 20

Rationale: When autocomplete suggestions are visible, they should capture arrow/tab over the input. Modals supersede everything.

## Integration Plan

1. Implement keys module under `src/tui/keys/`:
   - `types.ts`, `parser.ts`, `config.ts`, `registry.ts`, `bus.ts`, `useKeys.ts`, `dispatcher.tsx`, `defaults.ts`.
2. Extend `config/types.ts` with an optional `keybindings` field: `Record<string, Record<string, string | string[]>>`.
3. Initialize the registry in TUI: load defaults, merge `config.keybindings` overrides.
4. Add `<KeyDispatcher />` to the app root so only one `useKeyboard` subscription exists.
5. Migrate components:
   - `TUIApp`: replace `C-c` with `useKeys` + `parseKeys('app.exit')`.
   - `CommandAutocomplete`: replace direct `useKeyboard` with `useKeys` for tab/up/down/escape.
   - `MultiLineInput`: replace direct `useKeyboard` with `useKeys` for enter/newline/up/down/tab handoff, keep existing editing/backspace logic.
   - `MessageList`: add scroll handlers using `useKeys` for page/top/bottom.

## Testing

- Unit tests for keys module:
  - Descriptor parsing and matching.
  - Merge semantics for overrides.
  - Event bus registration, priority order, and stop-on-first-handled.
  - `parseKeys` correctness against registry state.
- Mock only `useKeyboard` from `@opentui/react` in tests that need dispatching; other parts use real implementations.

## Prefix Keys

- Purpose: enable two-step combos like `<leader>?`, where a prefix key (e.g., `C-e`) is pressed first, and the following key completes the action.

- Config:
  - `keybindings.prefixes`: `{ [name: string]: string | string[] }` (e.g., `{ "leader": "C-e" }`).
  - `keybindings.prefixCancel`: `string | string[]` (default: `escape`).
  - Defaults: `leader` is mapped to `C-e`.

- Descriptors:
  - Prefixed descriptors use angle-bracket notation: `<leader>?`, `<leader>S-enter`, etc.
  - Non-prefixed descriptors are disabled while a prefix is active.

- Behavior:
  - Activation: pressing a configured prefix key sets the active prefix and consumes the key.
  - Completion: if the next key matches any `<prefix>...` binding (across scopes), dispatch to normal handlers, then clear prefix and consume the key.
  - Cancel: pressing a cancel key or the same prefix again clears the prefix and consumes the key.
  - Unmatched: if the next key does not match any `<prefix>...` binding, cancel the prefix and consume the key (do not dispatch to handlers).

- Implementation Notes:
  - The parser recognizes `<name>` descriptors and requires `activePrefix === name` to match; non-prefixed matchers return false while a prefix is active.
  - The dispatcher enforces the unmatched-cancels rule: when a prefix is active and no prefixed match exists for the key, it cancels and does not dispatch to the event bus.
