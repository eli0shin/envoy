# MCP Server Process Cleanup Design

## Problem Statement

MCP servers are spawned as child processes through the MCP SDK's `StdioClientTransport`, but these processes are not properly cleaned up when the parent envoy CLI process exits. This results in ghost processes that continue running and consuming system resources after the main application terminates.

## Root Cause Analysis

### Current Architecture

The application uses the MCP SDK's `StdioClientTransport` which internally calls Node.js's `child_process.spawn()` to create child processes for MCP servers. The process flow is:

1. **Configuration Loading**: `src/config/mcpServers.ts` loads server configurations
2. **Transport Creation**: `src/mcp/transport/stdioTransport.ts` creates `StdioClientTransport` instances
3. **Client Connection**: `src/mcp/loader.ts` manages client lifecycle through `MCPClientWrapper`
4. **Process Registry**: `MCPClientWrapper` instances serve as an existing process registry

### The Missing Link

The root cause is a **process lifecycle management gap**:

- **No Exit Handlers**: The application doesn't register process exit handlers (`SIGINT`, `SIGTERM`, `exit`)
- **No Process Tracking**: Child processes aren't tracked at the application level
- **SDK Abstraction**: The MCP SDK hides the actual `ChildProcess` objects, making direct access difficult
- **No Cleanup Chain**: There's no mechanism to notify child processes when the parent is shutting down

Node.js doesn't automatically terminate child processes when the parent exits, so these processes continue running as ghost processes.

## Solution Design

### Architecture Overview

The solution leverages the existing `MCPClientWrapper` infrastructure as a process registry and adds a centralized cleanup coordination layer.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Process Cleanup Architecture                 │
├─────────────────────────────────────────────────────────────────┤
│  CLI Entry Point                                                │
│  ├─ Register Global Exit Handlers                              │
│  └─ Initialize Process Manager                                 │
├─────────────────────────────────────────────────────────────────┤
│  MCP Client Wrapper (Enhanced)                                 │
│  ├─ Track Child Process Reference                              │
│  ├─ Register with Process Manager                              │
│  └─ Implement Cleanup in disconnect()                          │
├─────────────────────────────────────────────────────────────────┤
│  Process Manager (New)                                         │
│  ├─ Centralized Process Registry                               │
│  ├─ Graceful Cleanup Logic                                     │
│  ├─ Timeout Protection                                         │
│  └─ Error Handling                                             │
├─────────────────────────────────────────────────────────────────┤
│  Transport Layer (Modified)                                    │
│  ├─ Extract Child Process from MCP SDK                         │
│  └─ Pass Reference to Client Wrapper                           │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Phases

## Phase 1: Process Registry Enhancement

### 1.1 Extract Child Process References

**File**: `src/mcp/transport/stdioTransport.ts`

Modify the `createStdioClient` function to extract and return the underlying child process:

```typescript
export async function createStdioClient(
  config: StdioMCPServerConfig
): Promise<{ client: Client; childProcess: ChildProcess }> {
  const resolvedCommand = await resolveCommand(config.command);

  const transport = new StdioClientTransport({
    command: resolvedCommand,
    args: config.args || [],
    env: config.env,
    cwd: config.cwd,
    stderr: 'pipe',
  });

  const client = new Client(
    {
      name: `envoy-${config.name}`,
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  );

  await client.connect(transport);

  // Extract child process reference from transport
  const childProcess = (transport as any).process as ChildProcess;

  // Handle stderr logging (existing code)
  if (childProcess?.stderr) {
    // ... existing stderr handling code
  }

  return { client, childProcess };
}
```

### 1.2 Enhance MCPClientWrapper

**File**: `src/types/index.ts`

Add child process tracking to the `MCPClientWrapper` interface:

