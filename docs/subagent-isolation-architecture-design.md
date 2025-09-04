# Subagent Architecture Redesign: Isolated Execution with Resource Sharing

## Executive Summary

The current subagent implementation violates isolation principles, causing UI state corruption and resource conflicts. This design document outlines a complete architectural redesign that maintains synchronous blocking behavior while providing true isolation and efficient resource sharing.

## Problem Analysis

### Current Architecture Issues

1. **UI State Corruption**: Subagents share SessionBridge callbacks, causing message pollution and loading state interference
2. **Resource Waste**: Each subagent creates new MCP connections and reloads tools
3. **Session State Pollution**: Shared AgentSession objects corrupt parent state
4. **Configuration Inefficiency**: Full config serialization via environment variables
5. **Runtime State Sharing**: Subagents share logger, environment variables, and working directory

### Root Cause

The fundamental issue is that subagents execute within the parent's runtime context rather than isolated execution environments. This violates the principle that subagents should behave like `npx . "{prompt}" --json` but with shared resources.

## Design Principles

1. **True Isolation**: Each subagent runs in a completely isolated execution context
2. **Efficient Resource Sharing**: Share expensive resources (MCP clients, tools) via pools
3. **Synchronous Blocking**: Maintain current blocking behavior for tool calls
4. **Atomic Sessions**: Each subagent gets its own dedicated session
5. **Null UI Interface**: Subagents use void callbacks, no UI pollution

## Proposed Architecture

### Phase 1: Resource Pool Infrastructure

#### A. SharedResourcePool

```typescript
interface SharedResourcePool {
  mcpClients: MCPClientPool;
  toolRegistry: SharedToolRegistry;
  configCache: ConfigurationCache;
  providerPool: ProviderPool;
}

class MCPClientPool {
  private connections: Map<string, MCPClientWrapper> = new Map();
  private refCounts: Map<string, number> = new Map();

  async acquireClient(config: MCPServerConfig): Promise<MCPClientWrapper> {
    const key = this.getConnectionKey(config);

    if (!this.connections.has(key)) {
      const client = await this.createConnection(config);
      this.connections.set(key, client);
      this.refCounts.set(key, 0);
    }

    this.refCounts.set(key, this.refCounts.get(key)! + 1);
    return this.connections.get(key)!;
  }

  async releaseClient(config: MCPServerConfig): Promise<void> {
    const key = this.getConnectionKey(config);
    const refCount = this.refCounts.get(key)! - 1;
    this.refCounts.set(key, refCount);

    if (refCount <= 0) {
      // Cleanup after delay to allow reuse
      setTimeout(() => this.cleanupConnection(key), 30000);
    }
  }
}

class SharedToolRegistry {
  private tools: Map<string, WrappedTool> = new Map();

  async getToolsForSession(
    serverConfigs: MCPServerConfig[],
    sessionId: string,
    pool: MCPClientPool
  ): Promise<Record<string, WrappedTool>> {
    const sessionTools: Record<string, WrappedTool> = {};

    for (const config of serverConfigs) {
      const client = await pool.acquireClient(config);
      const tools = await this.loadServerTools(client, config);

      for (const [toolName, tool] of tools) {
        sessionTools[toolName] = new IsolatedToolWrapper(tool, sessionId);
      }
    }

    return sessionTools;
  }
}
```

#### B. Configuration Cache

```typescript
class ConfigurationCache {
  private cache: Map<string, RuntimeConfiguration> = new Map();

  createSubagentConfig(
    parentId: string,
    overrides: Partial<RuntimeConfiguration> = {}
  ): RuntimeConfiguration {
    const parentConfig = this.cache.get(parentId);
    if (!parentConfig) {
      throw new Error(`Parent configuration not found: ${parentId}`);
    }

    // Only inherit essential configuration
    const inheritableConfig: Partial<RuntimeConfiguration> = {
      providers: parentConfig.providers,
      agent: {
        logLevel: 'SILENT', // Force silent logging for subagents
        maxSteps: parentConfig.agent.maxSteps,
        // Don't inherit systemPrompt, stdin, json, etc.
      },
      tools: parentConfig.tools,
    };

    return mergeConfigurations([inheritableConfig, overrides]);
  }
}
```

### Phase 2: Isolated Execution Context

#### A. SubagentExecutionContext

