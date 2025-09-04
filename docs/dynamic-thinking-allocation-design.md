# Dynamic Thinking Allocation Design Document

## Overview

This document outlines the design and implementation plan for dynamic thinking budget allocation based on user message content. The system will analyze incoming messages for specific keywords and patterns to automatically configure appropriate thinking budgets and enable/disable interleaved thinking mode.

## Current State

### Thinking Configuration

The current implementation in `src/constants.ts` defines static thinking configurations:

```typescript
export const THINKING_CONFIG = {
  anthropic: {
    defaultBudget: 1024, // Minimum required by Anthropic API
    maxBudget: 24576, // ~24k tokens
    costMultiplier: 1.0,
  },
  openai: {
    defaultEffort: 'medium',
    efforts: ['low', 'medium', 'high'],
  },
  google: {
    defaultBudget: 8192,
    maxBudget: 24576,
    costMultiplier: 6.0,
  },
};
```

### Current Behavior

- Thinking is **always enabled** for supported providers (Anthropic, OpenAI, Google)
- Anthropic: Budget scales with `sqrt(maxSteps)` up to maxBudget
- OpenAI: Uses default effort level ('medium')
- Google: Uses fixed default budget
- Interleaved thinking header is **always included** for Anthropic

## Proposed Dynamic System

### Requirements (Hard Switch)

1. **Default**: No thinking budget, interleaved thinking header OFF
2. **"think"**: 4,000 tokens ("low")
3. **"think about it", "think a lot", "think deeply", "think hard", "think more", "megathink"**: 10,000 tokens ("medium")
4. **"think harder", "think intensely", "think longer", "think really hard", "think super hard", "think very hard", "ultrathink"**: 31,999 tokens ("high")
5. **"step by step"**: Enable interleaved thinking beta header (independent of budget)

### Design Principles

- **Zero thinking by default**: No thinking unless explicitly requested
- **Simple keyword detection**: Case-insensitive regex matching
- **Priority-based matching**: More specific patterns take precedence
- **Independent header control**: "step by step" only affects interleaved thinking header
- **No backward compatibility**: This is a breaking change

## Implementation Design

### 1. Message Analysis Function

```typescript
// New file: src/thinking/dynamicThinkingAnalyzer.ts

export type ThinkingLevel = 'none' | 'low' | 'medium' | 'high';

export type MessageThinkingAnalysis = {
  level: ThinkingLevel;
  budgetTokens: number;
  enableInterleaved: boolean;
};

export function analyzeMessageForThinking(
  message: string
): MessageThinkingAnalysis {
  const lowerMessage = message.toLowerCase();

  // Check for interleaved thinking (only "step by step" needed)
  const enableInterleaved = /\bstep\s+by\s+step\b/.test(lowerMessage);

  // Priority-based pattern matching for budget (most specific first)
  let level: ThinkingLevel = 'none';
  let budgetTokens = 0;

  // High thinking budget (31,999 tokens) - most specific patterns first
  if (
    /\bthink\s+harder\b/.test(lowerMessage) ||
    /\bthink\s+intensely\b/.test(lowerMessage) ||
    /\bthink\s+longer\b/.test(lowerMessage) ||
    /\bthink\s+really\s+hard\b/.test(lowerMessage) ||
    /\bthink\s+super\s+hard\b/.test(lowerMessage) ||
    /\bthink\s+very\s+hard\b/.test(lowerMessage) ||
    /\bultrathink\b/.test(lowerMessage)
  ) {
    level = 'high';
    budgetTokens = 31999;
  }
  // Medium thinking budget (10,000 tokens)
  else if (
    /\bthink\s+about\s+it\b/.test(lowerMessage) ||
    /\bthink\s+a\s+lot\b/.test(lowerMessage) ||
    /\bthink\s+deeply\b/.test(lowerMessage) ||
    /\bthink\s+hard\b/.test(lowerMessage) ||
    /\bthink\s+more\b/.test(lowerMessage) ||
    /\bmegathink\b/.test(lowerMessage)
  ) {
    level = 'medium';
    budgetTokens = 10000;
  }
  // Low thinking budget (4,000 tokens) - basic "think"
  else if (/\bthink\b/.test(lowerMessage)) {
    level = 'low';
    budgetTokens = 4000;
  }

  return {
    level,
    budgetTokens,
    enableInterleaved,
  };
}
```

