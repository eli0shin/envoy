# Real-Time Streaming UI Design

## Overview

This document describes the design and implementation of real-time streaming message updates in the Ink-based UI for the CLI AI Agent. The solution enables live text streaming and tool call updates that display in real-time as chunks arrive from the AI model.

## Problem Statement

### Initial Issues

1. **Incomplete Assistant Messages**: Only first text chunk was displayed, subsequent chunks didn't update the UI
2. **Missing Tool Messages**: Tool calls and results weren't appearing in the UI
3. **Duplicate Messages**: Both streaming and final response messages were being displayed
4. **Frozen UI Updates**: Messages were updated in memory but not re-rendering in the UI

### Root Cause Analysis

The primary issue was **Ink's `<Static>` component behavior**. The `<Static>` component in Ink is designed for unchanging content and does not re-render when item content changes, even if the underlying data is updated.

## Architecture

### Message Flow

```
AI Model → Agent.ts → SessionBridge → InkInterface → MessageList → MessageGroup
          (chunks)   (tracking)     (updates)     (rendering)
```

### Component Responsibilities

#### 1. Agent.ts - Chunk Processing

- **Text Streaming**: Emits assistant message on first `text-delta`, updates on subsequent chunks
- **Tool Calls**: Emits tool call messages immediately when `tool-call` chunk arrives
- **Tool Results**: Handled via `response.messages` for complete results

#### 2. SessionBridge - Message State Management

- **Message Tracking**: Tracks current assistant message index and tool call mappings
- **Update Logic**: Updates existing messages instead of creating duplicates
- **Deduplication**: Prevents duplicate messages from streaming vs response sources

#### 3. MessageList - Dynamic Rendering

- **Static vs Dynamic Separation**: Completed messages in `<Static>`, updating messages outside
- **Real-time Updates**: Last assistant message rendered separately for live updates

## Implementation Details

### Agent.ts - Streaming Chunk Handlers

```typescript
// Real-time assistant message updates
if (chunk.type === 'text-delta') {
  textResult += chunk.textDelta;

  if (!assistantMessageEmitted && textResult.trim() && onMessageUpdate) {
    // CREATE new assistant message
    onMessageUpdate({ role: 'assistant', content: textResult.trim() });
    assistantMessageEmitted = true;
  } else if (assistantMessageEmitted && textResult.trim() && onMessageUpdate) {
    // UPDATE existing assistant message
    onMessageUpdate({ role: 'assistant', content: textResult.trim() });
  }
}

// Immediate tool call emission
if (chunk.type === 'tool-call' && onMessageUpdate) {
  onMessageUpdate({
    role: 'tool',
    content: `Tool call: ${chunk.toolName}`,
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    toolArgs: chunk.args,
  });
}
```

### SessionBridge - Message Tracking

```typescript
// Message tracking state
let currentAssistantMessageIndex: number | null = null;
const toolCallsMap = new Map<string, number>(); // toolCallId -> message index

// Assistant message handling
if (message.role === 'assistant' && typeof message.content === 'string') {
  if (currentAssistantMessageIndex === null) {
    // NEW assistant message
    currentAssistantMessageIndex = this.session.messages.length;
    this.session.messages.push(message);
  } else {
    // UPDATE existing assistant message
    this.session.messages[currentAssistantMessageIndex] = message;
  }
  this.emitUIUpdate();
}

// Tool call tracking
if (message.role === 'tool' && msgAny.toolName && msgAny.toolArgs) {
  const messageIndex = this.session.messages.length;
  toolCallsMap.set(msgAny.toolCallId, messageIndex);
  this.session.messages.push(message);
  this.emitUIUpdate();
}

// Tool result updates
if (message.role === 'tool' && !msgAny.toolName) {
  const toolMessageIndex = toolCallsMap.get(toolCallId);
  if (toolMessageIndex !== undefined) {
    this.session.messages[toolMessageIndex].toolResult = toolResult;
    this.emitUIUpdate();
  }
}
```

### MessageList - Static/Dynamic Rendering