```typescript
export interface MCPClientWrapper {
  serverName: string;
  serverConfig: MCPServerConfig;
  tools: Map<string, WrappedTool>;
  prompts: Map<string, MCPPrompt>;
  resources: Map<string, MCPResource>;
  isConnected: boolean;
  childProcess?: ChildProcess; // New field

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listPrompts(): Promise<MCPPrompt[]>;
  getPrompt(
    name: string,
    args?: Record<string, unknown>
  ): Promise<PromptResponse>;
  listResources(): Promise<MCPResource[]>;
  readResource(uri: string): Promise<ResourceResponse>;
}
```

**File**: `src/mcp/clientWrapperFactory.ts`

Update `createMCPClientWrapperFromData` to store the child process reference:

```typescript
export function createMCPClientWrapperFromData(
  client: Client,
  config: MCPServerConfig,
  capabilities: ServerCapabilities,
  tools: WrappedTool[],
  prompts: MCPPrompt[],
  resources: MCPResource[],
  childProcess?: ChildProcess // New parameter
): MCPClientWrapper {
  // ... existing code ...

  const wrapper: MCPClientWrapper = {
    serverName: config.name,
    serverConfig: config,
    tools: toolsMap,
    prompts: promptsMap,
    resources: resourcesMap,
    isConnected: false,
    childProcess, // Store reference

    async connect() {
      this.isConnected = true;
      // Register with process manager
      if (this.childProcess) {
        ProcessManager.getInstance().registerProcess(
          this.serverName,
          this.childProcess
        );
      }
    },

    async disconnect() {
      this.isConnected = false;
      this.tools = new Map();
      this.prompts = new Map();
      this.resources = new Map();

      // Cleanup child process
      if (this.childProcess) {
        ProcessManager.getInstance().cleanupProcess(this.serverName);
      }
    },

    // ... rest of existing methods
  };

  return wrapper;
}
```

## Phase 2: Global Process Manager

### 2.1 Create Process Cleanup Manager

**File**: `src/mcp/processManager.ts`

```typescript
import { ChildProcess } from 'child_process';
import { logger } from '../logger.js';

export class ProcessManager {
  private static instance: ProcessManager;
  private processes: Map<string, ChildProcess> = new Map();
  private cleanupInProgress = false;

  private constructor() {}

  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  registerProcess(serverName: string, childProcess: ChildProcess): void {
    this.processes.set(serverName, childProcess);
    logger.debug(
      `Registered MCP server process: ${serverName} (PID: ${childProcess.pid})`
    );
  }

  cleanupProcess(serverName: string): void {
    const process = this.processes.get(serverName);
    if (process) {
      this.terminateProcess(serverName, process);
      this.processes.delete(serverName);
    }
  }

  cleanupAll(): void {
    if (this.cleanupInProgress) {
      return; // Prevent duplicate cleanup
    }
    this.cleanupInProgress = true;

    logger.info(`Cleaning up ${this.processes.size} MCP server processes`);

    // Phase 1: Send SIGTERM to all processes
    const processEntries = Array.from(this.processes.entries());
    for (const [serverName, childProcess] of processEntries) {
      this.sendSignal(serverName, childProcess, 'SIGTERM');
    }

    // Phase 2: Wait for graceful shutdown
    const gracefulTimeout = 3000; // 3 seconds
    const startTime = Date.now();

    const waitForGracefulShutdown = () => {
      const remainingProcesses = Array.from(this.processes.entries()).filter(
        ([_, process]) => !process.killed && process.exitCode === null
      );

      if (remainingProcesses.length === 0) {
        logger.info('All MCP server processes terminated gracefully');
        return;
      }

      if (Date.now() - startTime > gracefulTimeout) {
        // Phase 3: Force kill remaining processes
        for (const [serverName, childProcess] of remainingProcesses) {
          this.sendSignal(serverName, childProcess, 'SIGKILL');
        }
        logger.warn(
          `Force killed ${remainingProcesses.length} unresponsive MCP server processes`
        );
      }
    };

    // Since this is called from exit handlers, we need synchronous cleanup
    const pollInterval = setInterval(waitForGracefulShutdown, 100);

    // Total timeout protection
    setTimeout(() => {
      clearInterval(pollInterval);
      logger.warn('Process cleanup timed out');
    }, 10000); // 10 seconds max

    // Initial check
    waitForGracefulShutdown();
  }

  private terminateProcess(
    serverName: string,
    childProcess: ChildProcess
  ): void {
    this.sendSignal(serverName, childProcess, 'SIGTERM');

    // Wait briefly, then force kill if needed
    setTimeout(() => {
      if (!childProcess.killed && childProcess.exitCode === null) {
        this.sendSignal(serverName, childProcess, 'SIGKILL');
      }
    }, 3000);
  }

  private sendSignal(
    serverName: string,
    childProcess: ChildProcess,
    signal: NodeJS.Signals
  ): void {
    try {
      if (childProcess.pid && !childProcess.killed) {
        childProcess.kill(signal);
        logger.debug(
          `Sent ${signal} to MCP server ${serverName} (PID: ${childProcess.pid})`
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ESRCH')) {
          // Process already dead
          logger.debug(`MCP server ${serverName} already terminated`);
        } else if (error.message.includes('EPERM')) {
          // Permission denied
          logger.warn(
            `Permission denied when terminating MCP server ${serverName}`
          );
        } else {
          logger.error(
            `Error terminating MCP server ${serverName}: ${error.message}`
          );
        }
      }
    }
  }

  getActiveProcessCount(): number {
    return this.processes.size;
  }
}
```