### 2. Modified Provider Options Function

```typescript
// Updated in src/agent.ts

type ThinkingProviderResult = {
  providerOptions: any;
  headers: Record<string, string>;
};

function createThinkingProviderOptions(
  model: any,
  message?: string
): ThinkingProviderResult {
  const providerType = getProviderType(model);

  // Analyze message for thinking requirements
  const analysis = message
    ? analyzeMessageForThinking(message)
    : { level: 'none', budgetTokens: 0, enableInterleaved: false };

  // If no thinking requested, return minimal options
  if (analysis.level === 'none') {
    return {
      providerOptions: {},
      headers:
        analysis.enableInterleaved && providerType === 'anthropic'
          ? { 'anthropic-beta': 'interleaved-thinking-2025-05-14' }
          : {},
    };
  }

  switch (providerType) {
    case 'anthropic':
      return {
        providerOptions: {
          anthropic: {
            thinking: {
              type: 'enabled',
              budgetTokens: Math.min(
                analysis.budgetTokens,
                THINKING_CONFIG.anthropic.maxBudget
              ),
            },
          },
        },
        headers: analysis.enableInterleaved
          ? { 'anthropic-beta': 'interleaved-thinking-2025-05-14' }
          : {},
      };

    case 'openai':
      // Map our levels to OpenAI efforts
      const effortMap: Record<ThinkingLevel, string | undefined> = {
        none: undefined, // No reasoning effort when none requested
        low: 'low',
        medium: 'medium',
        high: 'high',
      };
      const reasoningEffort = effortMap[analysis.level];
      return {
        providerOptions: reasoningEffort
          ? {
              openai: { reasoningEffort },
            }
          : {},
        headers: {}, // OpenAI doesn't support interleaved thinking
      };

    case 'google':
      // Scale Google's budget based on our levels
      const googleBudgetMap: Record<ThinkingLevel, number> = {
        none: 0,
        low: 8192,
        medium: 16384,
        high: THINKING_CONFIG.google.maxBudget,
      };
      const thinkingBudget = googleBudgetMap[analysis.level];
      return {
        providerOptions:
          thinkingBudget > 0
            ? {
                google: { thinkingBudget },
              }
            : {},
        headers: {}, // Google doesn't support interleaved thinking
      };

    default:
      return {
        providerOptions: {},
        headers: {},
      };
  }
}
```

### 3. Updated Agent Execution

```typescript
// Modified in src/agent.ts

export async function runAgent(
  messagesOrUserMessage: CoreMessage[] | string,
  config: RuntimeConfiguration,
  session: AgentSession,
  isInteractive: boolean = false,
  onMessageUpdate?: (message: CoreMessage) => void
): Promise<AgentResult & { messages?: CoreMessage[] }> {
  // ... existing setup ...

  // Extract user message for analysis
  const userMessage = Array.isArray(messagesOrUserMessage)
    ? messagesOrUserMessage.find(m => m.role === 'user')?.content || ''
    : messagesOrUserMessage;

  // Get thinking options with message analysis
  const { providerOptions, headers } = createThinkingProviderOptions(
    model,
    typeof userMessage === 'string' ? userMessage : ''
  );

  const streamResult = streamText({
    model,
    system: systemConfig,
    messages: transformedMessages,
    tools,
    maxSteps: config.agent.maxSteps,
    maxRetries: MAX_GENERATION_RETRIES,
    abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    providerOptions,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  // ... rest of implementation ...
}
```

## Testing Strategy

### Unit Tests

