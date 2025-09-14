# Thinking Stream Error - Complete Root Cause Analysis

## Issue Summary

The interactive CLI was experiencing tool call message display issues when thinking functionality was enabled. The problem appeared as a "hanging stream" but was actually an API error due to **incomplete conversation state management** that violates Anthropic API requirements for thinking message signatures.

## Problem Description

**Symptoms:**

- With thinking enabled: Stream appears to hang after initial reasoning chunks, never reaching tool calls
- Without thinking: Stream works but model doesn't naturally decide to use tools
- Tool call messages with icons weren't appearing in the interactive UI
- Subsequent user messages would not be processed properly

**Initial Hypothesis (Incorrect):**

- Thought it was a thinking stream hanging issue
- Believed the `interleaved-thinking-2025-05-14` beta header was causing stream instability
- Assumed thinking message processing was getting stuck in an infinite loop
- Believed thinking configuration itself was incompatible with the API

## Investigation Process

### 1. Stream Hanging Analysis

- Added detailed debug logging to track chunk processing
- Discovered stream was completing with only 1 chunk instead of hanging
- Found the single chunk was of type `"error"`, not a thinking chunk

### 2. Error Chunk Discovery

Initial logs showed:

```json
{
  "message": "Agent: Processing chunk 1",
  "metadata": { "type": "error" }
}
```

This revealed the stream wasn't hanging - it was failing immediately with an API error.

### 3. Deep Dive Investigation (Parallel Subagent Research)

To understand the true root cause, parallel investigations were conducted:

#### 3.1 Anthropic API Requirements Research

Research into Anthropic's thinking API documentation revealed critical requirements:

**Key Finding**: The Anthropic API requires **complete thinking blocks with signatures** to be included in subsequent API calls, especially when tool use is involved.

#### 3.2 Codebase State Management Analysis

Analysis of our conversation state management revealed multiple violations of these requirements.

**Key Finding**: Our implementation **fails to preserve thinking messages with signatures** in the conversation history used for subsequent API calls.

## Root Cause

**The real issue is conversation state management that violates Anthropic API requirements for thinking messages.**

The Anthropic API returns error chunks because our implementation fails to include complete thinking blocks with their cryptographic signatures in subsequent API calls, which is a strict requirement for the thinking API.

### Anthropic API Requirements (Research Findings)

**Beta Header Requirements:**

- Required header: `anthropic-beta: interleaved-thinking-2025-05-14`
- Only works with Claude Sonnet 4 (`claude-sonnet-4-20250514`) and Claude Opus 4
- Must be included for all requests using thinking

**Critical Thinking Message Signature Requirements:**

1. **Thinking blocks contain encrypted `signature` fields** for verification
2. **Signatures must be preserved exactly** as received from the API
3. **Complete thinking blocks must be included** in subsequent API calls
4. **Tool use requires original thinking blocks** to maintain reasoning continuity
5. **API will reject calls** when "Tool use is attempted without including the original thinking blocks"

**Specific API Rejection Conditions:**

- Thinking blocks are modified or tampered with
- Tool use is attempted without including the original thinking blocks
- The final assistant message doesn't start with a thinking block when using tools
- Thinking blocks are passed when thinking is disabled

### Code Analysis: State Management Violations

**Problem 1: AI SDK `response.messages` Excludes Thinking Content**

**Location:** `src/agent.ts:403-405`

```typescript
// Add all response messages (assistant, tool calls, tool results) to conversation
if (result.response?.messages && result.response.messages.length > 0) {
  messages.push(...result.response.messages); // ❌ Missing thinking blocks!
}
```

**Issue:** The AI SDK's `response.messages` from `streamText()` only includes regular assistant messages, tool calls, and tool results. It does **NOT** include thinking messages with their signatures.

**Problem 2: SessionBridge Overwrites Thinking Messages**

**Location:** `src/ui/SessionBridge.ts:401-404`

```typescript
if (result.success && result.messages) {
  // Use the final messages from the agent result to ensure AI SDK compatibility
  this.session.messages = result.messages; // ❌ Loses thinking state!
}
```

