# Spawn Agent Tool Migration Plan

**Current State**: spawn_agent runs as a separate MCP server process  
**Desired State**: spawn_agent as a built-in AI SDK tool  
**Pattern**: Follow the successful todo tools migration  
**Benefit**: ~150ms latency reduction, simpler architecture, better reliability

This document contains the complete migration plan with analysis, strategy, and implementation details.

## Quick Reference

| Aspect | Before (MCP) | After (Built-in) | Improvement |
|--------|--------------|------------------|-------------|
| **Latency** | ~150ms | ~0ms | 150ms faster |
| **Lines of Code** | 230 | 150 | 35% reduction |
| **Process Overhead** | New process | Same process | Much lower |
| **Debugging** | Complex | Simple | Much easier |
| **Maintenance** | 2 files | 1 file | Easier |

**Files Involved:**
- Current: `src/tools/agentSpawnerServer.ts`, `src/constants.ts`
- New: `src/tools/spawnAgent.ts`, `src/agentSession.ts`
- Reference: `src/tools/todo.ts` (pattern to follow)

**Related Documents:**
- [Implementation Steps](./spawn-agent-implementation-steps.md) - Step-by-step guide

## Current Implementation Analysis

### How Spawn Agent Works Today

1. **Separate MCP Server Process**
   - Lives in `src/tools/agentSpawnerServer.ts`
   - Runs as a standalone MCP server using `@modelcontextprotocol/sdk`
   - Started as a child process via stdio transport
   - Registered in `src/constants.ts` via `createMCPServersWithConfig()`

2. **Registration Flow**
   ```
   createMCPServersWithConfig() 
   → Adds agent-spawner to MCP_SERVERS array
   → Command: npx tsx ./src/agentSpawnerServer.ts
   → Environment: AGENT_RUNTIME_CONFIG passed as JSON
   ```

3. **Tool Execution Flow**
   ```
   User calls spawn_agent
   → MCP client sends request to child process
   → agentSpawnerServer receives via stdio
   → spawnAndRunAgent() executes
   → Runtime config parsed from env variable
   → initializeAgentSession() called
   → runAgent() executes the task
   → cleanupAgentSession() cleans up
   → Result serialized and returned via stdio
   ```

4. **Configuration Passing**
   - Runtime config serialized to JSON string
   - Passed via `AGENT_RUNTIME_CONFIG` environment variable
   - Deserialized in `getRuntimeConfiguration()`
   - Custom system prompt applied if provided

## Problems with Current Approach

### 1. **Process Overhead**
- Each agent spawn requires starting a new Node.js process
- Process startup time adds latency (~100-200ms)
- Memory overhead for separate process
- Resource cleanup complexity

### 2. **Communication Overhead**
- MCP protocol over stdio adds serialization/deserialization
- JSON stringify/parse for config and results
- Bidirectional communication complexity
- Error handling across process boundaries

### 3. **State Management Issues**
- Runtime config must be serialized/deserialized
- Potential state synchronization problems
- Difficulty sharing state between parent and child
- Environment variable pollution

### 4. **Code Complexity**
- Separate server file to maintain
- MCP server boilerplate code
- Process lifecycle management
- Additional test infrastructure needed

### 5. **Debugging Difficulty**
- Harder to debug across process boundaries
- Separate log streams
- Stack traces don't cross process boundary
- IDE debugging complexity

### 6. **Reliability Concerns**
- Child process can crash independently
- Orphaned processes if parent crashes
- Resource leaks if cleanup fails
- Timeout handling complexity

## Todo Tools Migration Pattern

### Before: MCP Server (Hypothetical)
```typescript
// Separate MCP server file
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({...});
server.tool('todo_write', {...}, async (params) => {
  // Implementation
});
// Registered as separate process
```

### After: Built-in AI SDK Tool
```typescript
// In src/tools/todo.ts
import { tool } from 'ai';
import { z } from 'zod/v3';

export function createTodoTools() {
  return {
    todo_write: tool({
      description: '...',
      inputSchema: z.object({
        todos: z.string().describe('...'),
      }),
      execute: async ({ todos }) => {
        // Direct implementation
        return result;
      },
    }),
  };
}

// In src/agentSession.ts
const todoTools = createTodoTools();
const aiSDKTools = { ...tools, ...todoTools };
```

### Key Differences

| Aspect | MCP Server | Built-in Tool |
|--------|-----------|---------------|
| **Process** | Separate child process | Same process |
| **Communication** | stdio/MCP protocol | Direct function call |
| **Latency** | ~100-200ms startup | ~0ms |
| **State Sharing** | Environment variables | Direct access |
| **Debugging** | Complex (cross-process) | Simple (same stack) |
| **Error Handling** | Process boundaries | Native try/catch |
| **Code Location** | Separate server file | Single tool file |
| **Registration** | MCP_SERVERS array | agentSession tools |
| **Maintenance** | More complex | Simpler |

## Migration Strategy

### Phase 1: Create Built-in Tool File

**File: `src/tools/spawnAgent.ts`**

```typescript
/**
 * Built-in Spawn Agent Tool
 * Provides agent spawning functionality as a built-in AI SDK tool
 */

import { tool } from 'ai';
import { z } from 'zod/v3';
import { runAgent } from '../agent/index.js';
import {
  initializeAgentSession,
  cleanupAgentSession,
} from '../agentSession.js';
import { RuntimeConfiguration } from '../config/types.js';

/**
 * Creates the spawn agent tool using AI SDK's tool() helper
 */
export function createSpawnAgentTool(runtimeConfig: RuntimeConfiguration) {
  return {
    spawn_agent: tool({
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
          // Apply custom system prompt if provided
          let agentConfig = { ...runtimeConfig };
          
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

          // Set up maxSteps based on timeout
          const maxSteps = timeout || agentConfig.agent.maxSteps || 100;
          agentConfig = {
            ...agentConfig,
            agent: {
              ...agentConfig.agent,
              maxSteps: maxSteps,
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
            // Cleanup session resources
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
    }),
  };
}
```

