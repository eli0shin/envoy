# Claude Code Hooks Integration Plan

## Overview

Add support for Claude Code-compatible hooks to Envoy: SessionStart (startup/resume/clear/compact) and PostToolUse (for filesystem_edit_file and filesystem_write_file).

**References:**

- TypeScript SDK: https://docs.claude.com/en/docs/claude-code/sdk/sdk-typescript
- Hooks Reference: https://docs.claude.com/en/docs/claude-code/hooks

---

## 1. Configuration Schema

### Files to Modify

- `src/config/schema.ts` - Add Zod schemas
- `src/config/types.ts` - Add TypeScript types

### New Types

```typescript
type HookConfig = {
  SessionStart?: SessionStartHook[];
  PostToolUse?: PostToolUseHook[];
};

type SessionStartHook = {
  matcher?: 'startup' | 'resume' | 'clear'; // omitted = all
  command: string;
};

type PostToolUseHook = {
  matcher: string; // regex pattern for tool names
  command: string;
};

type SessionStartInput = {
  session_id: string;
  transcript_path?: string; // absolute path to JSONL (omit if not available)
  cwd: string;
  hook_event_name: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact';
  permission_mode?: string;
};

type PostToolUseInput = {
  session_id: string;
  transcript_path?: string; // absolute path to JSONL (omit if not available)
  cwd: string;
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
};

type PostToolUseOutput = {
  continue?: boolean; // default: true
  stopReason?: string;
  suppressOutput?: boolean; // default: false
  decision?: 'block'; // provides automated feedback to Claude
  reason?: string; // explanation shown when decision: "block"
  systemMessage?: string; // warning message shown to user
  hookSpecificOutput?: {
    hookEventName: 'PostToolUse';
    additionalContext?: string; // context added to next Claude prompt
  };
};
```

### Zod Validation

- Validate matcher patterns compile as valid regex (PostToolUse)
- Validate SessionStart matcher values are 'startup' | 'resume' | 'clear' | 'compact'
- Validate command is a non-empty string
- Do NOT validate command existence (commands may rely on $PATH, npm scripts, etc.)

---

## 2. Hook Execution Module

### New File: `src/hooks/executor.ts`

**Responsibilities:**

- Spawn external commands with timeout
- Parse command string into command + args
- Pass JSON input via stdin
- Capture stdout/stderr (raw - no JSON parsing at this level)
- Handle errors gracefully

**Key Functions:**

```typescript
executeHookCommand(
  commandString: string,
  input: SessionStartInput | PostToolUseInput
): Promise<HookExecutionResult>

type HookExecutionResult = {
  success: boolean;
  stdout: string; // Raw stdout - JSON parsing done by caller
  stderr: string;
  exitCode: number;
  error?: string;
}
```

**Implementation Details:**

- Use **Bun.spawn** since this is a Bun project
- Parse command string with shell-aware tokenizer:
  - **Problem:** Simple `split(/\s+/)` breaks with quoted args: `node "./scripts/my hook.ts" --arg "value with spaces"`
  - **Solution:** Use shell-parsing library (e.g., `string-argv` package)
  - Alternative: Accept `string[]` in config instead of string (more explicit, no parsing needed)
  - Example: `"node scripts/foo.js --arg"` → `["node", "scripts/foo.js", "--arg"]`
  - Example with quotes: `'node "./my script.ts" --flag "value"'` → `["node", "./my script.ts", "--flag", "value"]`
- Stream JSON input via stdin: `JSON.stringify(input)`
- Collect stdout/stderr buffers
- Wait for process to complete (no timeout)
- Never throw - return error in result object
- **JSON parsing is NOT done here** - caller (sessionStart/postToolUse) handles parsing

**Recommended Approach:** Use `string-argv` npm package for shell-aware parsing

---

## 3. SessionStart Hooks

### New File: `src/hooks/sessionStart.ts`

**Key Function:**

```typescript
executeSessionStartHooks(
  config: RuntimeConfiguration,
  sessionId: string,
  conversationPath: string, // absolute path to JSONL
  source: 'startup' | 'resume' | 'clear'
): Promise<string> // returns combined stdout to add to user message
```

**Implementation:**

1. Filter hooks by matcher (if specified)
2. Execute all matching hooks **sequentially in config file order** (NOT parallel)
   - Use `for...of` loop, await each hook before starting next
   - Sequential execution allows hooks to depend on each other (e.g., format then test)