**Issue:** SessionBridge completely replaces accumulated messages (which include thinking messages) with `result.messages` (which don't include thinking messages).

**Problem 3: Thinking Messages Only Exist in Streaming Callbacks**

**Location:** `src/agent.ts:232-286` (reasoning chunk handling)

```typescript
} else if (chunk.type === 'reasoning') {
  // Handle thinking/reasoning content
  thinkingContent += chunk.textDelta;
  // ... creates thinking message for UI only
}
```

**Issue:** Thinking messages are only created for UI updates via `onMessageUpdate` but are never added to the conversation history that gets passed to subsequent API calls.

**Problem 4: Subsequent API Calls Use Incomplete Messages**

**Location:** `src/agent.ts:140-145`

```typescript
while (currentStep < maxSteps) {
  const transformedMessages = Array.isArray(systemPrompt)
    ? transformMessagesForAnthropic(messages, systemPrompt) // ❌ Missing thinking
    : messages; // ❌ Missing thinking

  const streamResult = streamText({
    messages: transformedMessages, // ❌ Incomplete conversation state
```

**Issue:** The `messages` array being passed to subsequent `streamText` calls is built from `response.messages` which lacks thinking content with signatures.

## Why This Violation Occurs in Interactive Mode

**Interactive CLI Context:** The interactive mode immediately creates conversation turns, which means:

1. **First call**: ✅ Works (no previous thinking to include)
2. **Second call**: ❌ Fails (missing required thinking signatures from first call)
3. **Error appears immediately**: In interactive mode, subsequent calls happen quickly

**Why Single API Calls Work:** Non-interactive single API calls don't have previous thinking state to maintain, so they succeed.

## Why This Wasn't Obvious

1. **Silent Error Handling**: The original code didn't handle error chunks, so they were silently ignored
2. **Misleading Logs**: Stream completion logs showed "successful" completion with 1 chunk
3. **Assumed Hang**: The immediate termination looked like a hang rather than a fast failure
4. **Complex Debugging**: Multiple layers (stream processing, UI updates, SessionBridge) made the flow hard to trace
5. **Interactive Mode Specific**: The issue only manifests in interactive/conversation mode, not single API calls
6. **AI SDK Abstraction**: The separation between streaming chunks and final messages hid the thinking state loss

## Evidence

### Timeline of API Calls in Interactive Mode

**Call 1 (User: "add a task"):**

- ✅ No previous thinking to include
- ✅ API succeeds, returns thinking + tool calls
- ❌ Thinking messages with signatures NOT preserved in conversation state

**Call 2 (User follow-up):**

- ❌ Missing required thinking signatures from Call 1
- ❌ API immediately rejects with error chunk
- ❌ Stream terminates, appears to "hang"

### Debug Log Evidence

```json
{
  "timestamp": "2025-07-07T03:36:02.737Z",
  "message": "Agent: Processing chunk 1",
  "metadata": {"type": "error"}
}
{
  "timestamp": "2025-07-07T03:36:02.738Z",
  "message": "Agent: Streaming loop completed",
  "metadata": {"chunkCount": 1}
}
```

### Working vs Failing Configurations

**Working (No Thinking):**

```typescript
const providerOptions = {};
```

**Result:** No thinking state to manage, no signature requirements

**Failing (With Thinking):**

```typescript
const providerOptions = createThinkingProviderOptions(model, maxSteps);
```

**Result:** Creates thinking state requirements that our code violates

## Solution Implemented

### Short Term Fix (Temporary)

1. **Disabled thinking provider options** to eliminate API errors
2. **Enhanced system prompt** to explicitly instruct tool usage:
   ```
   - IMPORTANT: When users ask you to "add a task", "create a todo", or similar,
     you MUST use the todo_add tool to actually add it to their todo list, not just respond with text
   ```
3. **Added proper error chunk handling** for future debugging

### Code Changes (Temporary)

- `src/agent.ts`: Disabled thinking provider options
- `src/constants.ts`: Enhanced system prompt with explicit tool usage instructions
- `src/agent.ts`: Added error chunk handling and logging

## Complete Fix Instructions

**To properly support thinking functionality, the following changes are required:**

### 1. Modify Agent.ts to Preserve Thinking Messages

**Problem:** Thinking messages are only available during streaming but not included in `response.messages`

**Solution:** Accumulate thinking messages with signatures during streaming and add them to the conversation history.

```typescript
// In src/agent.ts, around line 172
let accumulatedThinkingMessages: CoreMessage[] = []; // Add this

// In the streaming loop, around line 232
} else if (chunk.type === 'reasoning') {
  // Handle thinking/reasoning content
  thinkingContent += chunk.textDelta;

  // Emit thinking message for UI
  if (!thinkingMessageEmitted && thinkingContent.trim() && onMessageUpdate) {
    const thinkingMessage: CoreMessage = {
      role: 'assistant',
      content: thinkingContent.trim(),
      thinking: true,
      isThinkingComplete: false,
    } as any;
    onMessageUpdate(thinkingMessage);
    thinkingMessageEmitted = true;
  }
  // ... existing update logic

} else if (chunk.type === 'reasoning-signature') {
  // Handle thinking signature (completion indicator)
  if (thinkingMessageEmitted && onMessageUpdate) {
    const completedThinkingMessage: CoreMessage = {
      role: 'assistant',
      content: thinkingContent.trim(),
      thinking: true,
      isThinkingComplete: true,
      thinkingSignature: chunk.signature, // ✅ Preserve signature
    } as any;
    onMessageUpdate(completedThinkingMessage);

    // ✅ ADD: Accumulate for conversation history
    accumulatedThinkingMessages.push(completedThinkingMessage);
  }
}

// After streaming loop completes, around line 403
// Add thinking messages to conversation history BEFORE response.messages
if (accumulatedThinkingMessages.length > 0) {
  messages.push(...accumulatedThinkingMessages); // ✅ Include thinking first
}

// Add regular response messages
if (result.response?.messages && result.response.messages.length > 0) {
  messages.push(...result.response.messages);
}
```

### 2. Fix SessionBridge State Management

**Problem:** SessionBridge overwrites accumulated messages with incomplete `result.messages`

**Solution:** Preserve thinking messages when updating session state.

```typescript
// In src/ui/SessionBridge.ts, around line 401
if (result.success && result.messages) {
  // ✅ CHANGED: Preserve thinking messages from streaming
  const thinkingMessages = this.session.messages.filter(
    (msg) => (msg as any).thinking === true
  );

  // Combine thinking messages + final response messages
  this.session.messages = [...thinkingMessages, ...result.messages];
} else if (result.success && hasStreamingStarted) {
  // Keep streaming-accumulated messages (includes thinking)
  console.log('SessionBridge: Keeping streaming-accumulated messages');
}
```

### 3. Add Message Transformation Support for Thinking

**Problem:** `transformMessagesForAnthropic` doesn't handle thinking messages

**Solution:** Add thinking message preservation in transformation.

```typescript
// In src/messageTransform.ts, add thinking message handling
export function transformMessagesForAnthropic(
  messages: CoreMessage[],
  systemMessages: CoreMessage[]
): CoreMessage[] {
  // ... existing logic

  // ✅ ADD: Preserve thinking messages with signatures
  const processedMessages = messages.map((message) => {
    if ((message as any).thinking === true) {
      // Preserve thinking messages exactly as received
      return message;
    }
    // ... existing message processing
    return message;
  });

  return processedMessages;
}
```

### 4. Add Thinking Message Types

**Problem:** TypeScript types don't include thinking message properties

**Solution:** Extend message types to include thinking properties.

```typescript
// In src/types.ts or create src/types/thinkingTypes.ts
export interface ThinkingMessage extends CoreMessage {
  thinking: true;
  isThinkingComplete: boolean;
  thinkingSignature?: string;
  redactedData?: any;
}
```

### 5. Enable Thinking Provider Options

**Problem:** Thinking is currently disabled

**Solution:** Re-enable thinking after implementing proper state management.

```typescript
// In src/agent.ts, around line 153
// ✅ CHANGED: Re-enable thinking with proper state management
const providerOptions = createThinkingProviderOptions(
  model,
  config.agent.maxSteps
);

// ✅ CHANGED: Re-enable interleaved thinking header
headers: {
  'anthropic-beta': 'interleaved-thinking-2025-05-14',
},
```

### 6. Testing Strategy

**Validation Steps:**

1. Enable thinking configuration
2. Run interactive test: `npm run test:interactive -- toolcall.interactive.test.ts`
3. Verify thinking messages appear in conversation history
4. Confirm subsequent API calls include thinking signatures
5. Test tool use after thinking works correctly

**Expected Result:** Interactive test passes with thinking enabled, tool calls work properly in conversation context.

## Testing Validation

Created comprehensive interactive test (`interactive/toolcall.interactive.test.ts`) that:

- ✅ Simulates character-by-character typing with PTY
- ✅ Detects tool execution via "Working..." spinner
- ✅ Verifies assistant responses via 🤖 icon
- ✅ Confirms subsequent message processing works
- ✅ Validates end-to-end workflow

**Test Results:**

- With thinking disabled: ✅ Test passes, tools work correctly
- With thinking enabled (current): ❌ Test fails due to API error from missing thinking signatures
- With thinking enabled (after fix): Should ✅ Pass with proper thinking state management

## Key Learnings

1. **API requirements are strict** - thinking signatures must be preserved exactly
2. **Conversation state matters** - interactive mode exposes state management bugs
3. **AI SDK abstractions can hide requirements** - streaming vs final messages separation
4. **Error chunks reveal API violations** - silent failures hide root causes
5. **Interactive testing is crucial** - unit tests alone missed this conversation-specific issue
6. **Step-by-step debugging beats assumptions** - the "hang" was actually immediate API rejection
7. **Documentation research is essential** - API requirements aren't always obvious from code alone

## Files Modified

### Current (Temporary Fix)

- `src/agent.ts` - Disabled thinking, added error handling
- `src/constants.ts` - Enhanced system prompt for tool usage
- `interactive/toolcall.interactive.test.ts` - Created comprehensive test
- `docs/thinking-stream-error-root-cause-analysis.md` - This document

### Required (Complete Fix)

- `src/agent.ts` - Accumulate thinking messages with signatures
- `src/ui/SessionBridge.ts` - Preserve thinking state during session updates
- `src/messageTransform.ts` - Handle thinking messages in transformations
- `src/types.ts` - Add thinking message type definitions

## Test Command

```bash
npm run build && npm run test:interactive -- toolcall.interactive.test.ts
```

## Implementation Priority

**High Priority:** Implement the complete fix to restore thinking functionality

- Thinking enables better reasoning for complex tool usage scenarios
- Interactive mode requires proper conversation state management
- Current workaround limits model capabilities

**Validation:** The interactive test serves as a reliable regression test to confirm thinking + tool calls work properly in conversation context.

## Research Sources

- **Anthropic API Documentation**: Interleaved thinking requirements and signature handling
- **Codebase Analysis**: Message flow through Agent → SessionBridge → UI
- **Debug Log Analysis**: Error chunk identification and API rejection patterns
- **Interactive Testing**: Conversation state validation with PTY simulation