### 2.2 Register Global Exit Handlers

**File**: `src/cli/index.ts`

Add process cleanup initialization:

```typescript
import { ProcessManager } from '../mcp/processManager.js';

// Add this near the top of the main CLI function
function initializeProcessCleanup(): void {
  const processManager = ProcessManager.getInstance();

  // Handle normal exit
  process.on('exit', () => {
    processManager.cleanupAll();
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, cleaning up...');
    processManager.cleanupAll();
    process.exit(0);
  });

  // Handle termination signal
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, cleaning up...');
    processManager.cleanupAll();
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    processManager.cleanupAll();
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    processManager.cleanupAll();
    process.exit(1);
  });
}

// Call this early in your main function
export async function main() {
  initializeProcessCleanup();

  // ... rest of existing main function
}
```

## Phase 3: Integration Updates

### 3.1 Update Client Initialization

**File**: `src/mcp/client/initialization.ts`

Modify the client initialization to pass child process references:

```typescript
export async function initializeServerWithCapabilities(
  config: MCPServerConfig
): Promise<ServerInitResult | null> {
  try {
    let client: Client;
    let childProcess: ChildProcess | undefined;

    if (config.type === 'stdio') {
      const result = await createStdioClient(config);
      client = result.client;
      childProcess = result.childProcess;
    } else {
      // SSE transport doesn't have child processes
      client = await createSSEClient(config);
    }

    // ... rest of existing initialization code

    return {
      client,
      config,
      capabilities,
      childProcess, // Pass along child process reference
    };
  } catch (error) {
    // ... existing error handling
  }
}
```

### 3.2 Update Type Definitions

**File**: `src/types/index.ts`

Add child process to the `ServerInitResult` type:

```typescript
export interface ServerInitResult {
  client: Client;
  config: MCPServerConfig;
  capabilities: ServerCapabilities;
  childProcess?: ChildProcess;
}
```

## Phase 4: Testing Strategy

### 4.1 Unit Tests

**File**: `src/mcp/processManager.test.ts`