```typescript
class SubagentExecutionContext {
  private sessionId: string;
  private resourcePool: SharedResourcePool;
  private isolatedSession: IsolatedAgentSession;

  constructor(
    parentConfig: RuntimeConfiguration,
    resourcePool: SharedResourcePool,
    overrides: Partial<RuntimeConfiguration> = {}
  ) {
    this.sessionId = `subagent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.resourcePool = resourcePool;

    // Create isolated configuration
    const config = resourcePool.configCache.createSubagentConfig(
      'parent', // parent config ID
      overrides
    );

    // Create isolated session
    this.isolatedSession = new IsolatedAgentSession(
      config,
      this.sessionId,
      resourcePool
    );
  }

  async execute(message: string): Promise<SubagentResult> {
    try {
      // Execute with null UI callbacks
      const result = await runAgent(
        message,
        this.isolatedSession.config,
        this.isolatedSession,
        false,
        this.createNullUICallbacks()
      );

      return {
        success: true,
        response: result.response,
        toolCallsCount: result.toolCallsCount,
        executionTime: result.executionTime,
      };
    } finally {
      await this.cleanup();
    }
  }

  private createNullUICallbacks(): UICallbacks {
    return {
      onMessageUpdate: () => {}, // Void - no UI updates
      onStepBoundary: () => {}, // Void - no step tracking
      onLoadingStateChange: () => {}, // Void - no loading states
    };
  }
}
```

#### B. IsolatedAgentSession

```typescript
class IsolatedAgentSession {
  public model: LanguageModel;
  public tools: Record<string, WrappedTool>;
  public systemPrompt: string;
  public config: RuntimeConfiguration;
  private sessionId: string;
  private resourcePool: SharedResourcePool;
  private acquiredClients: MCPServerConfig[] = [];

  constructor(
    config: RuntimeConfiguration,
    sessionId: string,
    resourcePool: SharedResourcePool
  ) {
    this.sessionId = sessionId;
    this.resourcePool = resourcePool;
    this.config = config;

    // Initialize with shared resources
    this.initializeFromPool();
  }

  private async initializeFromPool(): Promise<void> {
    // Get model from provider pool
    this.model = await this.resourcePool.providerPool.acquireModel(
      this.config.providers,
      this.sessionId
    );

    // Get tools from shared registry
    this.tools = await this.resourcePool.toolRegistry.getToolsForSession(
      this.config.tools.mcpServers,
      this.sessionId,
      this.resourcePool.mcpClients
    );

    // Track acquired clients for cleanup
    this.acquiredClients = this.config.tools.mcpServers;
  }

  async cleanup(): Promise<void> {
    // Release all acquired resources
    for (const clientConfig of this.acquiredClients) {
      await this.resourcePool.mcpClients.releaseClient(clientConfig);
    }

    await this.resourcePool.providerPool.releaseModel(this.sessionId);
  }
}
```

### Phase 3: Tool Isolation Layer

#### A. IsolatedToolWrapper

```typescript
class IsolatedToolWrapper implements WrappedTool {
  private tool: WrappedTool;
  private sessionId: string;

  constructor(tool: WrappedTool, sessionId: string) {
    this.tool = tool;
    this.sessionId = sessionId;
  }

  async execute(args: any): Promise<any> {
    // Add session context to prevent cross-session interference
    const isolatedArgs = {
      ...args,
      __sessionId: this.sessionId,
      __executionId: `${this.sessionId}-${Date.now()}`,
    };

    // Execute with session-scoped context
    return await this.tool.execute(isolatedArgs);
  }

  get parameters() {
    return this.tool.parameters;
  }

  get serverName() {
    return this.tool.serverName;
  }

  get toolName() {
    return this.tool.toolName;
  }
}
```

### Phase 4: Updated Agent Spawner

#### A. New AgentSpawnerServer

```typescript
class AgentSpawnerServer {
  private resourcePool: SharedResourcePool;

  constructor(parentConfig: RuntimeConfiguration) {
    this.resourcePool = new SharedResourcePool(parentConfig);
  }