3. Collect stdout from successful hooks
4. Log warnings for failed hooks (but continue with remaining hooks)
5. Combine all stdout with newlines
6. Return combined output

**Error Handling:**

- Failed hooks log warnings but don't stop execution
- Empty output returns empty string
- Invalid JSON in hook output is treated as plain text

---

## 4. PostToolUse Hooks

### New File: `src/hooks/postToolUse.ts`

**Key Function:**

```typescript
executePostToolUseHooks(
  config: RuntimeConfiguration,
  sessionId: string,
  conversationPath: string, // absolute path to JSONL
  toolName: string,
  toolInput: unknown,
  toolResponse: unknown
): Promise<CombinedPostToolUseResult>

type CombinedPostToolUseResult = {
  shouldContinue: boolean; // false if any hook said continue: false
  stopReason?: string; // from first hook that stopped
  additionalContexts: string[]; // all additionalContext values from hookSpecificOutput
  systemMessages: string[]; // all systemMessage values
  observationalOutput: string[]; // plain text outputs (only if !suppressOutput)
}
```

**IMPORTANT - Stdout Purity Requirement:**

PostToolUse hooks that want to return JSON (with `additionalContext`, `continue`, `stopReason`, `decision`, `reason`, or `suppressOutput`) **MUST** output pure JSON on stdout. Any other output (from child processes, logging, etc.) will pollute stdout and break JSON parsing.

**Hook Author Guidelines:**

- Use `stdio: 'pipe'` when spawning child processes to suppress their output
- Send debug/error messages to stderr, not stdout: `console.error()`
- Only write JSON to stdout: `console.log(JSON.stringify(...))`
- If hook outputs plain text (no JSON), entire stdout becomes observational output

**Implementation:**

1. Find hooks with matchers that match tool name (regex test)
2. Execute all matching hooks **sequentially in config file order** (NOT parallel)
   - Use `for...of` loop, await each hook before starting next
   - Sequential execution matters for dependent hooks (e.g., format then test)
3. Parse each hook's stdout:
   - Try to parse as JSON for PostToolUseOutput structure
   - If not valid JSON, treat as observational output
4. Combine results:
   - `shouldContinue = false` if any hook returned `continue: false`
   - Collect all `additionalContext` values from `hookSpecificOutput`
   - Collect all `systemMessage` values
   - Collect plain text outputs **only if** hook didn't set `suppressOutput: true`
   - Stop processing remaining hooks if `continue: false` encountered
5. Return combined result

**Regex Matching:**

- Compile matcher as regex: `new RegExp(matcher)`
- Test against tool name: `regex.test(toolName)`
- Invalid regex patterns caught during config validation

---

## 5. Integration Points

### A. SessionStart Integration

#### File: `src/cli/handlers/interactiveMode.ts`

**Location:** Before first `runAgent` call
**Change:** Add hook output to initial user message

```typescript
// After session initialization
const conversationPath =
  session.conversationPersistence ?
    getProjectConversationFile(
      session.projectIdentifier,
      session.conversationPersistence.getSessionId()
    )
  : undefined;

const hookOutput = await executeSessionStartHooks(
  config,
  session.conversationPersistence.getSessionId(),
  conversationPath,
  'startup'
);

// Modify initial message
if (hookOutput) {
  initialMessage = `${hookOutput}\n\n${initialMessage}`;
}
```

#### File: `src/cli/handlers/executionFlow.ts`

**Location:** Before `runAgent` for new sessions
**Same pattern as above**
**Source:** `'startup'`

#### File: `src/cli/resume.ts`

**Location:** After loading conversation, before continuing
**Source:** `'resume'`

#### File: `src/tui/components/TUIApp.tsx`

**Location:** Inside `onClear` callback (after `persistMessages([])`)
**Source:** `'clear'`

```typescript
onClear: async () => {
  setMessages([]);
  // Clear persisted conversation if available
  if (session.conversationPersistence) {
    await session.conversationPersistence.persistMessages([]);
  }

  // Execute SessionStart hooks with 'clear' source
  const conversationPath =
    session.conversationPersistence ?
      getProjectConversationFile(
        session.projectIdentifier,
        session.conversationPersistence.getSessionId()
      )
    : undefined;

  const hookOutput = await executeSessionStartHooks(
    config,
    session.conversationPersistence.getSessionId(),
    conversationPath,
    'clear'
  );

  // Hook output could be logged or ignored for 'clear' events
  if (hookOutput) {
    logger.debug('Clear hook output', { output: hookOutput });
  }
};
```

