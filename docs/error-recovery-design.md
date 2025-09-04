# Agent Error Recovery Design Document

## Problem Statement

The current agent loop in `src/agent.ts` has a critical limitation: when an error occurs during tool execution or AI text generation within the `generateText` call, the error is caught by the outer catch block and the entire agent loop terminates. This prevents the agent from recovering from errors and continuing the conversation.

### Current Error Behavior

```typescript
try {
  const result = await generateText({
    // ... configuration
    tools: aiSDKTools,
    onStepFinish: step => {
      // ... step handling
    },
  });
  return { success: true, response: result.text.trim() };
} catch (error) {
  // Error terminates the entire conversation
  return { success: false, error: errorMessage };
}
```

### Issues with Current Approach

1. **No error recovery**: Tool execution errors or AI generation errors immediately terminate the conversation
2. **Loss of context**: Previous conversation context is lost when an error occurs
3. **Poor user experience**: Users receive error messages instead of helpful recovery attempts
4. **Fragile tool integration**: Any MCP tool failure brings down the entire agent

## Simple Solution Design

### Core Principle: Inform the AI and Let It Adapt

Instead of complex error classification and retry strategies, the optimal approach is simple:

1. **Catch errors** in the conversation loop
2. **Tell the AI** what went wrong via a system message
3. **Continue the conversation** and let the AI decide how to adapt

### Simple Implementation

```typescript
export async function runAgent(
  userMessage: string,
  options: CLIOptions
): Promise<AgentResult> {
  const startTime = Date.now();
  const messages = [{ role: 'user', content: userMessage }];
  let currentStep = 0;
  let toolCallsCount = 0;

  while (currentStep < (options.maxSteps || MAX_STEPS)) {
    try {
      const result = await generateText({
        model: selectedModel,
        system: SYSTEM_PROMPT,
        messages,
        tools: aiSDKTools,
        maxSteps: 1,
        onStepFinish: step => {
          if (step.text?.trim()) {
            console.log(`[assistant] ${step.text.trim()}`);
          }
          if (step.toolCalls?.length) {
            toolCallsCount += step.toolCalls.length;
          }
        },
      });

      // Add assistant response to conversation
      if (result.text?.trim()) {
        messages.push({ role: 'assistant', content: result.text.trim() });
      }

      // Check if conversation is complete
      if (result.finishReason === 'stop' || result.finishReason === 'length') {
        return {
          success: true,
          response: result.text.trim(),
          toolCallsCount,
          executionTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      // Simple error recovery: tell the AI what went wrong
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      messages.push({
        role: 'system',
        content: `Previous operation failed: ${errorMessage}. Please try a different approach or continue with available information.`,
      });

      if (options.verbose) {
        console.error(`Step ${currentStep} encountered error: ${errorMessage}`);
      }
    }

    currentStep++;
  }

  // Return the last response if max steps reached
  const lastMessage = messages[messages.length - 1];
  return {
    success: true,
    response: lastMessage?.content || 'Maximum steps reached',
    toolCallsCount,
    executionTime: Date.now() - startTime,
  };
}
```

### Why This Simple Approach Works

1. **AI is smart**: Modern AI models can understand error messages and adapt accordingly
2. **No complex logic needed**: The AI decides whether to retry, try alternatives, or ask for help
3. **Context preserved**: Conversation continues with full context intact
4. **Resilient**: One tool failure doesn't bring down the entire conversation
5. **Maintainable**: Simple code is easier to debug and modify

### Error Recovery Strategies (AI-Driven)

The AI model automatically handles:

- **Tool failures**: Tries alternative tools or approaches
- **Invalid parameters**: Asks for clarification or uses different values
- **Network issues**: Acknowledges the issue and continues with available information
- **Rate limits**: Waits or uses alternative methods

## Implementation Strategy

### Phase 1: Simple Error Recovery (Current)

1. Update the main conversation loop to catch errors
2. Add system messages for error communication
3. Continue conversation instead of terminating
4. Remove complex error classification and retry logic

### Phase 2: Optional Enhancements (Future)

1. Add basic error logging for debugging
2. Implement simple rate limiting detection
3. Add optional error context in verbose mode

## Benefits

1. **Improved Reliability**: Agent continues working despite tool failures
2. **Better User Experience**: No abrupt conversation termination
3. **Context Preservation**: Full conversation history maintained
4. **AI-Driven Recovery**: Leverages AI's intelligence for error handling
5. **Simple Maintenance**: Minimal code complexity
6. **Flexible Adaptation**: AI chooses best recovery strategy per situation

## Configuration Options

No new configuration needed. The existing options work:

```bash
--verbose                   Show error details in console
--max-steps <num>          Maximum conversation steps (default: 10)
```

## Backward Compatibility

This approach is fully backward compatible. The existing `runAgent` function signature remains the same, just with improved error handling internally.

## Testing Strategy

1. **Unit Tests**: Test that errors don't terminate conversations
2. **Integration Tests**: Verify AI receives error messages correctly
3. **Error Simulation**: Create controlled failure scenarios
4. **User Testing**: Validate improved conversation flow

## Success Metrics

- Zero conversation terminations due to tool errors
- Improved task completion rates
- Better user satisfaction with error handling
- Reduced support requests related to tool failures

## Comparison with Complex Approach

| Aspect               | Simple Approach | Complex Approach            |
| -------------------- | --------------- | --------------------------- |
| Code Lines           | ~20 lines       | ~200+ lines                 |
| Maintainability      | High            | Low                         |
| Error Classification | AI-driven       | Manual string matching      |
| Retry Logic          | AI decides      | Complex exponential backoff |
| Recovery Strategies  | AI adapts       | Hardcoded rules             |
| Memory Usage         | Minimal         | High (state tracking)       |
| Debugging            | Easy            | Complex                     |
| Failure Points       | Few             | Many                        |

The simple approach is superior because it leverages the AI's intelligence rather than trying to hardcode all possible error scenarios.
