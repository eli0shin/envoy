# Implementation Plan 2: Direct Tool Integration Approach

**✅ IMPLEMENTED - CURRENT APPROACH ✅**

**Note: This implementation approach has been successfully implemented using direct function calls. The agent spawning functionality is now available through the MCP Server approach that calls `runAgent()` directly instead of spawning new processes. See `src/agentSpawnerServer.ts` for the current implementation.**

---

## Overview

This plan details implementing a self-spawning agent capability through direct integration into the existing tool loading system. The agent would appear as a built-in tool alongside MCP tools, allowing it to spawn new instances of itself through the existing WrappedTool framework.

**STATUS: IMPLEMENTED AS MCP SERVER WITH DIRECT FUNCTION CALLS**

## Current Architecture Analysis

### Key Components

- **Agent**: Main orchestrator (`agent.ts`) using generateText with step-by-step execution
- **MCP Loader**: Tool loading and wrapping system (`mcpLoader.ts`) with stdio/SSE support
- **Tool System**: WrappedTool interface with validation, timeout, and logging
- **Configuration**: File-based config system with CLI overrides
- **Tool Execution**: Tools executed through AI SDK with proper error handling

### Tool Loading Pipeline

1. **loadMCPTools()** - Loads from configured MCP servers
2. **createWrappedTool()** - Wraps tools with logging, validation, timeout
3. **convertToolsForAISDK()** - Converts to AI SDK format
4. **Tool Execution** - Via WrappedTool.execute() with error recovery

## Implementation Design

### 1. Built-in Tool Architecture

#### Core Components

**Built-in Tool Registry (`src/builtinTools.ts`)**

```typescript
export type BuiltinToolConfig = {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (args: any) => Promise<any>;
  category?: string;
  timeout?: number;
  requiresConfirmation?: boolean;
};

export const BUILTIN_TOOLS: Record<string, BuiltinToolConfig> = {
  'spawn-agent': {
    name: 'spawn-agent',
    description:
      'Spawn a new instance of the CLI AI agent to handle a specific task',
    parameters: z.object({
      task: z
        .string()
        .describe('The specific task or message for the new agent'),
      config: z
        .object({
          provider: z
            .string()
            .optional()
            .describe('AI provider to use (openai, openrouter)'),
          model: z.string().optional().describe('Specific model to use'),
          maxSteps: z
            .number()
            .optional()
            .describe('Maximum conversation steps'),
          logLevel: z
            .enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'])
            .optional(),
          logProgress: z.enum(['none', 'assistant', 'tool', 'all']).optional(),
          systemPrompt: z.string().optional().describe('Custom system prompt'),
          timeout: z
            .number()
            .optional()
            .describe('Execution timeout in milliseconds'),
        })
        .optional()
        .describe('Configuration overrides for the spawned agent'),
    }),
    execute: executeSpawnAgent,
    category: 'agent-management',
    timeout: 600000, // 10 minutes for spawned agents
    requiresConfirmation: false,
  },
};
```

**Agent Spawning Implementation**

