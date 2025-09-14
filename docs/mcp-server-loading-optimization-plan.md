# MCP Server Loading Optimization Plan

## Overview

This document outlines a comprehensive plan to optimize MCP (Model Context Protocol) server loading and reduce startup latency in the CLI AI agent. The current implementation loads servers sequentially and queries all capabilities regardless of server support, causing significant startup delays.

## Current Issues Identified

### 1. Sequential Server Loading

- **Location**: `mcpLoader.ts:610-646`
- **Issue**: `loadMCPTools()` processes servers sequentially in a for loop
- **Impact**: Total startup time = sum of all individual server connection times

### 2. Indiscriminate Capability Calls

- **Location**: `mcpLoader.ts:695-700`
- **Issue**: All servers are queried for tools, prompts, and resources regardless of support
- **Impact**: Unnecessary network calls and error handling for unsupported features

### 3. No Capability Negotiation

- **Issue**: Missing MCP initialization handshake to detect server capabilities
- **Impact**: Cannot optimize loading based on what servers actually support

### 4. Redundant Connection Establishment

- **Issue**: Each capability type may require separate client connections
- **Impact**: Inefficient resource utilization and connection overhead

## MCP Specification Analysis

### Initialize Request/Response Structure

**Client Initialize Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "clientInfo": {
      "name": "envoy",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": {},
      "prompts": {},
      "resources": {}
    }
  }
}
```

**Server Initialize Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "server-name",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": { "subscribe": false, "listChanged": true },
      "prompts": { "listChanged": true }
    }
  }
}
```

### ServerCapabilities Structure

```typescript
interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  logging?: {
    level?: string;
  };
}
```

## Optimization Strategy

### Phase 1: Parallel Server Initialization

**Goal**: Initialize all MCP servers concurrently using `Promise.all()`

**Current Code**:

```typescript
// Sequential loading (SLOW)
for (const config of serverConfigs) {
  const { tools, error } = await loadToolsFromServer(config, jsonMode);
  // Process each server one by one...
}
```

**Optimized Code**:

```typescript
// Parallel loading (FAST)
const serverPromises = serverConfigs.map((config) =>
  initializeServerWithCapabilities(config, jsonMode)
);
const results = await Promise.allSettled(serverPromises);
```

### Phase 2: MCP Capability Detection

**New Functions to Implement**:

1. **`initializeServerWithCapabilities()`**
   - Establishes connection with MCP initialize handshake
   - Detects server capabilities from initialize response
   - Returns structured result with client and capabilities

2. **`detectServerCapabilities()`**
   - Parses ServerCapabilities from MCP initialize response
   - Returns typed capability structure

3. **`loadCapabilitiesSelectively()`**
   - Only calls supported capability endpoints
   - Uses Promise.all() for concurrent capability loading

### Phase 3: Selective Capability Loading

**Strategy**:

- Check `capabilities.tools` before calling `client.listTools()`
- Check `capabilities.prompts` before calling `client.listPrompts()`
- Check `capabilities.resources` before calling `client.listResources()`

**Benefits**:

- Eliminates unnecessary network calls
- Reduces error handling for unsupported features
- Faster overall loading time

### Phase 4: Connection Lifecycle Management

**Improvements**:

- Single connection per server with proper capability detection
- Connection pooling for better resource utilization
- Health check integration with exponential backoff retry
- Timeout configuration per server type (stdio vs SSE)

### Phase 5: Error Handling and Resilience

**Industry Standard Patterns**:

- Circuit breaker pattern for consistently failing servers
- Graceful degradation when servers are unavailable
- Individual server timeouts don't block overall initialization
- Structured error reporting with server-specific details

## Implementation Plan

### Step 1: Create New Types

```typescript
// Add to types.ts

interface ServerCapabilities {
  tools?: { listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  logging?: { level?: string };
}

interface ServerInitResult {
  client: Client;
  capabilities: ServerCapabilities;
  config: MCPServerConfig;
  error?: string;
}

interface CapabilityLoadResult {
  tools: WrappedTool[];
  prompts: MCPPrompt[];
  resources: MCPResource[];
  errors: string[];
}
```

### Step 2: Implement Capability Detection

```typescript
// Add to mcpLoader.ts

async function detectServerCapabilities(
  client: Client
): Promise<ServerCapabilities> {
  // Send initialize request and parse capabilities from response
  // Implementation depends on MCP SDK client initialize method
}

async function initializeServerWithCapabilities(
  config: MCPServerConfig,
  jsonMode: boolean
): Promise<ServerInitResult | null> {
  try {
    const client = await createMCPClient(config);
    const capabilities = await detectServerCapabilities(client);

    return { client, capabilities, config };
  } catch (error) {
    logger.warn(`Failed to initialize ${config.name}: ${error.message}`);
    return null;
  }
}
```

### Step 3: Selective Capability Loading

```typescript
async function loadCapabilitiesSelectively(
  client: Client,
  capabilities: ServerCapabilities,
  config: MCPServerConfig,
  jsonMode: boolean
): Promise<CapabilityLoadResult> {
  const promises: Promise<any>[] = [];
  const errors: string[] = [];

  // Only load supported capabilities
  if (capabilities.tools) {
    promises.push(
      loadToolsFromServer(config, jsonMode).catch((error) => ({
        tools: [],
        error: error.message,
      }))
    );
  }

  if (capabilities.prompts) {
    promises.push(
      loadPromptsFromServer(client, config.name).catch((error) => ({
        prompts: [],
        error: error.message,
      }))
    );
  }

  if (capabilities.resources) {
    promises.push(
      loadResourcesFromServer(client, config.name).catch((error) => ({
        resources: [],
        error: error.message,
      }))
    );
  }

  const results = await Promise.allSettled(promises);

  // Process and merge results
  return {
    tools: [], // Extract from results
    prompts: [], // Extract from results
    resources: [], // Extract from results
    errors,
  };
}
```