---

### B. PostToolUse Integration

#### File: `src/agent/index.ts`

**Location:** After line 169 (after `persistMessages`)

```typescript
// After persisting tool results
if (toolResults.length > 0) {
  const conversationPath =
    session.conversationPersistence ?
      getProjectConversationFile(
        session.projectIdentifier,
        session.conversationPersistence.getSessionId()
      )
    : undefined;

  for (const toolResult of toolResults) {
    const hookResult = await executePostToolUseHooks(
      config,
      session.conversationPersistence?.getSessionId() || '',
      conversationPath,
      toolResult.toolName,
      toolResult.args,
      toolResult.result
    );

    // Handle stop request
    if (!hookResult.shouldContinue) {
      logger.info('Hook requested stop', {
        stopReason: hookResult.stopReason,
      });

      return {
        success: false,
        error: hookResult.stopReason || 'Stopped by hook',
        toolCallsCount,
        executionTime: Date.now() - startTime,
        messages,
        responseMessages: response?.messages || [],
      };
    }

    // Add additional context to next LLM request
    // Note: additionalContext goes into the prompt context, not as user messages
    // Implementation depends on how the agent loop handles context injection
    for (const context of hookResult.additionalContexts) {
      // TODO: Determine best way to inject context into next model request
      // Option 1: Add as user message (simple but visible in transcript)
      // Option 2: Inject into system prompt or context window (cleaner)
      const contextMessage: ModelMessage = {
        role: 'user',
        content: context,
      };
      messages.push(contextMessage);

      // Notify interactive UI of new message
      if (onMessageUpdate) {
        onMessageUpdate(contextMessage);
      }

      // Log as context injection
      if (!config.json) {
        logger.logUserStep(context);
      }
    }

    // Display system messages to user
    for (const sysMsg of hookResult.systemMessages) {
      logger.warn('Hook system message', { message: sysMsg });
    }

    // Log observational output (only present if hook didn't set suppressOutput: true)
    for (const output of hookResult.observationalOutput) {
      logger.debug('Hook observational output', { output });
    }
  }

  // Persist any new context messages from hooks
  await session.conversationPersistence?.persistMessages(messages);
}
```

---

## 6. Path Resolution

### New Utility Function

**File:** `src/hooks/pathResolver.ts` (or add to existing module)

```typescript
function getConversationAbsolutePath(
  projectIdentifier: string,
  sessionId: string
): string {
  // Use existing getProjectConversationFile but ensure absolute path
  return getProjectConversationFile(projectIdentifier, sessionId);
}
```

**Note:** `getProjectConversationFile` from `src/logger.ts` already returns absolute paths, so just use it directly.

---

## 7. Error Handling

### Principles

- Hook failures never stop agent execution (except explicit `continue: false`)
- All hook errors logged as warnings
- Invalid configurations caught at startup
- No timeouts - hooks run until completion

### Specific Cases

**Config validation errors:**

- Invalid regex in matcher → Error on config load
- Invalid SessionStart matcher value → Error on config load
- Missing/empty command string → Error on config load
- Command not found at runtime → Log warning, continue

**Runtime errors:**

- Hook command not found → Log warning, continue
- Hook non-zero exit → Log warning, continue (unless PostToolUse returns continue: false)
- Invalid JSON output (PostToolUse) → Treat as plain text, continue
- Mixed output (stdout contains non-JSON) → Attempt JSON parse, treat as plain text on failure

---

## 8. Logging

### New Log Methods (if needed)

- `logger.debug('Hook execution started', { hookType, command })`
- `logger.debug('Hook execution completed', { hookType, exitCode, duration })`
- `logger.warn('Hook execution failed', { hookType, error })`

### What to Log

- Hook start/completion (debug level)
- Hook failures (warn level)
- Hook stop requests (info level)
- User messages from hooks (as user steps)

---

## 9. Testing Strategy

### Unit Tests

#### `src/hooks/executor.test.ts`

- Parse simple command strings: `"node script.js"` → `["node", "script.js"]`
- Parse commands with quoted paths: `'node "./my script.ts"'` → `["node", "./my script.ts"]`
- Parse commands with quoted arguments: `'node script.js --arg "value with spaces"'`
- Execute command with Bun.spawn
- Pass JSON input via stdin
- Capture raw stdout (no JSON parsing)
- Capture raw stderr
- Handle command not found
- Handle non-zero exit codes
- Wait for command completion without timeout

