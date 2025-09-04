# Implementation Plan 1: MCP Server Self-Spawning Approach

## Executive Summary

This plan outlines the implementation of a self-spawning mechanism where the CLI AI agent creates a specialized MCP server that exposes itself as a tool. This approach leverages the existing MCP infrastructure to enable hierarchical agent coordination and parallel task execution.

## Architecture Overview

### Core Concept

The agent will create a special MCP server (`agent-spawner-server`) that provides tools for spawning new agent instances. This server runs as a persistent subprocess and manages agent execution through direct function calls rather than process spawning, providing better performance and resource efficiency.

### Key Components

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Parent Agent  │────│ Agent Spawner Server │────│   Agent         │
│                 │    │  (MCP Server)        │    │   Execution     │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
         │                         │                         │
         │                         │                         │
    ┌────▼────┐               ┌────▼────┐               ┌────▼────┐
    │MCP Tools│               │Function │               │Direct   │
    │         │               │Calls    │               │Execution│
    └─────────┘               └─────────┘               └─────────┘
```

## Technical Implementation

### 1. Agent Spawner MCP Server

**File**: `src/agentSpawnerServer.ts`

```typescript
/**
 * MCP Server that provides agent spawning capabilities
 * Manages agent execution through direct function calls for better performance
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { runAgent, initializeAgent } from './agent.js';
import { createRuntimeConfiguration } from './config.js';
import { z } from 'zod';

interface AgentExecution {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  task?: string;
  startTime: Date;
  result?: any;
  config: AgentSpawnConfig;
}

interface AgentSpawnConfig {
  provider?: string;
  model?: string;
  maxSteps?: number;
  timeout?: number;
  systemPrompt?: string;
  logLevel?: string;
}

function createAgentSpawnerServer(): McpServer {
  const server = new McpServer({
    name: 'agent-spawner',
    version: '1.0.0',
  });

  // Add the spawn_agent tool using direct function calls
  server.tool(
    'spawn_agent',
    {
      message: z.string().min(1, 'Message cannot be empty'),
      systemPrompt: z.string().optional(),
      timeout: z.number().int().positive().optional(),
    },
    async ({ message, systemPrompt, timeout }) => {
      // Direct execution of runAgent function
      const result = await executeAgentDirectly({
        message,
        systemPrompt,
        timeout,
      });
      return formatToolResponse(result);
    }
  );

  return server;
}

async function executeAgentDirectly(
  params: SpawnAgentParams
): Promise<AgentResult> {
  // Create configuration and run agent directly
  // No process spawning - just function calls
}
```

### 2. Agent Spawning Tools

The spawner server will provide the following tools:

#### `spawn_agent` Tool

```json
{
  "name": "spawn_agent",
  "description": "Spawn a new agent instance to handle a specific task",
  "inputSchema": {
    "type": "object",
    "properties": {
      "task": {
        "type": "string",
        "description": "The task for the new agent to execute"
      },
      "config": {
        "type": "object",
        "properties": {
          "provider": { "type": "string" },
          "model": { "type": "string" },
          "maxSteps": { "type": "number" },
          "timeout": { "type": "number" },
          "systemPrompt": { "type": "string" },
          "logLevel": { "type": "string" }
        }
      },
      "background": {
        "type": "boolean",
        "description": "Whether to run the agent in background (non-blocking)",
        "default": false
      }
    },
    "required": ["task"]
  }
}
```

#### `get_agent_status` Tool

```json
{
  "name": "get_agent_status",
  "description": "Get the status and results of a spawned agent",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agentId": {
        "type": "string",
        "description": "The ID of the agent to check"
      }
    },
    "required": ["agentId"]
  }
}
```

#### `list_agents` Tool

```json
{
  "name": "list_agents",
  "description": "List all spawned agents and their current status",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

#### `terminate_agent` Tool

```json
{
  "name": "terminate_agent",
  "description": "Terminate a running agent instance",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agentId": {
        "type": "string",
        "description": "The ID of the agent to terminate"
      }
    },
    "required": ["agentId"]
  }
}
```

#### `wait_for_agent` Tool

```json
{
  "name": "wait_for_agent",
  "description": "Wait for an agent to complete and return its results",
  "inputSchema": {
    "type": "object",
    "properties": {
      "agentId": {
        "type": "string",
        "description": "The ID of the agent to wait for"
      },
      "timeout": {
        "type": "number",
        "description": "Maximum time to wait in milliseconds",
        "default": 300000
      }
    },
    "required": ["agentId"]
  }
}
```

### 3. Integration with Existing MCP Infrastructure

**File**: `src/constants.ts` (modifications)

```typescript
export const MCP_SERVERS: MCPServerConfig[] = [
  // Existing servers...
  {
    name: 'filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
  {
    name: 'shell',
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-shell'],
  },
  // New agent spawner server
  {
    name: 'agent-spawner',
    type: 'stdio',
    command: 'node',
    args: ['dist/agentSpawnerServer.js'],
    description: 'Agent spawning and management server',
    autoStart: true, // Start automatically when parent agent starts
  },
];
```

### 4. Direct Agent Execution

**Simplified Implementation**: No longer requires complex process management

```typescript
/**
 * Direct agent execution without process spawning
 * More efficient and simpler to manage
 */