1. **Message Analysis Tests** (`thinking/dynamicThinkingAnalyzer.test.ts`):

   ```typescript
   describe('analyzeMessageForThinking', () => {
     it('should return none for messages without thinking keywords', () => {
       expect(analyzeMessageForThinking('Hello world')).toEqual({
         level: 'none',
         budgetTokens: 0,
         enableInterleaved: false,
       });
     });

     it('should detect "think" for low level', () => {
       expect(
         analyzeMessageForThinking('Please think about this problem')
       ).toEqual({
         level: 'low',
         budgetTokens: 4000,
         enableInterleaved: false,
       });
     });

     it('should prioritize "think harder" over "think"', () => {
       expect(analyzeMessageForThinking('Think harder about this')).toEqual({
         level: 'high',
         budgetTokens: 31999,
         enableInterleaved: false,
       });
     });

     it('should enable interleaved only with "step by step"', () => {
       expect(analyzeMessageForThinking('Solve this step by step')).toEqual({
         level: 'none',
         budgetTokens: 0,
         enableInterleaved: true,
       });
     });

     it('should handle both thinking and interleaved independently', () => {
       expect(analyzeMessageForThinking('Think hard step by step')).toEqual({
         level: 'medium',
         budgetTokens: 10000,
         enableInterleaved: true,
       });
     });
   });
   ```

2. **Provider Options Tests** (update existing `agent.test.ts`):

   - Test each provider with different thinking levels
   - Verify no thinking options when level is 'none'
   - Test interleaved header independence
   - Verify budget caps are respected

3. **Integration Tests**:
   - End-to-end tests with real model calls
   - Verify headers are set correctly
   - Test with interactive mode
   - Ensure no thinking occurs without keywords

### E2E Tests

Create `e2e/dynamicThinking.test.ts`:

- Test actual model behavior with different thinking levels
- Verify no thinking occurs by default
- Test interleaved thinking header application
- Verify performance improvement when thinking is off

## Breaking Changes

Since this is a hard switch with no backward compatibility:

1. **Default Behavior Change**:

   - OLD: Thinking always enabled with default budgets
   - NEW: No thinking unless explicitly requested

2. **User Impact**:

   - Users must add thinking keywords to get reasoning behavior
   - Existing scripts/workflows will need updates
   - Performance improvement for non-thinking tasks

3. **Migration Guide**:

   ```bash
   # Old usage (thinking automatic)
   npx . "Analyze this code"

   # New usage (must request thinking)
   npx . "Think about and analyze this code"
   npx . "Think hard about this complex problem"
   npx . "Explain this step by step"  # Only adds interleaved header
   ```

## Performance Considerations

- **Regex Performance**: Simple regex patterns have negligible overhead (~1ms)
- **Default Path**: No thinking = significant token savings
- **Memory**: No additional memory requirements
- **Cost Reduction**: Users only pay for thinking when needed

## Implementation Checklist

- [ ] Create `src/thinking/dynamicThinkingAnalyzer.ts` with analysis function
- [ ] Add comprehensive unit tests for analyzer
- [ ] Update `createThinkingProviderOptions` to accept message parameter
- [ ] Modify `runAgent` to pass user message to provider options
- [ ] Update all existing tests to include thinking keywords where needed
- [ ] Remove hardcoded interleaved thinking header
- [ ] Add E2E tests for dynamic behavior
- [ ] Update README and documentation
- [ ] Add migration guide for users

## Future Enhancements

1. **Configurable Keywords**: Allow users to customize trigger words
2. **Context-Aware**: Consider conversation history for thinking needs
3. **Thinking Analytics**: Track thinking usage patterns
4. **Fine-grained Control**: Per-tool thinking budgets

## Conclusion

This design provides a clean, efficient system for dynamic thinking allocation that:

- Eliminates unnecessary thinking overhead
- Gives users explicit control over thinking behavior
- Separates interleaved thinking from budget control
- Significantly reduces costs for non-thinking tasks

The implementation is straightforward and provides immediate performance benefits for the majority of use cases that don't require deep reasoning.
