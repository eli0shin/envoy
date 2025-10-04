# Spawn Agent Migration - Detailed Implementation Steps

## Overview
This document provides step-by-step instructions for migrating the spawn_agent tool from an MCP server to a built-in AI SDK tool.

## Prerequisites
- [ ] Read `spawn-agent-migration-plan.md`
- [ ] Understand the current implementation in `src/tools/agentSpawnerServer.ts`
- [ ] Understand the todo tools pattern in `src/tools/todo.ts`
- [ ] Ensure all current tests pass

## Step-by-Step Implementation

### Step 1: Create the Built-in Tool File

**File**: `src/tools/spawnAgent.ts`

1. Create new file `src/tools/spawnAgent.ts`
2. Add the following imports:
   ```typescript
   import { tool } from 'ai';
   import { z } from 'zod/v3';
   import { runAgent } from '../agent/index.js';
   import {
     initializeAgentSession,
     cleanupAgentSession,
   } from '../agentSession.js';
   import { RuntimeConfiguration } from '../config/types.js';
   ```

3. Copy the core logic from `agentSpawnerServer.ts`:
   - Extract the `spawnAndRunAgent` function logic
   - Adapt it to work as a direct function call (not MCP server)
   - Remove MCP-specific code

4. Create the `createSpawnAgentTool` function:
   ```typescript
   export function createSpawnAgentTool(runtimeConfig: RuntimeConfiguration) {
     return {
       spawn_agent: tool({
         description: '...',
         inputSchema: z.object({
           message: z.string().min(1, 'Message cannot be empty'),
           systemPrompt: z.string().optional(),
           timeout: z.number().int().positive().optional(),
         }),
         execute: async ({ message, systemPrompt, timeout }) => {
           // Implementation
         },
       }),
     };
   }
   ```

5. Key implementation details:
   - Accept `runtimeConfig` as parameter (no need to get from env)
   - Clone config before modification (avoid mutation)
   - Apply custom system prompt if provided
   - Set up maxSteps based on timeout
   - Initialize agent session
   - Run agent with proper cleanup in try/finally
   - Return JSON-stringified result for consistency

### Step 2: Create Unit Tests

**File**: `src/tools/spawnAgent.test.ts`