import { runAgent, initializeAgent } from './agent.js';
import { createRuntimeConfiguration } from './config.js';
import { CLIOptions } from './types.js';

async function executeAgentDirectly(params: SpawnAgentParams): Promise<{
  output: string;
  executionTime: number;
  exitCode: number;
}> {
  const startTime = Date.now();

  try {
    // Create CLI options from parameters
    const options: CLIOptions = {
      provider: 'openrouter',
      model: process.env.CLI_MODEL,
      logLevel: (process.env.CLI_LOG_LEVEL as any) || 'SILENT',
      logProgress: (process.env.CLI_LOG_PROGRESS as any) || 'none',
      json: true,
      maxSteps: 10,
      systemPrompt: params.systemPrompt,
    };

    // Create runtime configuration and initialize agent
    const configResult = await createRuntimeConfiguration(options);
    const initialized = await initializeAgent(configResult.config);

    if (!initialized) {
      throw new Error('Agent initialization failed');
    }

    // Run agent directly with timeout
    const result = await runAgentWithTimeout(
      params.message,
      configResult.config,
      params.timeout
    );

    return {
      output: JSON.stringify(result),
      executionTime: Date.now() - startTime,
      exitCode: result.success ? 0 : 1,
    };
  } catch (error) {
    return {
      output: JSON.stringify({ success: false, error: error.message }),
      executionTime: Date.now() - startTime,
      exitCode: 1,
    };
  }
}
```

### 5. Communication Protocol

**Inter-Agent Communication Format**:

```typescript
interface AgentMessage {
  type: 'task-request' | 'task-response' | 'status-update' | 'error';
  agentId: string;
  timestamp: Date;
  payload: {
    task?: string;
    result?: any;
    status?: string;
    error?: string;
    progress?: number;
  };
}
```

### 6. Configuration Extensions

**File**: `src/configTypes.ts` (additions)

```typescript
export interface AgentSpawnerConfig {
  enabled: boolean;
  maxConcurrentAgents: number;
  defaultTimeout: number;
  resourceLimits: {
    memory?: string;
    cpu?: number;
  };
  inheritEnvironment: boolean;
}