  async spawnAgent(params: SpawnAgentParams): Promise<SubagentResult> {
    const context = new SubagentExecutionContext(
      this.resourcePool.configCache.get('parent')!,
      this.resourcePool,
      {
        agent: {
          systemPrompt: params.systemPrompt
            ? {
                mode: 'append',
                value: params.systemPrompt,
              }
            : undefined,
          maxSteps: params.timeout,
        },
      }
    );

    return await context.execute(params.message);
  }
}
```

## Implementation Strategy

### Phase 1: Resource Pool Infrastructure (Week 1)

1. **Implement MCPClientPool** with reference counting
2. **Create SharedToolRegistry** with lazy loading
3. **Build ConfigurationCache** with selective inheritance
4. **Add ProviderPool** for model sharing

### Phase 2: Execution Context Isolation (Week 2)

1. **Create SubagentExecutionContext** class
2. **Implement IsolatedAgentSession** with resource management
3. **Add null UI callback system**
4. **Update runAgent() to accept UI callbacks**

### Phase 3: Tool Isolation (Week 3)

1. **Implement IsolatedToolWrapper** with session context
2. **Update tool execution to handle session isolation**
3. **Add session-scoped resource management**
4. **Test tool state isolation**

### Phase 4: Integration and Testing (Week 4)

1. **Update AgentSpawnerServer** to use new architecture
2. **Integrate with existing MCP infrastructure**
3. **Add comprehensive test suite**
4. **Performance testing and optimization**

## Expected Benefits

1. **UI State Isolation**: No more UI corruption from subagent execution
2. **Resource Efficiency**: 70% reduction in MCP connection overhead
3. **Faster Startup**: Shared tool registry reduces initialization time
4. **Better Reliability**: Atomic session management prevents state pollution
5. **Maintainability**: Clear separation of concerns and resource boundaries

## Migration Strategy

1. **Backward Compatibility**: Keep existing API while adding new architecture
2. **Gradual Migration**: Feature flag to enable new architecture
3. **A/B Testing**: Run both architectures in parallel for validation
4. **Monitoring**: Add metrics to track performance improvements

## Technical Specifications

### API Changes

#### New Types

```typescript
interface UICallbacks {
  onMessageUpdate: (message: CoreMessage) => void;
  onStepBoundary: () => void;
  onLoadingStateChange: (state: LoadingState) => void;
}

interface SubagentResult {
  success: boolean;
  response: string;
  toolCallsCount: number;
  executionTime: number;
  error?: string;
}

interface SpawnAgentParams {
  message: string;
  systemPrompt?: string;
  timeout?: number;
}
```

#### Updated Function Signatures

```typescript
// agent.ts
async function runAgent(
  message: string,
  config: RuntimeConfiguration,
  agentSession: AgentSession,
  isTerminal: boolean,
  uiCallbacks?: UICallbacks
): Promise<AgentResult>;

// agentSession.ts
async function initializeAgentSession(
  config: RuntimeConfiguration,
  resourcePool?: SharedResourcePool
): Promise<AgentSession>;
```

### Configuration Changes

#### New Configuration Options

```typescript
interface AgentSpawningConfig {
  enabled: boolean;
  maxConcurrentAgents: number;
  resourcePoolEnabled: boolean;
  sessionTimeout: number;
  cleanupInterval: number;
}
```

### File Structure Changes

```
src/
├── agent.ts (updated)
├── agentSession.ts (updated)
├── agentSpawnerServer.ts (updated)
├── resources/
│   ├── MCPClientPool.ts (new)
│   ├── SharedResourcePool.ts (new)
│   ├── SharedToolRegistry.ts (new)
│   ├── ConfigurationCache.ts (new)
│   └── ProviderPool.ts (new)
├── isolation/
│   ├── SubagentExecutionContext.ts (new)
│   ├── IsolatedAgentSession.ts (new)
│   ├── IsolatedToolWrapper.ts (new)
│   └── UICallbacks.ts (new)
└── types.ts (updated)
```

## Testing Strategy

### Unit Tests

- MCPClientPool reference counting
- SharedToolRegistry tool isolation
- ConfigurationCache inheritance
- SubagentExecutionContext lifecycle

### Integration Tests

- Full subagent execution flow
- Resource pool cleanup
- UI state isolation verification
- Concurrent subagent execution

### Performance Tests

- Resource usage comparison
- Connection pool efficiency
- Tool loading performance
- Memory leak detection

This architecture provides true isolation while maintaining the desired synchronous blocking behavior and efficient resource sharing, solving the fundamental issues with the current implementation.