1. Create test file with basic structure:
   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from 'vitest';
   import { createSpawnAgentTool } from './spawnAgent.js';
   import { RuntimeConfiguration } from '../config/types.js';
   ```

2. Test cases to implement:
   - [ ] Tool creation succeeds with valid config
   - [ ] Tool has correct schema validation
   - [ ] Execute succeeds with basic message
   - [ ] Custom system prompt is applied
   - [ ] Timeout parameter works correctly
   - [ ] Error handling for invalid inputs
   - [ ] Cleanup happens on success
   - [ ] Cleanup happens on error
   - [ ] Result format is correct
   - [ ] Session isolation works

3. Mock dependencies:
   - Mock `initializeAgentSession`
   - Mock `runAgent`
   - Mock `cleanupAgentSession`
   - Verify they're called correctly

### Step 3: Integrate into Agent Session

**File**: `src/agentSession.ts`

1. Add import at top:
   ```typescript
   import { createSpawnAgentTool } from './tools/spawnAgent.js';
   ```

2. In `initializeAgentSession` function, after todo tools:
   ```typescript
   // Merge MCP tools and built-in tools
   const todoTools = createTodoTools();
   const spawnAgentTool = createSpawnAgentTool(config);
   const aiSDKTools = { ...tools, ...todoTools, ...spawnAgentTool };
   ```

3. Update logging to reflect spawn agent tool:
   ```typescript
   logger.info('Agent session initialized', {
     setupTime: Date.now() - startTime,
     toolCount: Object.keys(aiSDKTools).length,
     mcpServerCount: mcpServers.length,
     builtInTools: ['todo_write', 'todo_list', 'spawn_agent'],
     errorCount: errors.length,
     persistenceEnabled: !!conversationPersistence,
   });
   ```

### Step 4: Add Feature Flag

**File**: `src/constants.ts`

1. Add environment variable check to allow gradual rollout:
   ```typescript
   // In createMCPServersWithConfig function
   
   // Use built-in spawn agent tool if enabled
   const useBuiltInSpawnAgent = 
     process.env.USE_BUILTIN_SPAWN_AGENT === 'true';
   
   // Add agent spawning server if not disabled AND not using built-in
   if (
     process.env.AGENT_SPAWNING_DISABLED !== 'true' && 
     !useBuiltInSpawnAgent
   ) {
     const agentSpawnerConfig: MCPServerConfig = {
       // ... existing code
     };
     servers.unshift(agentSpawnerConfig);
   }
   ```

**File**: `src/agentSession.ts`

2. Conditionally add spawn agent tool:
   ```typescript
   // Only add built-in spawn agent if feature flag is enabled
   const useBuiltInSpawnAgent = 
     process.env.USE_BUILTIN_SPAWN_AGENT === 'true';
   
   const spawnAgentTool = 
     useBuiltInSpawnAgent ? createSpawnAgentTool(config) : {};
   
   const aiSDKTools = { 
     ...tools, 
     ...todoTools, 
     ...spawnAgentTool 
   };
   ```

### Step 5: Integration Testing

**File**: `src/tools/spawnAgent.integration.test.ts`

1. Create integration test file
2. Test real agent spawning (not mocked):
   - [ ] Spawn agent with simple task
   - [ ] Verify agent executes correctly
   - [ ] Check result format
   - [ ] Test custom system prompt
   - [ ] Test timeout behavior
   - [ ] Test error propagation
   - [ ] Verify cleanup happens
   - [ ] Test concurrent spawning

3. Performance benchmarks:
   - Measure latency vs old MCP approach
   - Verify memory doesn't leak
   - Test under load

### Step 6: Update Existing Tests

1. Check for tests that use spawn_agent tool
2. Update mocks if needed
3. Ensure feature flag is set correctly in tests
4. Run full test suite:
   ```bash
   npm test
   ```

### Step 7: Enable Feature Flag by Default

1. Update `src/constants.ts`:
   ```typescript
   // Default to built-in spawn agent (can be disabled with env var)
   const useBuiltInSpawnAgent = 
     process.env.USE_BUILTIN_SPAWN_AGENT !== 'false';
   ```

2. Update `src/agentSession.ts` similarly:
   ```typescript
   const useBuiltInSpawnAgent = 
     process.env.USE_BUILTIN_SPAWN_AGENT !== 'false';
   ```

3. Test with feature enabled by default
4. Verify old MCP approach can still be used if needed

### Step 8: Remove MCP Server (After Verification)

**File**: `src/constants.ts`

1. Remove the agent spawner MCP server registration:
   ```typescript
   // Removed: Agent spawning is now a built-in tool
   // See src/tools/spawnAgent.ts
   ```

2. Clean up environment variable checks
3. Update comments

### Step 9: Deprecate Old Implementation

**File**: `src/tools/agentSpawnerServer.ts`

1. Add deprecation notice at top:
   ```typescript
   /**
    * @deprecated This MCP server approach has been replaced with a built-in AI SDK tool.
    * See src/tools/spawnAgent.ts for the new implementation.
    * This file will be removed in a future version.
    */
   ```

2. Keep file temporarily for reference
3. Plan removal date

### Step 10: Update Documentation

1. Update README if spawn_agent is mentioned
2. Update architecture documentation
3. Add migration notes
4. Update tool documentation

**File**: `docs/tools.md` (if exists)

Update spawn_agent documentation to reflect new implementation.

### Step 11: Performance Verification

1. Benchmark before and after:
   ```bash
   # Test latency
   time npx envoy "spawn an agent to list files"
   ```

2. Monitor metrics:
   - [ ] Latency improved by >50ms
   - [ ] Memory usage stable
   - [ ] No orphaned processes
   - [ ] CPU usage similar or better

3. Document improvements

### Step 12: Clean Up Old Code

**Only after thorough verification:**

1. Delete `src/tools/agentSpawnerServer.ts`
2. Delete `src/tools/agentSpawnerServer.test.ts`
3. Remove any related test utilities
4. Update imports if needed
5. Run tests again to ensure nothing broke

### Step 13: Final Verification

- [ ] All tests pass
- [ ] No regressions in functionality
- [ ] Performance improved
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] CI/CD passes
- [ ] Manual testing completed

## Rollback Plan

If issues are discovered:

1. **Immediate**: Set `USE_BUILTIN_SPAWN_AGENT=false`
2. **Short-term**: Revert commits related to built-in tool
3. **Long-term**: Fix issues and try again

## Testing Checklist

### Unit Tests
- [ ] Tool creation
- [ ] Parameter validation
- [ ] Execute function
- [ ] Error handling
- [ ] Cleanup logic

### Integration Tests
- [ ] Basic spawning
- [ ] Custom system prompt
- [ ] Timeout behavior
- [ ] Error scenarios
- [ ] Concurrent spawning
- [ ] Resource cleanup

### Manual Tests
- [ ] Simple task spawning
- [ ] Complex multi-step task
- [ ] Error recovery
- [ ] Performance comparison
- [ ] Memory leak check

## Success Metrics

- Latency: <50ms startup overhead (vs ~150ms before)
- Memory: No leaks over 100 spawns
- Reliability: 0 orphaned processes
- Tests: 100% pass rate
- Code: Reduced by ~200 lines

## Notes

- Keep MCP server code initially for fallback
- Use feature flag for gradual rollout
- Monitor production metrics closely
- Document any issues discovered
- Share learnings with team

## Questions to Answer

1. ✅ How does runtime config get passed?
   - Direct parameter instead of env variable

2. ✅ How do we handle session isolation?
   - Each spawn gets unique session ID
   - Sessions cleaned up in try/finally

3. ✅ What about concurrent spawns?
   - Each spawn is independent
   - Session management prevents conflicts

4. ✅ How do we test this?
   - Unit tests with mocks
   - Integration tests with real execution
   - Performance benchmarks

5. ✅ What's the rollback strategy?
   - Feature flag to disable
   - Keep old code temporarily
   - Can revert commits if needed