#### `src/hooks/sessionStart.test.ts`

- Filter hooks by matcher ('startup', 'resume', 'clear', or undefined for all)
- Execute multiple hooks sequentially in config order
- Combine stdout from hooks
- Handle hook failures gracefully (warn but continue)
- Return empty string when no hooks

#### `src/hooks/postToolUse.test.ts`

- Match hooks by regex pattern against tool names
- Execute multiple hooks sequentially in config order
- Parse JSON responses from stdout
- Combine multiple additionalContext values from hookSpecificOutput
- Collect systemMessage values
- Detect continue: false and stop processing remaining hooks
- Handle mixed JSON and plain text output
- Respect suppressOutput flag (exclude from observationalOutput when true)
- Stop executing hooks after first continue: false

### Integration Tests

#### `src/agent/agent.hooks.test.ts`

- SessionStart hook output added to first message
- PostToolUse hook stops execution with continue: false
- PostToolUse hook adds context via additionalContext and calls onMessageUpdate
- PostToolUse hook displays systemMessage to user
- Multiple PostToolUse hooks execute sequentially and combine outputs
- PostToolUse hooks with suppressOutput: true don't appear in logs
- Hook failures don't break agent loop

### Interactive Tests

#### `interactive-tests/hooks-test.ts`

- SessionStart hook with 'startup' matcher modifies first message
- SessionStart hook with 'resume' matcher runs on resume
- SessionStart hook with 'clear' matcher runs on /clear command
- PostToolUse hook provides feedback after file write
- PostToolUse hooks execute in order (format then test)
- suppressOutput flag hides hook output from transcript

---

## 10. Documentation Updates

### Files to Update

- `README.md` - Add hooks section
- `CLAUDE.md` - Document hook testing
- Create `docs/HOOKS.md` - Comprehensive hook guide

### Hook Documentation Structure

1. Overview and use cases
2. Configuration format with examples
3. SessionStart hook reference
4. PostToolUse hook reference
   - **IMPORTANT:** Stdout purity requirement for JSON output
   - How to suppress child process output (`stdio: 'pipe'`)
   - When to use stderr vs stdout
   - Correct output structure with `hookSpecificOutput.additionalContext`
   - Difference between `additionalContext`, `reason`, and `systemMessage`
5. Example hook scripts (with correct stdio handling and output format)
6. Troubleshooting
   - "Hook returns empty output" - check stdout vs stderr
   - "JSON parsing fails" - check for polluted stdout
   - "additionalContext not working" - verify hookSpecificOutput structure

---

## Implementation Order

1. **Install dependency**: `bun add string-argv` (or `@types/string-argv` if needed)
2. **Configuration schema** (`src/config/schema.ts`, `src/config/types.ts`)
3. **Hook executor** (`src/hooks/executor.ts` + tests)
   - Use `string-argv` for parsing command strings
   - Test with quoted paths and arguments
4. **SessionStart module** (`src/hooks/sessionStart.ts` + tests)
5. **PostToolUse module** (`src/hooks/postToolUse.ts` + tests)
6. **SessionStart integration** (CLI handlers)
7. **PostToolUse integration** (agent loop)
8. **Integration tests** (agent.hooks.test.ts)
9. **Interactive tests** (tmux-based)
10. **Documentation**

---

## Example Hook Scripts

### SessionStart Hook: Load Git Context

```javascript
#!/usr/bin/env node
// scripts/git-context-hook.js

const input = JSON.parse(await stdin());

if (input.source === 'startup') {
  const { execSync } = require('child_process');
  const branch = execSync('git branch --show-current').toString().trim();
  const status = execSync('git status --short').toString().trim();

  console.log(`Current branch: ${branch}\nUncommitted changes:\n${status}`);
}
```

### PostToolUse Hook: Format on Write

```javascript
#!/usr/bin/env node
// scripts/format-on-write-hook.js

const input = JSON.parse(await stdin());

if (input.tool_name === 'filesystem_write_file') {
  const filePath = input.tool_input.path;
  const { execSync } = require('child_process');

  try {
    // IMPORTANT: Use stdio: 'pipe' to prevent Prettier output from polluting stdout
    // Hook output must be pure JSON on stdout for parsing to work
    execSync(`npx prettier --write "${filePath}"`, { stdio: 'pipe' });

    // Provide feedback to Claude via additionalContext (pure JSON on stdout)
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `Formatted ${filePath} with Prettier`,
        },
        suppressOutput: false,
      })
    );
  } catch (error) {
    // Send errors to stderr, not stdout, to keep stdout clean for JSON
    console.error('Formatting failed:', error.message);
  }
}
```