### Phase 2: Integrate into Agent Session

**File: `src/agentSession.ts`**

```typescript
// Add import
import { createSpawnAgentTool } from './tools/spawnAgent.js';

// In initializeAgentSession function, after MCP tools are loaded:
const todoTools = createTodoTools();
const spawnAgentTool = createSpawnAgentTool(config);
const aiSDKTools = { ...tools, ...todoTools, ...spawnAgentTool };
```

### Phase 3: Remove MCP Server Registration

**File: `src/constants.ts`**

```typescript
// In createMCPServersWithConfig function, remove or comment out:
// Agent spawning server registration (now built-in)
/*
if (process.env.AGENT_SPAWNING_DISABLED !== 'true') {
  const agentSpawnerConfig: MCPServerConfig = {
    name: 'agent-spawner',
    type: 'stdio',
    command: 'npx',
    args: ['tsx', './src/agentSpawnerServer.ts'],
    env: { ... },
    description: 'Agent spawning server',
  };
  servers.unshift(agentSpawnerConfig);
}
*/
```

### Phase 4: Testing

1. **Unit Tests**
   - Create `src/tools/spawnAgent.test.ts`
   - Test tool creation
   - Test parameter validation
   - Test execution flow
   - Test error handling

2. **Integration Tests**
   - Test agent spawning with simple tasks
   - Test custom system prompts
   - Test timeout behavior
   - Test resource cleanup

3. **Performance Tests**
   - Compare latency: MCP vs built-in
   - Measure memory usage
   - Test concurrent spawning

### Phase 5: Deprecation & Cleanup

1. **Mark Old Implementation as Deprecated**
   - Add deprecation notice to `agentSpawnerServer.ts`
   - Keep file for backward compatibility (short term)

2. **Update Documentation**
   - Update README if needed
   - Update architecture docs
   - Add migration notes

3. **Remove Old Code** (after verification)
   - Delete `src/tools/agentSpawnerServer.ts`
   - Delete `src/tools/agentSpawnerServer.test.ts`
   - Remove MCP server registration code
   - Clean up related tests

## Benefits of Migration

### 1. **Performance Improvements**
- ✅ Zero process startup overhead
- ✅ Direct function calls (no IPC)
- ✅ Reduced latency (~100-200ms saved)
- ✅ Lower memory footprint

### 2. **Simplified Architecture**
- ✅ Single codebase location
- ✅ No process management needed
- ✅ Cleaner code organization
- ✅ Easier to understand flow

### 3. **Better Developer Experience**
- ✅ Easier debugging (single stack trace)
- ✅ Better IDE support
- ✅ Simpler testing
- ✅ Less boilerplate code

### 4. **Improved Reliability**
- ✅ No orphaned processes
- ✅ Better error propagation
- ✅ Simpler cleanup logic
- ✅ Direct state access

### 5. **Maintenance Benefits**
- ✅ Less code to maintain
- ✅ Fewer dependencies on MCP SDK
- ✅ Unified testing approach
- ✅ Consistent with other tools

## Risks & Mitigations

### Risk 1: State Pollution
**Risk**: Spawned agents might pollute parent process state
**Mitigation**: 
- Use proper session isolation
- Clean up sessions explicitly
- Use separate session IDs

### Risk 2: Memory Leaks
**Risk**: Failed cleanup could leak memory
**Mitigation**:
- Always use try/finally for cleanup
- Monitor memory usage
- Implement session timeout
- Use weak references where appropriate

### Risk 3: Concurrency Issues
**Risk**: Multiple concurrent spawns could interfere
**Mitigation**:
- Each spawn gets its own session
- Use unique session IDs
- Proper async handling
- Resource pooling if needed

### Risk 4: Error Isolation
**Risk**: Errors in spawned agent could crash parent
**Mitigation**:
- Comprehensive try/catch
- Error boundary pattern
- Timeout protection
- Resource limits

## Implementation Checklist

- [ ] Create `src/tools/spawnAgent.ts` with built-in tool
- [ ] Add unit tests for spawn agent tool
- [ ] Integrate into `agentSession.ts`
- [ ] Update type definitions if needed
- [ ] Add integration tests
- [ ] Test error cases
- [ ] Test timeout behavior
- [ ] Test custom system prompts
- [ ] Verify resource cleanup
- [ ] Performance benchmarking
- [ ] Remove MCP server registration
- [ ] Update documentation
- [ ] Delete old server file
- [ ] Clean up related code

## Timeline Estimate

- **Phase 1**: Create built-in tool - 2 hours
- **Phase 2**: Integration - 1 hour
- **Phase 3**: Remove MCP registration - 30 minutes
- **Phase 4**: Testing - 3 hours
- **Phase 5**: Cleanup & docs - 1 hour

**Total**: ~7.5 hours

## Success Criteria

1. ✅ spawn_agent tool works identically to before
2. ✅ All existing tests pass
3. ✅ New tests have good coverage
4. ✅ Latency improved by >50ms
5. ✅ Memory usage stable or improved
6. ✅ No orphaned processes
7. ✅ Proper error handling
8. ✅ Documentation updated
9. ✅ Old code removed
10. ✅ CI/CD passes

## Conclusion

Migrating the spawn agent tool from an MCP server to a built-in AI SDK tool will:
- Improve performance significantly
- Simplify the codebase
- Enhance maintainability
- Follow established patterns (like todo tools)
- Reduce complexity and potential bugs

The migration is straightforward, following the proven pattern used for todo tools, with clear benefits and manageable risks.