```typescript
import { ProcessManager } from './processManager.js';
import { spawn } from 'child_process';

describe('ProcessManager', () => {
  let processManager: ProcessManager;

  beforeEach(() => {
    processManager = ProcessManager.getInstance();
  });

  test('should register and track processes', () => {
    const mockProcess = spawn('sleep', ['10']);
    processManager.registerProcess('test-server', mockProcess);

    expect(processManager.getActiveProcessCount()).toBe(1);

    mockProcess.kill();
  });

  test('should cleanup individual processes', () => {
    const mockProcess = spawn('sleep', ['10']);
    processManager.registerProcess('test-server', mockProcess);

    processManager.cleanupProcess('test-server');

    expect(processManager.getActiveProcessCount()).toBe(0);
  });

  test('should handle cleanup of already dead processes', () => {
    const mockProcess = spawn('sleep', ['0.1']);
    processManager.registerProcess('test-server', mockProcess);

    // Wait for process to die naturally
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should not throw
    expect(() => processManager.cleanupProcess('test-server')).not.toThrow();
  });
});
```

### 4.2 Integration Tests

**File**: `src/mcp/processCleanup.integration.test.ts`

```typescript
import { loadMCPServersWithClients } from './loader.js';
import { ProcessManager } from './processManager.js';

describe('MCP Process Cleanup Integration', () => {
  test('should register processes during server loading', async () => {
    const configs = [
      {
        name: 'test-server',
        type: 'stdio' as const,
        command: 'echo',
        args: ['hello'],
      },
    ];

    const result = await loadMCPServersWithClients(configs);

    expect(result.clients.length).toBe(1);
    expect(result.clients[0].childProcess).toBeDefined();
    expect(ProcessManager.getInstance().getActiveProcessCount()).toBe(1);
  });
});
```

### 4.3 Interactive Tests

**File**: `interactive-tests/process-cleanup.interactive.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import { ptyTestUtils } from './helpers/ptyTestUtils.js';

describe('Process Cleanup Interactive Tests', () => {
  test('should cleanup processes on SIGINT', async () => {
    const { spawn, killProcess } = ptyTestUtils();

    const process = await spawn('node', [CLI_PATHS.built, 'test message']);

    // Send SIGINT
    process.kill('SIGINT');

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check for ghost processes
    const ghostProcesses = await checkForGhostProcesses();
    expect(ghostProcesses).toHaveLength(0);
  });
});
```

## Success Criteria

### Primary Goals

- **Zero ghost processes** after CLI termination under any circumstances
- **Graceful shutdown** with 3-5 second timeout for responsive processes
- **Force termination** for unresponsive processes after timeout
- **Robust error handling** for edge cases (dead processes, permission errors)

### Secondary Goals

- **Minimal performance impact** on normal operations
- **Backward compatibility** with existing MCP server configurations
- **Comprehensive logging** for debugging and monitoring
- **Test coverage** for all cleanup scenarios

### Monitoring

- Process count tracking in logs
- Cleanup duration metrics
- Error rate monitoring for failed cleanups
- Ghost process detection in CI/CD

## Risk Mitigation

### Potential Issues

1. **Timeout in Exit Handlers**: Synchronous cleanup in exit handlers could delay shutdown
2. **Process Permission Issues**: Some processes might not be killable due to permissions
3. **SDK Updates**: MCP SDK updates might change internal process handling
4. **Race Conditions**: Multiple cleanup calls or rapid process creation/destruction

### Mitigation Strategies

1. **Timeout Protection**: Maximum 10-second total cleanup time
2. **Graceful Degradation**: Log warnings but don't fail if some processes can't be killed
3. **Abstraction Layer**: Encapsulate SDK-specific logic for easier updates
4. **Mutex Protection**: Prevent concurrent cleanup operations

## Implementation Timeline

1. **Phase 1** (Week 1): Process registry enhancement and child process extraction
2. **Phase 2** (Week 2): Global process manager and exit handlers
3. **Phase 3** (Week 3): Integration updates and testing
4. **Phase 4** (Week 4): Comprehensive testing and documentation

This design ensures robust process cleanup while maintaining the existing architecture and providing a foundation for future enhancements.