export interface RuntimeConfiguration extends Configuration {
  // Existing fields...
  agentSpawner?: AgentSpawnerConfig;
}
```

## Implementation Steps

### Phase 1: Core Infrastructure (Week 1-2)

1. **Create Agent Spawner Server** (`src/agentSpawnerServer.ts`)

   - Implement basic MCP server structure
   - Add direct function call execution
   - Implement basic tool handlers

2. **Direct Function Integration**

   - Import and use runAgent function directly
   - Configuration setup and initialization
   - Timeout and error handling

3. **Integration with MCP Loader**
   - Modify `src/constants.ts` to include spawner server
   - Ensure proper server initialization
   - Test basic connectivity

### Phase 2: Tool Implementation (Week 2-3)

1. **Implement spawn_agent tool**

   - Direct function execution with proper configuration
   - Configuration inheritance and overrides
   - Error handling and validation

2. **Implement monitoring tools** (Simplified)

   - Direct execution results instead of process monitoring
   - Synchronous execution with timeout handling
   - Error propagation and reporting

3. **Implement timeout and cancellation**
   - Promise-based timeout handling
   - Graceful error handling and cleanup

### Phase 3: Advanced Features (Week 3-4)

1. **Enhanced Configuration**

   - Advanced configuration options
   - Better error reporting and logging
   - Result formatting and serialization

2. **Performance Optimization**

   - Shared configuration caching
   - Optimized initialization
   - Memory usage optimization

3. **Advanced Error Handling**
   - Comprehensive error categorization
   - Retry mechanisms
   - Graceful degradation

### Phase 4: Testing and Optimization (Week 4-5)

1. **Unit Tests**

   - Agent spawner server tests
   - Direct execution function tests
   - Tool functionality tests

2. **Integration Tests**

   - End-to-end agent execution
   - Configuration inheritance testing
   - Error recovery testing

3. **Performance Optimization**
   - Function call overhead optimization
   - Memory usage optimization
   - Configuration caching efficiency

## Integration Points with Existing Architecture

### 1. MCP Loader Integration

- The spawner server will be loaded like any other MCP server
- Tools will be namespaced as `agent-spawner_spawn_agent`
- Existing error handling and logging will work seamlessly

### 2. Configuration System Integration

- New configuration options in `.envoy.json`
- CLI argument pass-through to child agents
- Environment variable inheritance

### 3. Logging Integration

- Child agent logs will be captured and forwarded
- Hierarchical logging with agent IDs
- Integration with existing log levels and progress reporting

## Technical Challenges and Solutions

### Challenge 1: Function Execution Management

**Problem**: Managing direct function execution, handling timeouts, error isolation
**Solution**:

- Promise-based timeout handling with proper cleanup
- Comprehensive error catching and reporting
- Isolated execution contexts for each agent call

### Challenge 2: Resource Management

**Problem**: Managing memory usage with shared execution context
**Solution**:

- Efficient configuration reuse and caching
- Timeout-based execution limits
- Proper cleanup of resources after execution

### Challenge 3: Configuration Inheritance

**Problem**: Passing configuration and environment between parent and child
**Solution**:

- Structured configuration serialization
- Environment variable filtering and inheritance
- Secure credential passing mechanisms

### Challenge 4: Result Handling and Serialization

**Problem**: Proper handling and formatting of execution results
**Solution**:

- Consistent JSON serialization of results
- Structured error reporting with context
- Timeout and cancellation result handling

### Challenge 5: Error Handling and Recovery

**Problem**: Handling failures in agent execution without affecting parent
**Solution**:

- Try-catch blocks with comprehensive error handling
- Graceful error reporting and recovery
- Isolated execution context to prevent parent corruption

## Benefits and Use Cases

### Benefits

1. **Efficient Execution**

   - Direct function calls eliminate process overhead
   - Faster execution with shared memory context
   - Reduced startup latency

2. **Error Isolation**

   - Try-catch blocks isolate execution failures
   - Parent agent remains stable during child failures
   - Better error reporting and debugging

3. **Specialized Agent Configurations**

   - Different models/providers for different task types
   - Customized system prompts per use case
   - Inherited configuration with selective overrides

4. **Simplified Architecture**
   - No complex process management required
   - Easier debugging and development
   - Better resource efficiency

### Use Cases

1. **Multi-Step Workflows**

   ```
   Parent Agent: "Analyze this codebase and create documentation"
   └── Child Agent 1: "Analyze code structure and patterns"
   └── Child Agent 2: "Generate API documentation"
   └── Child Agent 3: "Create user guides"
   └── Parent Agent: "Combine results into final documentation"
   ```

2. **Parallel Research Tasks**

   ```
   Parent Agent: "Research competitive landscape for product X"
   └── Child Agent 1: "Research competitor A"
   └── Child Agent 2: "Research competitor B"
   └── Child Agent 3: "Research market trends"
   └── Parent Agent: "Synthesize findings into report"
   ```

3. **Cross-Domain Analysis**

   ```
   Parent Agent: "Analyze this business proposal"
   └── Child Agent 1: "Technical feasibility (engineering model)"
   └── Child Agent 2: "Market analysis (business model)"
   └── Child Agent 3: "Financial projections (finance model)"
   └── Parent Agent: "Create comprehensive assessment"
   ```

4. **Monitoring and Alerting**
   ```
   Parent Agent: "Monitor system health"
   └── Background Child Agent 1: "Monitor database performance"
   └── Background Child Agent 2: "Monitor API response times"
   └── Background Child Agent 3: "Monitor error rates"
   └── Parent Agent: "Aggregate alerts and take action"
   ```

## Implementation Complexity Assessment

### Complexity: **Medium-High**

**Low Complexity Areas**:

- Basic MCP server structure (reusing existing patterns)
- Tool definition and registration
- Configuration integration

**Medium Complexity Areas**:

- Process lifecycle management
- Error handling and recovery
- Resource monitoring and limits

**High Complexity Areas**:

- Inter-agent communication protocols
- Complex state management across processes
- Comprehensive testing of concurrent scenarios

### Development Effort Estimate

- **Core Implementation**: 3-4 weeks
- **Testing and Optimization**: 1-2 weeks
- **Documentation and Examples**: 1 week
- **Total**: 5-7 weeks

### Risk Assessment

**Low Risk**:

- Basic functionality implementation
- Integration with existing MCP infrastructure

**Medium Risk**:

- Resource management under high load
- Error recovery in complex scenarios

**High Risk**:

- Process management edge cases
- Security implications of process spawning

## Pros and Cons Analysis

### Pros

1. **Natural MCP Integration**

   - Leverages existing infrastructure seamlessly
   - Tools are discoverable and usable like any other MCP tool
   - Consistent interface and error handling

2. **Efficient Execution**

   - No process spawning overhead
   - Shared memory space reduces resource usage
   - Faster execution with direct function calls

3. **Flexible Configuration**

   - Each agent execution can have different configurations
   - Dynamic model selection based on task requirements
   - Inherited or overridden settings per execution

4. **Simplified Architecture**

   - No complex process management required
   - Easier to debug and maintain
   - Better performance characteristics

5. **Better Error Handling**
   - Direct exception handling without IPC complexity
   - Better error context and stack traces
   - Simpler timeout and cancellation logic

### Cons

1. **Shared Memory Space**

   - All executions share the same memory space
   - Potential for memory leaks to affect parent
   - Harder to enforce resource limits per execution

2. **Less Isolation**

   - Errors in one execution could potentially affect others
   - Shared global state between executions
   - Memory management complexity

3. **Synchronous Execution**

   - Currently implemented as synchronous execution
   - Less parallelism compared to true process spawning
   - Blocking behavior for long-running tasks

4. **Limited Scalability**

   - All executions run in single process
   - Cannot distribute across multiple CPU cores effectively
   - Memory usage grows with concurrent executions

5. **Error Propagation Risk**
   - Catastrophic errors could affect parent process
   - Shared runtime state between executions
   - Harder to isolate resource-intensive operations

## Security Considerations

1. **Shared Process Context**

   - All executions run with same privileges as parent
   - No additional privilege isolation
   - Shared memory space security implications

2. **Resource Management**

   - Timeout-based execution limits
   - Memory usage monitoring (shared context)
   - Error isolation through try-catch blocks

3. **Configuration Security**
   - Environment variable inheritance controls
   - Secure parameter passing
   - No credential exposure in execution context

## Testing Strategy

### Unit Tests

- Agent spawner server functionality
- Direct execution function operations
- Tool execution and validation
- Configuration parsing and validation

### Integration Tests

- End-to-end agent execution workflows
- Configuration inheritance scenarios
- Error handling and recovery
- Timeout and cancellation behavior

### Performance Tests

- Function call execution benchmarks
- Memory usage profiling
- Configuration caching efficiency
- Resource cleanup verification

### Security Tests

- Configuration parameter validation
- Error isolation testing
- Timeout enforcement
- Memory leak detection

## Conclusion

The MCP Server Self-Spawning Approach with direct function calls provides an efficient foundation for agent coordination while leveraging the existing MCP infrastructure. The implementation is simpler and more performant than process-based spawning, with better resource utilization and easier debugging.

The approach maintains consistency with the current architecture while providing new capabilities for agent coordination and task execution. The direct function call approach eliminates process management complexity while maintaining the benefits of modular agent execution.

This implementation positions the CLI AI agent as an efficient orchestration platform capable of handling complex tasks through intelligent task decomposition and streamlined execution, with better performance characteristics than traditional process-based approaches.