```typescript
async function executeSpawnAgent(args: {
  task: string;
  config?: Partial<RuntimeConfiguration>;
}): Promise<{ result?: string; error?: string }> {
  try {
    // Create isolated configuration for spawned agent
    const spawnedConfig = await createSpawnedAgentConfig(args.config);

    // Create unique execution context
    const executionId = `spawn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Register spawned instance for tracking
    AgentInstanceManager.register(executionId, spawnedConfig);

    try {
      // Execute the spawned agent with isolated context
      const result = await runAgent(args.task, spawnedConfig);

      return {
        result: formatSpawnedAgentResult(result, executionId),
      };
    } finally {
      // Clean up spawned instance
      AgentInstanceManager.unregister(executionId);
    }
  } catch (error) {
    return {
      error: `Agent spawn failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
```

### 2. Tool Integration System

#### Modified Tool Loading Pipeline

**Enhanced loadMCPTools() in `mcpLoader.ts`**

```typescript
export async function loadAllTools(
  serverConfigs: readonly MCPServerConfig[],
  runtimeConfig: RuntimeConfiguration,
  jsonMode: boolean = false
): Promise<ToolLoadResult> {
  const allTools = new Map<string, WrappedTool>();
  const errors: Array<{ serverName: string; error: string }> = [];

  // Load built-in tools first
  const builtinResult = await loadBuiltinTools(runtimeConfig, jsonMode);
  for (const [toolKey, tool] of builtinResult.tools) {
    allTools.set(toolKey, tool);
  }
  errors.push(...builtinResult.errors);

  // Load MCP tools (existing logic)
  const mcpResult = await loadMCPTools(serverConfigs, jsonMode);
  for (const [toolKey, tool] of mcpResult.tools) {
    if (allTools.has(toolKey)) {
      errors.push({
        serverName: 'builtin',
        error: `Tool name conflict: ${toolKey} conflicts with built-in tool`,
      });
      continue;
    }
    allTools.set(toolKey, tool);
  }
  errors.push(...mcpResult.errors);

  return { tools: allTools, errors };
}
```

**Built-in Tool Loading**

```typescript
async function loadBuiltinTools(
  config: RuntimeConfiguration,
  jsonMode: boolean = false
): Promise<ToolLoadResult> {
  const tools = new Map<string, WrappedTool>();
  const errors: Array<{ serverName: string; error: string }> = [];

  const disabledTools = config.tools?.disabledInternalTools || [];

  for (const [toolName, toolConfig] of Object.entries(BUILTIN_TOOLS)) {
    if (disabledTools.includes(toolName)) {
      continue; // Skip disabled tools
    }

    try {
      const wrappedTool = createBuiltinWrappedTool(
        toolConfig,
        'builtin',
        config,
        jsonMode
      );
      tools.set(`builtin_${toolName}`, wrappedTool);
    } catch (error) {
      errors.push({
        serverName: 'builtin',
        error: `Failed to load built-in tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  return { tools, errors };
}
```

### 3. Agent Instance Management

#### Instance Tracking System

**Agent Instance Manager (`src/agentInstanceManager.ts`)**

```typescript
export type AgentInstance = {
  id: string;
  parentId?: string;
  config: RuntimeConfiguration;
  startTime: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result?: AgentResult;
  childInstances: Set<string>;
};

export class AgentInstanceManager {
  private static instances = new Map<string, AgentInstance>();
  private static maxInstances = 10; // Configurable limit

  static register(
    id: string,
    config: RuntimeConfiguration,
    parentId?: string
  ): void {
    if (this.instances.size >= this.maxInstances) {
      throw new Error(
        `Maximum concurrent agent instances (${this.maxInstances}) reached`
      );
    }

    const instance: AgentInstance = {
      id,
      parentId,
      config,
      startTime: new Date(),
      status: 'running',
      childInstances: new Set(),
    };

    this.instances.set(id, instance);

    // Update parent's child tracking
    if (parentId && this.instances.has(parentId)) {
      this.instances.get(parentId)!.childInstances.add(id);
    }
  }

  static unregister(id: string): void {
    const instance = this.instances.get(id);
    if (!instance) return;

    // Update parent's child tracking
    if (instance.parentId && this.instances.has(instance.parentId)) {
      this.instances.get(instance.parentId)!.childInstances.delete(id);
    }

    // Cancel any child instances
    for (const childId of instance.childInstances) {
      this.cancel(childId);
    }

    this.instances.delete(id);
  }

  static updateStatus(
    id: string,
    status: AgentInstance['status'],
    result?: AgentResult
  ): void {
    const instance = this.instances.get(id);
    if (instance) {
      instance.status = status;
      if (result) {
        instance.result = result;
      }
    }
  }

  static cancel(id: string): void {
    const instance = this.instances.get(id);
    if (instance && instance.status === 'running') {
      instance.status = 'cancelled';
      // Note: Actual cancellation would require AbortController integration
    }
  }

  static getActiveInstances(): AgentInstance[] {
    return Array.from(this.instances.values()).filter(
      (instance) => instance.status === 'running'
    );
  }

  static getInstance(id: string): AgentInstance | undefined {
    return this.instances.get(id);
  }
}
```

### 4. Configuration Management

#### Spawned Agent Configuration

**Configuration Isolation (`src/spawnedAgentConfig.ts`)**

```typescript
export async function createSpawnedAgentConfig(
  overrides?: Partial<RuntimeConfiguration>
): Promise<RuntimeConfiguration> {
  // Start with current agent's configuration as base
  const baseConfig = await getCurrentRuntimeConfig();

  // Apply spawned agent specific defaults
  const spawnedDefaults: Partial<RuntimeConfiguration> = {
    agent: {
      ...baseConfig.agent,
      maxSteps: Math.min(baseConfig.agent.maxSteps, 20), // Limit steps for spawned agents
      logLevel: 'SILENT', // Reduce noise unless explicitly set
      logProgress: 'none',
    },
    tools: {
      ...baseConfig.tools,
      disabledInternalTools: [
        ...(baseConfig.tools.disabledInternalTools || []),
        // Potentially disable spawn-agent to prevent infinite recursion
        // 'spawn-agent'
      ],
    },
  };

  // Merge configurations with proper precedence
  return mergeRuntimeConfigurations([
    baseConfig,
    spawnedDefaults,
    overrides || {},
  ]);
}

function mergeRuntimeConfigurations(
  configs: Partial<RuntimeConfiguration>[]
): RuntimeConfiguration {
  // Deep merge implementation with proper precedence
  // Last config in array takes precedence
  return configs.reduce((merged, config) => {
    return {
      ...merged,
      ...config,
      providers: { ...merged.providers, ...config.providers },
      agent: { ...merged.agent, ...config.agent },
      tools: { ...merged.tools, ...config.tools },
      mcpServers: { ...merged.mcpServers, ...config.mcpServers },
    };
  }, {} as RuntimeConfiguration);
}
```

### 5. Lifecycle Management

#### Process Management

**Spawned Agent Lifecycle**

```typescript
export class SpawnedAgentLifecycle {
  private abortController: AbortController;
  private timeoutHandle?: NodeJS.Timeout;

  constructor(
    private executionId: string,
    private config: RuntimeConfiguration
  ) {
    this.abortController = new AbortController();
    this.setupTimeout();
  }

  private setupTimeout(): void {
    const timeout = this.config.agent.timeout || GENERATION_TIMEOUT_MS;
    this.timeoutHandle = setTimeout(() => {
      this.abort('timeout');
    }, timeout);
  }

  async execute(task: string): Promise<AgentResult> {
    try {
      AgentInstanceManager.updateStatus(this.executionId, 'running');

      // Execute with abort signal for cancellation support
      const result = await runAgentWithAbort(
        task,
        this.config,
        this.abortController.signal
      );

      AgentInstanceManager.updateStatus(this.executionId, 'completed', result);
      return result;
    } catch (error) {
      const errorResult: AgentResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        toolCallsCount: 0,
        executionTime: 0,
      };

      AgentInstanceManager.updateStatus(
        this.executionId,
        'failed',
        errorResult
      );
      throw error;
    } finally {
      this.cleanup();
    }
  }

  abort(reason: string): void {
    this.abortController.abort(reason);
    AgentInstanceManager.updateStatus(this.executionId, 'cancelled');
  }

  private cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
  }
}
```

### 6. Integration Points

#### Modified Agent Execution

**Enhanced runAgent() in `agent.ts`**

```typescript
export async function runAgent(
  userMessage: string,
  config: RuntimeConfiguration,
  abortSignal?: AbortSignal
): Promise<AgentResult> {
  // ... existing setup code ...

  // Load all tools (built-in + MCP)
  const { tools, errors } = await loadAllTools(
    mcpServers,
    config,
    config.json || false
  );

  // ... rest of existing logic with abort signal support ...
}