```typescript
const { staticItems, dynamicMessage } = useMemo(() => {
  const displayMessages = transformMessagesForDisplay(messages);
  const lastMessage = displayMessages[displayMessages.length - 1];

  // Separate completed messages from potentially updating ones
  const staticMessages = displayMessages.slice(0, -1);
  if (lastMessage?.type !== 'assistant') {
    staticMessages.push(lastMessage);
  }

  return {
    staticItems: staticMessages.map(msg => ({ /* ... */ })),
    dynamicMessage: lastMessage?.type === 'assistant' ? lastMessage : null,
  };
}, [messages, session, config]);

return (
  <Box flexDirection="column" flexGrow={1}>
    <Box paddingX={1}>
      {/* Static completed messages */}
      <Static items={staticItems}>
        {(item) => <MessageGroup message={item.message} />}
      </Static>

      {/* Dynamic updating message */}
      {dynamicMessage && (
        <MessageGroup message={dynamicMessage} />
      )}
    </Box>
  </Box>
);
```

## Key Design Decisions

### 1. Message State Management

- **Single Source of Truth**: SessionBridge maintains message array state
- **Index Tracking**: Track message positions for efficient updates
- **Immutable Updates**: Replace entire message objects to trigger React updates

### 2. Rendering Strategy

- **Static Content**: Use `<Static>` for completed, unchanging messages (performance)
- **Dynamic Content**: Render updating messages outside `<Static>` for real-time updates
- **Separation Logic**: Last assistant message is considered potentially dynamic

### 3. Chunk Processing

- **Immediate Emission**: Emit messages as soon as chunks arrive
- **Accumulative Updates**: Build complete text from delta chunks
- **Tool Call Tracking**: Map tool calls to results for proper association

## Benefits

### Performance

- **Efficient Static Rendering**: Completed messages don't re-render unnecessarily
- **Targeted Updates**: Only updating message triggers re-renders
- **Minimal State Changes**: Update existing objects instead of creating new arrays

### User Experience

- **Real-time Feedback**: Text appears and grows as AI generates it
- **Immediate Tool Visibility**: Tool calls appear instantly when called
- **Smooth Updates**: No flickering or jumping content
- **Proper Ordering**: Messages appear in correct sequence throughout streaming

### Developer Experience

- **Clear Separation**: Static vs dynamic content is explicit
- **Debuggable Flow**: Each step has clear logging for troubleshooting
- **Maintainable Code**: Responsibilities clearly separated between components

## Chunk Types Handled

| Chunk Type    | Handler       | Action                          |
| ------------- | ------------- | ------------------------------- |
| `step-start`  | Agent.ts      | Initialize step tracking        |
| `text-delta`  | Agent.ts      | Create/update assistant message |
| `tool-call`   | Agent.ts      | Emit tool call message          |
| `tool-result` | SessionBridge | Update existing tool message    |
| `step-finish` | Agent.ts      | Log completion (no UI action)   |
| `finish`      | Agent.ts      | Log stream completion           |
| `error`       | Agent.ts      | Log errors                      |

## Future Considerations

### Enhancements

- **Message Persistence**: Consider message history across sessions
- **Streaming Indicators**: Visual indicators for actively streaming content
- **Tool Progress**: Progress indicators for long-running tools
- **Error Recovery**: Better handling of partial/failed streams

### Scalability

- **Memory Management**: Consider cleanup for very long conversations
- **Performance Monitoring**: Track render performance with many messages
- **Chunk Batching**: Potentially batch rapid text-delta updates

## Testing Strategy

### Unit Tests

- SessionBridge message tracking logic
- MessageList static/dynamic separation
- Message transform functions

### Integration Tests

- End-to-end streaming scenarios
- Tool call and result flows
- Error handling paths

### Manual Testing

- Real-time streaming verification
- UI responsiveness during streaming
- Message ordering validation

## Troubleshooting

### Common Issues

1. **Messages Not Updating**: Check if message is in `<Static>` component
2. **Duplicate Messages**: Verify deduplication logic in SessionBridge
3. **Tool Results Missing**: Check tool call ID mapping in toolCallsMap
4. **Performance Issues**: Monitor number of re-renders in dynamic section

### Debug Logging

The implementation includes comprehensive debug logging:

- `[DEBUG] Chunk type: {type}` - Track incoming chunks
- `[DEBUG] Emitting NEW/UPDATING assistant message` - Message creation/updates
- `[DEBUG] SessionBridge received message` - SessionBridge processing
- `[DEBUG] Skipping response.messages assistant` - Deduplication in action

This design enables smooth, real-time streaming while maintaining performance and code clarity.
