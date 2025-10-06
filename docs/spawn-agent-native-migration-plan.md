# Spawn Agent Native AI SDK Migration Plan

## Problem

The spawn agent tool runs as a separate MCP server process, which is wrong for a bundled binary. The todo tools were migrated but incorrectly use `Object.assign` to add MCP metadata (`serverName`, `toolName`) to native tools, making them pretend to be MCP tools.

## Root Cause

- `AgentSession.tools` is typed as `Record<string, WrappedTool>` (src/types/index.ts:34)
- `WrappedTool = Tool & { serverName, toolName }` is for MCP tools only (src/types/index.ts:54-57)
- Built-in tools forced to use `Object.assign` to satisfy this type
- This is architecturally wrong - built-in tools should be plain `Tool` from AI SDK

## Files to Fix

1. **src/types/index.ts:34** - Change `AgentSession.tools` type
2. **src/tools/todo.ts:221-228** - Remove `Object.assign` hack
3. **src/tools/spawnAgent.ts** - New file, return plain `Tool` objects
4. **src/agentSession.ts:300-301** - Integration point
5. **src/constants.ts:355-374** - Remove MCP server registration

## Migration Steps

### Step 1: Fix Type System

**File: src/types/index.ts**

Change line 34 from:
```typescript
tools: Record<string, WrappedTool>;
```

To:
```typescript
tools: Record<string, Tool>;
```

**Rationale**: Since `WrappedTool extends Tool`, MCP tools (which are `WrappedTool`) can still be assigned. Built-in tools can be plain `Tool` without extra metadata.

### Step 2: Fix Todo Tools

**File: src/tools/todo.ts**

Remove lines 221-228 `Object.assign` hack:

```typescript
// BEFORE (WRONG):
return {
  todo_write: Object.assign(todoWrite, {
    serverName: 'built-in',
    toolName: 'todo_write',
  }),
  todo_list: Object.assign(todoList, {
    serverName: 'built-in',
    toolName: 'todo_list',
  }),
};

// AFTER (CORRECT):
return {
  todo_write: todoWrite,
  todo_list: todoList,
};
```

### Step 3: Create Spawn Agent Native Tool

**File: src/tools/spawnAgent.ts**

```typescript
import { tool } from 'ai';
import { z } from 'zod/v3';
import { runAgent } from '../agent/index.js';
import {
  initializeAgentSession,
  cleanupAgentSession,
} from '../agentSession.js';
import type { RuntimeConfiguration } from '../config/types.js';

export function createSpawnAgentTool(runtimeConfig: RuntimeConfiguration) {
  const spawnAgent = tool({
    description:
      'Use the spawn_agent tool to execute additional agent instances for complex multi-step tasks or when you need parallel processing. Provide a clear message, optionally customize the systemPrompt for specialized behavior, and set timeout if needed. Ideal for breaking down complex workflows, parallel research tasks, or when you need different agent configurations for different subtasks.',
    inputSchema: z.object({
      message: z.string().min(1, 'Message cannot be empty'),
      systemPrompt: z.string().optional(),
      timeout: z.number().int().positive().optional(),
    }),
    execute: async ({ message, systemPrompt, timeout }) => {
      const startTime = Date.now();

      try {
        // Clone config to avoid mutation
        let agentConfig = { ...runtimeConfig };

        // Apply custom system prompt if provided
        if (systemPrompt) {
          agentConfig = {
            ...agentConfig,
            agent: {
              ...agentConfig.agent,
              systemPrompt: {
                mode: 'append',
                value: systemPrompt,
              },
            },
          };
        }

        // Set maxSteps based on timeout
        const maxSteps = timeout || agentConfig.agent.maxSteps || 100;
        agentConfig = {
          ...agentConfig,
          agent: {
            ...agentConfig.agent,
            maxSteps,
          },
        };

        // Initialize agent session
        const agentSession = await initializeAgentSession(agentConfig);

        let result;
        try {
          // Run the agent with initialized session
          result = await runAgent(
            message,
            agentConfig,
            agentSession,
            false,
            undefined,
            AbortSignal.timeout(timeout || 600000)
          );
        } finally {
          // Always cleanup
          await cleanupAgentSession(agentSession);
        }

        const executionTime = Date.now() - startTime;

        return JSON.stringify({
          success: result.success,
          response: result.response,
          toolCallsCount: result.toolCallsCount,
          executionTime,
        });
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        return JSON.stringify({
          success: false,
          error: errorMessage,
          executionTime,
        });
      }
    },
  });

  // Return plain AI SDK tool - NO metadata
  return {
    spawn_agent: spawnAgent,
  };
}
```