export async function runAgentWithAbort(
  userMessage: string,
  config: RuntimeConfiguration,
  abortSignal: AbortSignal
): Promise<AgentResult> {
  return runAgent(userMessage, config, abortSignal);
}
```

### 7. Error Handling & Recovery

#### Robust Error Management

**Error Recovery Strategies**

```typescript
export class SpawnedAgentErrorHandler {
  static async handleSpawnError(
    error: Error,
    context: {
      task: string;
      config: RuntimeConfiguration;
      executionId: string;
    }
  ): Promise<{ result?: string; error: string }> {
    logger.error('Spawned agent error', {
      executionId: context.executionId,
      task: context.task.substring(0, 100),
      error: error.message,
    });

    // Determine if error is recoverable
    if (error instanceof TimeoutError) {
      return {
        error: `Spawned agent timed out after ${context.config.agent.timeout}ms. Task may be too complex or require more time.`,
      };
    }

    if (error instanceof ValidationError) {
      return {
        error: `Spawned agent configuration error: ${error.message}`,
      };
    }

    if (error instanceof ResourceError) {
      return {
        error: `Spawned agent resource error: ${error.message}. Try reducing task complexity or agent limits.`,
      };
    }

    // Generic error
    return {
      error: `Spawned agent failed: ${error.message}`,
    };
  }
}
```

### 8. Performance & Resource Management

#### Resource Controls

**Resource Management**

```typescript
export class AgentResourceManager {
  private static readonly MAX_CONCURRENT_AGENTS = 3;
  private static readonly MAX_MEMORY_MB = 512;
  private static readonly MAX_EXECUTION_TIME_MS = 300000; // 5 minutes

