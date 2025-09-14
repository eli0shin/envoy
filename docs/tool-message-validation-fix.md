# Tool Message Validation Error - Root Cause Analysis and Fix

## Issue Summary

**Problem**: Zod validation errors when malformed tool messages with `role: 'tool'` and string content are passed to AI SDK's `streamText()` function during multi-step agent execution.

**Error**:

```
"code": "invalid_union",
"message": "Invalid input"
"Expected array, received string" at content field
```

## Root Cause Analysis

### Message Flow Investigation

The error occurs during the following execution flow:

1. **Tool Call Creation**: `StreamingHandler.handleToolCall()` creates malformed tool message:

   ```typescript
   const toolCallMessage: ExtendedCoreMessage = {
     role: 'tool',
     content: `Tool call: ${toolName}`, // STRING CONTENT - WRONG!
     toolCallId,
     toolName,
     toolArgs: args,
   };
   ```

2. **Message Storage**: `onMessageUpdate()` → `MessageUpdateHandler.handleMessageUpdate()` → `handleToolCallMessage()` → `session.messages.push(msgEnhanced)`

3. **Multi-Step Continuation**: In the same agent execution, when continuing multi-step processing:
   - `AgentExecutionHandler.execute()` line 80: `runAgent(this.session.messages)`
   - `agent.ts` line 84-85: `messages` → `transformedMessages` (no filtering)
   - Line 101: `streamText({ messages: transformedMessages })`

4. **Validation Failure**: AI SDK's Zod schema validation fails because `CoreToolMessage` expects `content: ToolContent` which is `Array<ToolResultPart>`, not a string.

### AI SDK Specification

According to the AI SDK types in `node_modules/ai/dist/index.d.ts`:

```typescript
type CoreToolMessage = {
  role: 'tool';
  content: ToolContent; // Must be Array<ToolResultPart>
};

type ToolContent = Array<ToolResultPart>;
```

### Key Finding: No UI/Model Message Separation

**Critical Discovery**: There is NO separation between UI messages and model messages. The `session.messages` array contains both UI-focused messages and gets passed directly to `streamText()` without any filtering or transformation. This means malformed messages intended for UI display are being sent to the AI model, causing validation failures.

## Proposed Fix

### Option 1: Fix Content Structure (Recommended)

Change `StreamingHandler.handleToolCall()` to create properly formatted tool messages:

```typescript
// Before (WRONG):
const toolCallMessage: ExtendedCoreMessage = {
  role: 'tool',
  content: `Tool call: ${toolName}`, // String content
  toolCallId,
  toolName,
  toolArgs: args,
};

// After (CORRECT):
const toolCallMessage: ExtendedCoreMessage = {
  role: 'tool',
  content: [
    // Array content matching ToolContent specification
    {
      type: 'tool-call',
      toolCallId,
      toolName,
      args,
    },
  ],
} as ExtendedCoreMessage;
```

### Option 2: Architectural Consideration

Based on AI SDK patterns, tool calls should ideally be `ToolCallPart` within `AssistantContent`, not separate messages with `role: 'tool'`. Only tool RESULTS should be separate `role: 'tool'` messages. However, this would require significant architectural changes to the UI message handling system.

## Implementation Plan

### Phase 1: Immediate Fix (Recommended)

1. Update `StreamingHandler.handleToolCall()` in `/src/agent/streaming/StreamingHandler.ts` line 308
2. Change content structure from string to array format
3. Ensure the new structure passes AI SDK Zod validation
4. Test multi-step agent execution with tool calls

### Phase 2: Future Architectural Improvement (Optional)

1. Investigate separation of UI messages from model messages
2. Consider implementing proper `ToolCallPart` structure within assistant messages
3. Evaluate impact on existing UI components that expect current message format

## Files Affected

- **Primary**: `/src/agent/streaming/StreamingHandler.ts` (line 308)
- **Testing**: Existing tests should pass with corrected message format
- **Dependencies**: No breaking changes to external interfaces

## Validation

The fix can be validated by:

1. Running multi-step agent execution with tool calls
2. Confirming no Zod validation errors in session logs
3. Verifying UI continues to display tool calls correctly
4. Testing conversation persistence and restoration

## Background Context

This issue was discovered through session log analysis showing Zod validation errors during deep conversations with multiple tool calls. The error manifests when the agent continues execution in multi-step mode, passing accumulated messages (including malformed tool call messages) back to `streamText()` for subsequent turns.

The fix maintains backward compatibility while ensuring compliance with AI SDK message format specifications.