### PostToolUse Hook: Run Tests After Edit

```javascript
#!/usr/bin/env node
// scripts/test-on-edit-hook.js

const input = JSON.parse(await stdin());

if (input.tool_name === 'filesystem_edit_file') {
  const { execSync } = require('child_process');

  try {
    // IMPORTANT: stdio: 'pipe' prevents test output from polluting stdout
    // Hook output must be pure JSON on stdout
    const result = execSync('npm test', { encoding: 'utf8', stdio: 'pipe' });

    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: 'Tests passed ✓',
        },
        suppressOutput: true,
      })
    );
  } catch (error) {
    // Output pure JSON to stdout (test failure details from error.stdout)
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `Tests failed:\n${error.stdout}`,
        },
        continue: false, // Stop execution on test failure
        stopReason: 'Tests must pass before continuing',
      })
    );
  }
}
```

---

## Configuration Example

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "command": "node scripts/git-context-hook.js"
      },
      {
        "matcher": "resume",
        "command": "node scripts/session-resume-hook.js"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "filesystem_write_file|filesystem_edit_file",
        "command": "node scripts/format-on-write-hook.js"
      },
      {
        "matcher": "filesystem_edit_file",
        "command": "node scripts/test-on-edit-hook.js"
      }
    ]
  }
}
```

---

## Success Criteria

- [ ] SessionStart hooks execute on startup/resume/clear/compact
- [ ] SessionStart hook output appends to first user message
- [ ] PostToolUse hooks execute after matching tools
- [ ] PostToolUse hooks can stop execution with continue: false
- [ ] PostToolUse hooks can add context via hookSpecificOutput.additionalContext
- [ ] PostToolUse hooks can display system messages via systemMessage field
- [ ] PostToolUse hooks call onMessageUpdate for interactive UI
- [ ] Multiple hooks execute sequentially in config order
- [ ] suppressOutput flag controls hook output visibility
- [ ] Hook failures logged but don't break execution
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Interactive tests demonstrate real usage
- [ ] Documentation complete with correct field names

---

## Non-Goals (Out of Scope)

- Other hook types (PreToolUse, SessionEnd, etc.)
- Hook configuration via environment variables
- Hook configuration per-project (only global config)
- Built-in hooks (all hooks are external commands)
- Hook dependency management
- Hook versioning

---

## Key Design Decisions

### 1. Command Execution: Bun.spawn with Shell-Aware Parsing

**Decision:** Use Bun's `spawn` API with shell-aware command parsing via `string-argv` library.

**Rationale:**

- This is a Bun project, should use Bun stdlib
- `spawn` does not split strings on spaces - must parse command strings into argv arrays
- Simple `split(/\s+/)` breaks with quoted arguments: `node "./my hook.ts" --arg "value with spaces"`
- Shell-aware parsing handles quotes, escapes, and spaces correctly

**Implementation:** Use `string-argv` package to parse command strings

**Alternatives Considered:**

- Using `shell: true` - Rejected: introduces shell injection risks
- Naive `split(/\s+/)` - Rejected: breaks with quoted paths/arguments
- Requiring array config format - Rejected: less user-friendly than strings

### 2. Execution Order: Sequential (Not Parallel)

**Decision:** Execute hooks sequentially in config file order, not in parallel.

**Rationale:**

- Hooks often depend on each other (e.g., format then test)
- Config order gives users explicit control over execution sequence
- Example: Running tests before formatting finishes would cause failures

**Alternative Rejected:** Parallel execution with `Promise.all` was simpler but breaks dependent hooks.

### 3. Clear Command Integration

**Decision:** Add SessionStart hook with `source: 'clear'` to TUIApp.tsx `onClear` callback.

**Rationale:**

- `/clear` command exists in interactive mode at `src/tui/components/TUIApp.tsx:170`
- Hooks should fire after conversation cleared but before new input
- Clear hooks enable cleanup tasks, logging, or context reloading

**Integration Point:** `src/tui/components/TUIApp.tsx:170-176` in the `onClear` callback.

### 4. suppressOutput Semantics

**Decision:** `suppressOutput` controls visibility of **hook's own stdout**, not the tool's output.

**Rationale:**

- Tool already executed - can't suppress its output retroactively
- Hooks may want to run silently (e.g., background logging, metrics)
- Hook executor returns raw stdout; caller checks flag before logging

**Usage:** `if (!hookResult.suppressOutput) logger.debug(hookResult.stdout)`

### 5. Interactive UI Updates: Call onMessageUpdate

**Decision:** When PostToolUse hooks add context via `additionalContext`, call `onMessageUpdate(message)`.

**Rationale:**

- Interactive TUI needs to know about new messages to display them
- Without this, hook-injected context won't appear in UI until next agent response
- Consistent with how other messages are handled

**Implementation Note:** Currently treating `additionalContext` as user messages for simplicity. Consider alternative approaches like injecting directly into system prompt or context window.

**Integration:** Call `onMessageUpdate(contextMessage)` after `messages.push(contextMessage)`.

### 6. Config Validation Strategy

**Decision:** Validate config structure only, NOT command existence.

**Rationale:**

- Commands may rely on `$PATH`, npm scripts, or runtime-installed tools
- `fs.existsSync` would wrongly reject valid commands like `npx`, `bun`, etc.
- Command-not-found errors handled gracefully at runtime

**What We Validate:**

- Regex patterns compile successfully
- SessionStart matchers are valid values
- Command strings are non-empty
- Required fields present

### 7. JSON Parsing Location

**Decision:** Hook executor returns raw stdout; higher-level modules parse JSON.

**Rationale:**

- Executor is low-level infrastructure - shouldn't know about hook semantics
- SessionStart and PostToolUse have different output formats
- Failed JSON parsing handled gracefully by caller (treat as plain text)

**Architecture:**

- `executor.ts`: Returns `{ stdout: string, stderr: string, ... }`
- `sessionStart.ts`: Treats stdout as plain text
- `postToolUse.ts`: Tries to parse stdout as JSON, falls back to plain text

### 8. Stdout Purity for PostToolUse Hooks

**Decision:** PostToolUse hooks that return JSON must output pure JSON on stdout (no mixed content).

**Problem:** Hooks that spawn child processes (like Prettier, tests) with `stdio: 'inherit'` pollute stdout with process output, breaking JSON parsing.

**Solution:** Hook authors must:

- Use `stdio: 'pipe'` when spawning child processes
- Send all non-JSON output (errors, logs) to stderr
- Only write JSON to stdout

**Rationale:**

- Simpler implementation - no need to extract JSON from mixed output
- Clear contract for hook authors
- Falls back gracefully - unparseable stdout becomes plain text observational output

**Alternative Rejected:** Parsing mixed output (e.g., extract last JSON blob) - too fragile and complex.

### 9. No Timeouts for Hook Execution

**Decision:** Hooks run until completion with no timeout.

**Rationale:**

- Some legitimate hooks may take a long time (test suites, builds, deployments)
- Users can kill the process if needed (Ctrl-C)
- No need for arbitrary timeout configuration

**Alternative Rejected:** 30-second timeout - too arbitrary, would break legitimate use cases.

### 10. Stop Behavior for PostToolUse

**Decision:** When a hook returns `continue: false`, stop executing remaining hooks.

**Rationale:**

- Test failures should block subsequent hooks (e.g., don't deploy if tests fail)
- First blocker is most important - subsequent hooks may be redundant
- User can see clear stopReason from the blocking hook

**Implementation:** Loop breaks immediately when `shouldContinue === false`.

### 11. Hook Output Mechanism: hookSpecificOutput.additionalContext

**Decision:** PostToolUse hooks provide feedback to Claude via `hookSpecificOutput.additionalContext`, not `userMessage`.

**Claude Code Structure:**

```typescript
{
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: 'Context injected into next Claude prompt'
  }
}
```

**Rationale:**

- This is the official Claude Code hook API structure
- `additionalContext` is specifically designed to inject context into Claude's next turn
- Different from `reason` (used with `decision: "block"`) and `systemMessage` (shown to user)

**Alternative Fields:**

- `reason`: Explanation when `decision: "block"` is set (automated feedback mechanism)
- `systemMessage`: Warning message displayed to user but not sent to Claude
- `stopReason`: Message shown when `continue: false` stops execution

**Source:** Claude Code Hooks Reference (docs.claude.com/en/docs/claude-code/hooks)