### Step 4: Integrate into Agent Session

**File: src/agentSession.ts**

Add import:
```typescript
import { createSpawnAgentTool } from './tools/spawnAgent.js';
```

Update line 300-301:
```typescript
// Merge MCP tools and built-in tools
const todoTools = createTodoTools();
const spawnAgentTool = createSpawnAgentTool(config);
const aiSDKTools = { ...tools, ...todoTools, ...spawnAgentTool };
```

### Step 5: Remove MCP Server Registration

**File: src/constants.ts**

Remove lines 355-374 (the `createMCPServersWithConfig` agent-spawner section):
```typescript
// DELETED - spawn_agent is now a built-in tool (src/tools/spawnAgent.ts)
```

### Step 6: Delete Old Files

```bash
rm src/tools/agentSpawnerServer.ts
rm src/tools/agentSpawnerServer.test.ts
```

Update `src/tools/agentSpawning.toolcalls.test.ts` to use new implementation.

## Testing

### Unit Tests

**File: src/tools/spawnAgent.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSpawnAgentTool } from './spawnAgent.js';
import type { RuntimeConfiguration } from '../config/types.js';

describe('createSpawnAgentTool', () => {
  it('returns plain AI SDK tool without MCP metadata', () => {
    const config = {} as RuntimeConfiguration;
    const tools = createSpawnAgentTool(config);

    expect(tools.spawn_agent).toBeDefined();
    expect(tools.spawn_agent.description).toContain('spawn_agent');
    expect(tools.spawn_agent.inputSchema).toBeDefined();
    expect(tools.spawn_agent.execute).toBeTypeOf('function');

    // Should NOT have MCP metadata
    expect((tools.spawn_agent as any).serverName).toBeUndefined();
    expect((tools.spawn_agent as any).toolName).toBeUndefined();
  });
});
```

### Integration Tests

Test that the tool works exactly like the MCP version:
- Basic spawning
- Custom system prompts
- Timeout handling
- Error scenarios
- Resource cleanup

## Success Criteria

- [ ] `AgentSession.tools` typed as `Record<string, Tool>`
- [ ] Todo tools return plain `Tool` objects (no `Object.assign`)
- [ ] Spawn agent returns plain `Tool` objects (no `Object.assign`)
- [ ] All tests pass
- [ ] Type checking passes (`bun run type`)
- [ ] No MCP server for spawn agent
- [ ] Built-in tools have NO `serverName`/`toolName` properties
- [ ] MCP tools still work (they extend `Tool` so compatible)

## Benefits

- **Architectural Correctness**: Built-in tools are native, not fake MCP tools
- **Type Safety**: Types accurately reflect reality
- **Performance**: No process overhead for spawn agent
- **Simplicity**: Less code, clearer boundaries between MCP and built-in tools
- **Maintainability**: Clear separation of concerns

## Timeline

- Step 1: Fix types - 15 min
- Step 2: Fix todo tools - 10 min
- Step 3: Create spawn agent tool - 30 min
- Step 4: Integration - 10 min
- Step 5: Remove MCP registration - 5 min
- Step 6: Tests - 45 min
- **Total**: ~2 hours