### Step 4: Update Main Loading Function

```typescript
export async function loadMCPTools(
  serverConfigs: readonly MCPServerConfig[],
  jsonMode: boolean = false
): Promise<ToolLoadResult> {
  // Phase 1: Initialize all servers in parallel
  const initPromises = serverConfigs.map((config) =>
    initializeServerWithCapabilities(config, jsonMode)
  );

  const initResults = await Promise.allSettled(initPromises);

  // Filter successful initializations
  const successfulInits = initResults
    .filter(
      (result): result is PromiseFulfilledResult<ServerInitResult> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .map((result) => result.value);

  // Phase 2: Load capabilities selectively in parallel
  const capabilityPromises = successfulInits.map(
    ({ client, capabilities, config }) =>
      loadCapabilitiesSelectively(client, capabilities, config, jsonMode)
  );

  const capabilityResults = await Promise.allSettled(capabilityPromises);

  // Phase 3: Merge all tools and handle errors
  const allTools = new Map<string, WrappedTool>();
  const errors: Array<{ serverName: string; error: string }> = [];

  // Process capability results and merge tools
  // ... implementation details ...

  return {
    tools: allTools,
    errors,
  };
}
```

### Step 5: Connection Pooling and Health Checks

```typescript
// Future enhancement - connection management
class MCPConnectionManager {
  private connections = new Map<string, Client>();
  private capabilities = new Map<string, ServerCapabilities>();

  async getConnection(config: MCPServerConfig): Promise<Client> {
    // Implement connection pooling and health checks
  }

  async checkHealth(serverName: string): Promise<boolean> {
    // Implement health checking with exponential backoff
  }
}
```

## Expected Performance Improvements

### Startup Time Reduction

- **Current**: Sequential loading (5 servers × 2s each = 10s total)
- **Optimized**: Parallel loading (max 2s for slowest server = 2s total)
- **Improvement**: 60-80% reduction in startup time

### Network Efficiency

- Eliminate unnecessary capability requests for unsupported features
- Reduce error handling overhead
- Better connection resource utilization

### Error Resilience

- Failed servers don't block initialization of successful servers
- Graceful degradation with partial functionality
- Structured error reporting for debugging

### Resource Usage

- Better connection management and pooling
- Reduced memory footprint from fewer error objects
- Lower CPU usage from reduced sequential processing

## Testing Strategy

### Unit Tests

```typescript
describe('MCP Server Loading Optimization', () => {
  test('should initialize servers in parallel', async () => {
    // Mock multiple servers with different response times
    // Verify total time is not sum of individual times
  });

  test('should detect server capabilities correctly', async () => {
    // Mock servers with different capability combinations
    // Verify selective loading based on capabilities
  });

  test('should handle server failures gracefully', async () => {
    // Mock some failing servers
    // Verify successful servers still load
  });
});
```

### Integration Tests

```typescript
describe('Real MCP Server Integration', () => {
  test('should measure actual startup performance', async () => {
    // Use real MCP servers from fixtures
    // Measure and compare startup times
  });

  test('should work with various server types', async () => {
    // Test stdio and SSE server types
    // Verify capability detection works for both
  });
});
```

### Load Tests

```typescript
describe('Concurrent Server Load Tests', () => {
  test('should handle many servers efficiently', async () => {
    // Test with 10+ concurrent server connections
    // Verify no resource exhaustion or timeouts
  });
});
```

## Migration Strategy

### Phase 1: Implement Core Changes

1. Add new types and interfaces
2. Implement capability detection functions
3. Add parallel initialization logic

### Phase 2: Gradual Rollout

1. Feature flag for new vs old loading approach
2. A/B testing with performance metrics
3. Gradual migration of server configurations

### Phase 3: Cleanup

1. Remove old sequential loading code
2. Update documentation and examples
3. Performance monitoring and optimization

## Risk Mitigation

### Backward Compatibility

- Graceful fallback to sequential loading if parallel fails
- Support for servers that don't implement full MCP spec
- Configuration option to disable optimization if needed

### Error Handling

- Individual server timeouts don't affect others
- Comprehensive error logging for debugging
- Health check integration for automatic recovery

### Resource Management

- Connection limits to prevent resource exhaustion
- Proper cleanup of failed connections
- Memory usage monitoring and optimization

## Success Metrics

### Performance Metrics

- Startup time reduction (target: >60%)
- Network request reduction (eliminate ~30% unnecessary calls)
- Memory usage optimization (target: 20% reduction)

### Reliability Metrics

- Reduced error rate from capability mismatches
- Improved server failure isolation
- Faster recovery from transient network issues

### Developer Experience

- Better error messages with server-specific context
- Faster development cycle with quicker agent startup
- More reliable MCP server integration

## Future Enhancements

### Advanced Optimization

- Connection pooling and reuse
- Lazy loading of capabilities on-demand
- Caching of server capabilities

### Monitoring and Observability

- Metrics collection for server performance
- Health dashboard for MCP server status
- Alerting for server availability issues

### Configuration Management

- Dynamic server discovery and registration
- Hot-reloading of server configurations
- Auto-scaling based on demand patterns
