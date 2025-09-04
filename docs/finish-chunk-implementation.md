# Finish Chunk Implementation Design

## Overview

Implement `finish` chunk handling to capture token usage statistics and finish reasons for better logging and future UI enhancements.

## Current State

Currently we get finish information from the final response object:

```typescript
// agent.ts lines 434-436
const response = await streamResult.response;
const finishReason = await streamResult.finishReason;
const usage = await streamResult.usage;
```

## Finish Chunk Structure

```typescript
{
  type: 'finish',
  finishReason: string,      // 'stop', 'length', 'tool-calls', etc.
  usage: {
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    cachedTokens?: number
  },
  providerMetadata?: any,
  response: ResponseMetadata
}
```

## Implementation Plan

### 1. Add Finish Chunk Handler to Agent

**File:** `src/agent.ts`

Add to the chunk handling switch statement around line 425:

```typescript
} else if (chunk.type === 'finish') {
  // Log finish information immediately when received
  logger.info('Generation finished', {
    finishReason: chunk.finishReason,
    usage: chunk.usage,
    providerMetadata: chunk.providerMetadata,
  });

  // Emit finish message for UI if callback exists
  if (onMessageUpdate) {
    const finishMessage: CoreMessage = {
      role: 'system',
      content: `Completed (${chunk.finishReason}) - ${chunk.usage.totalTokens} tokens`,
      ...({
        finishData: {
          finishReason: chunk.finishReason,
          usage: chunk.usage,
          providerMetadata: chunk.providerMetadata,
        },
        isFinish: true,
      } as any),
    };
    onMessageUpdate(finishMessage);
  }
}
```

### 2. Enhanced Logging

The finish chunk provides real-time access to completion data, allowing for:

- Immediate token usage logging
- Finish reason tracking
- Provider-specific metadata capture

### 3. Future UI Integration

When ready to add to UI, the SessionBridge can handle finish messages:

```typescript
// SessionBridge.ts - future enhancement
else if (msgAny.isFinish) {
  // Could display token usage, finish reason, etc.
  const finishData = msgAny.finishData;

  // Log for debugging
  logger.debug('Finish message received', {
    finishReason: finishData.finishReason,
    tokenUsage: finishData.usage,
  });

  // Future: Add to UI as status indicator
  this.emitUIUpdate({
    type: 'message',
    message: 'Generation completed',
    messageData: message,
  });
}
```

## Benefits

1. **Real-time logging** - Get usage stats immediately, not after response processing
2. **Better debugging** - Immediate access to finish reasons and token counts
3. **Future-ready** - Structure in place for UI enhancements
4. **Consistency** - Handle all chunk types uniformly

## Testing

Add test cases to verify:

- Finish chunk is properly handled
- Token usage is logged correctly
- Finish reason is captured
- UI message is emitted when callback exists