  static canSpawnAgent(): { allowed: boolean; reason?: string } {
    const activeCount = AgentInstanceManager.getActiveInstances().length;

    if (activeCount >= this.MAX_CONCURRENT_AGENTS) {
      return {
        allowed: false,
        reason: `Maximum concurrent agents (${this.MAX_CONCURRENT_AGENTS}) reached`,
      };
    }

    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

    if (memoryMB > this.MAX_MEMORY_MB) {
      return {
        allowed: false,
        reason: `Memory usage too high (${memoryMB.toFixed(1)}MB > ${this.MAX_MEMORY_MB}MB)`,
      };
    }

    return { allowed: true };
  }

  static enforceResourceLimits(
    config: RuntimeConfiguration
  ): RuntimeConfiguration {
    return {
      ...config,
      agent: {
        ...config.agent,
        maxSteps: Math.min(config.agent.maxSteps, 15),
        timeout: Math.min(config.agent.timeout, this.MAX_EXECUTION_TIME_MS),
      },
    };
  }
}
```

## Technical Implementation Details

### 1. Tool Schema Integration

**Zod Schema for Agent Spawning**

```typescript
const SpawnAgentSchema = z.object({
  task: z
    .string()
    .min(1, 'Task cannot be empty')
    .max(1000, 'Task too long')
    .describe('The specific task or question for the spawned agent'),

  config: z
    .object({
      provider: z.enum(['openai', 'openrouter']).optional(),
      model: z.string().optional(),
      maxSteps: z.number().min(1).max(50).optional(),
      logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT']).optional(),
      systemPrompt: z.string().max(2000).optional(),
      timeout: z.number().min(1000).max(600000).optional(),
    })
    .optional()
    .describe('Configuration overrides for the spawned agent'),
});
```

### 2. Logging Integration

**Enhanced Logging for Spawned Agents**

```typescript
export function createSpawnedAgentLogger(
  parentLogger: Logger,
  executionId: string
): Logger {
  return {
    ...parentLogger,
    info: (message: string, meta?: any) => {
      parentLogger.info(`[spawn:${executionId}] ${message}`, meta);
    },
    error: (message: string, meta?: any) => {
      parentLogger.error(`[spawn:${executionId}] ${message}`, meta);
    },
    warn: (message: string, meta?: any) => {
      parentLogger.warn(`[spawn:${executionId}] ${message}`, meta);
    },
    debug: (message: string, meta?: any) => {
      parentLogger.debug(`[spawn:${executionId}] ${message}`, meta);
    },
  };
}
```

### 3. Configuration Schema Updates

**Enhanced Configuration Types**

```typescript
export interface ToolsConfig {
  disabledInternalTools?: string[];
  globalTimeout?: number;
  maxConcurrentSpawns?: number;
  spawnResourceLimits?: {
    maxMemoryMB?: number;
    maxExecutionTimeMs?: number;
    maxSteps?: number;
  };
}
```

## Benefits & Use Cases

### Benefits of Current Implementation

1. **High Performance**: Direct function calls eliminate process spawning overhead
2. **Simplicity**: No complex process or instance management required
3. **Reliability**: No process coordination or IPC communication needed
4. **Memory Efficiency**: Shared memory space with proper isolation
5. **Fast Execution**: Immediate start with no CLI parsing delays
6. **Easy Debugging**: All execution happens in the same process
7. **Consistent Error Handling**: Direct error propagation and handling

### Use Cases

1. **Parallel Task Processing**

   ```
   "Analyze this codebase for security issues while simultaneously checking for performance problems"
   ```

2. **Specialized Sub-tasks**

   ```
   "Review this document and spawn a separate agent to fact-check all claims"
   ```

3. **Multi-step Workflows**

   ```
   "Research the topic, then spawn an agent to write a summary based on the findings"
   ```

4. **Domain-specific Processing**

   ```
   "Use a spawned agent with specialized prompts to handle this financial analysis"
   ```

5. **Concurrent Data Processing**
   ```
   "Process each file in this directory with separate agent instances"
   ```

## Technical Challenges & Limitations

### Challenges

1. **Resource Management**: Managing memory and CPU usage across multiple instances
2. **State Isolation**: Ensuring spawned agents don't interfere with each other
3. **Configuration Complexity**: Managing inheritance and overrides
4. **Error Propagation**: Handling failures in spawned agents gracefully
5. **Debugging Complexity**: Tracing issues across multiple agent instances
6. **Tool Conflicts**: Managing tool availability in spawned contexts

### Limitations

1. **Recursive Spawning**: Risk of infinite recursion if not properly controlled
2. **Resource Overhead**: Each spawned agent has memory and processing overhead
3. **Complexity**: Increases overall system complexity significantly
4. **Debugging**: More difficult to debug issues across multiple instances
5. **Testing**: Requires sophisticated testing for concurrent scenarios

### Mitigation Strategies

1. **Resource Limits**: Hard limits on concurrent agents, memory, and execution time
2. **Spawn Depth Limits**: Prevent deep recursive spawning
3. **Configuration Validation**: Strict validation of spawned agent configurations
4. **Monitoring**: Comprehensive logging and monitoring of spawned agents
5. **Graceful Degradation**: Fallback strategies when resource limits are reached

## Implementation Complexity Assessment

### Development Effort: **Medium-High**

**Phase 1 (Core Integration)**: 3-4 weeks

- Built-in tool system
- Basic agent spawning
- Configuration management
- Error handling

**Phase 2 (Advanced Features)**: 2-3 weeks

- Instance management
- Resource controls
- Enhanced logging
- Testing framework

**Phase 3 (Production Hardening)**: 2-3 weeks

- Performance optimization
- Security validation
- Comprehensive testing
- Documentation

**Total Estimated Effort**: 7-10 weeks

### Risk Assessment: **Medium**

**Technical Risks**:

- Resource management complexity
- State isolation challenges
- Configuration inheritance issues

**Mitigation**: Extensive testing, gradual rollout, comprehensive monitoring

## Conclusion

The Direct Tool Integration Approach provides a clean, architecturally consistent way to implement self-spawning agent capabilities. By leveraging the existing WrappedTool framework, it minimizes architectural changes while providing powerful parallel processing capabilities.

The approach balances functionality with complexity, offering significant benefits for advanced use cases while maintaining system stability through proper resource management and error handling.

This implementation would position the CLI agent as a more powerful, scalable solution capable of handling complex, multi-faceted tasks through intelligent task decomposition and parallel execution.
