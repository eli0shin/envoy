# Unified Resource Discovery System Design

## Overview

This document outlines the design for a unified resource discovery system that enhances the AI model's ability to intelligently discover, search, and access resources across all MCP servers. The current per-server approach (`filesystem_list_resources`, etc.) will be supplemented with unified tools that provide cross-server resource discovery and intelligent content routing.

## Current State Analysis

### Existing Implementation

- **Per-Server Tools**: Each MCP server exposes `{serverName}_list_resources` and `{serverName}_read_resource`
- **Manual Discovery**: Model must explicitly call list tools for each server separately
- **URI-Based Access**: Requires exact URI knowledge for resource reading
- **JSON Interface**: All resource data returned as JSON strings

### Limitations

1. **Fragmented Discovery**: No unified view of resources across all servers
2. **Manual Server Selection**: Model must know which server contains desired resources
3. **No Intelligent Search**: No content-based or relevance-based resource discovery
4. **Limited Filtering**: No ability to filter by content type, size, or relevance
5. **Performance Issues**: No caching or batch operations

## Design Goals

### Primary Objectives

1. **Unified Discovery**: Single interface to discover resources across all MCP servers
2. **Intelligent Search**: Content-aware and context-sensitive resource discovery
3. **Simplified Access**: Reduce the number of tool calls needed for common workflows
4. **Performance Optimization**: Caching and batch operations for better response times
5. **Model Guidance**: Clear instructions and workflows for AI model usage

### Secondary Objectives

1. **Backward Compatibility**: Maintain existing per-server tools
2. **Extensible Architecture**: Support future MCP server additions
3. **Rich Metadata**: Enhanced resource information for better model decision-making
4. **Error Resilience**: Graceful handling of server failures or timeouts

## Proposed Tool Set

### 1. `discover_resources`

**Purpose**: Intelligent resource discovery across all MCP servers with optional filtering and search

**Parameters**:

```typescript
{
  query?: string,           // Search term for content/name matching
  contentTypes?: string[],  // Filter by MIME types ['text/plain', 'application/json']
  servers?: string[],       // Limit search to specific servers
  maxResults?: number,      // Maximum resources to return (default: 20)
  includeContent?: boolean, // Whether to include content preview (default: false)
  relevanceThreshold?: number // Minimum relevance score (0-1, default: 0.3)
}
```

**Returns**:

```typescript
{
  resources: Array<{
    uri: string,
    name?: string,
    description?: string,
    mimeType?: string,
    server: string,
    size?: number,
    lastModified?: string,
    relevanceScore: number,
    contentPreview?: string  // First 200 chars if includeContent=true
  }>,
  totalFound: number,
  serversSearched: string[],
  errors?: Array<{server: string, error: string}>
}
```

### 2. `get_resource`

**Purpose**: Smart resource retrieval with automatic server routing and content optimization

**Parameters**:

```typescript
{
  uri: string,              // Resource URI
  format?: 'json' | 'text' | 'binary' | 'auto', // Response format preference
  maxSize?: number,         // Maximum content size in bytes
  server?: string           // Optional server hint for faster routing
}
```

**Returns**:

```typescript
{
  uri: string,
  server: string,
  mimeType?: string,
  size: number,
  content: string | object,  // Based on format parameter
  metadata: {
    lastModified?: string,
    encoding?: string,
    cached: boolean,
    truncated: boolean
  }
}
```

### 3. `search_resources`

**Purpose**: Advanced search with content indexing and semantic matching

**Parameters**:

```typescript
{
  searchTerms: string[],     // Multiple search terms (AND logic)
  searchScope: 'name' | 'description' | 'content' | 'all',
  fuzzyMatch?: boolean,      // Enable fuzzy string matching
  dateRange?: {
    after?: string,          // ISO date string
    before?: string
  },
  servers?: string[],
  maxResults?: number
}
```

**Returns**: Similar to `discover_resources` but with search-specific metadata

### 4. `resource_summary`

**Purpose**: Get overview of all available resources organized by server and type

**Parameters**:

```typescript
{
  includeStats?: boolean,    // Include resource count statistics
  groupBy?: 'server' | 'type' | 'none'
}
```

**Returns**:

```typescript
{
  summary: {
    totalResources: number,
    serverCount: number,
    resourcesByServer: Record<string, number>,
    resourcesByType: Record<string, number>
  },
  resourceGroups: Array<{
    groupName: string,
    resources: Array<ResourceSummary>
  }>
}
```

## Model Instructions and Usage Patterns

### Recommended Model Workflow

#### 1. **Resource Discovery Pattern**

```
When a user asks about finding information or data:
1. Use `discover_resources` with relevant query terms
2. Review results and select most relevant resources
3. Use `get_resource` to retrieve specific content
4. Synthesize information and respond to user
```

#### 2. **Exploration Pattern**

```
When exploring an unfamiliar codebase or system:
1. Use `resource_summary` to get overview
2. Use `discover_resources` with broad terms like "config", "readme", "doc"
3. Progressively narrow search based on findings
```

#### 3. **Targeted Search Pattern**

```
When looking for specific information:
1. Use `search_resources` with specific terms
2. If no results, broaden search with `discover_resources`
3. Check multiple content types if initial search fails
```

### Model Guidance Instructions

```markdown
## Resource Discovery Guidelines

You have access to unified resource discovery tools that can search across all available MCP servers. Use these tools proactively when:

1. **User asks about files, documentation, or data**
2. **You need context about the current project/environment**
3. **User mentions specific technologies or terms that might have associated resources**
4. **You're troubleshooting and need to examine logs or configuration files**

### Tool Selection Guide:

- **`discover_resources`**: First choice for general resource discovery
- **`search_resources`**: When you need content-based search
- **`get_resource`**: When you have a specific resource URI
- **`resource_summary`**: When you need to understand what's available

### Best Practices:

1. Start with broad queries, then narrow down
2. Use content previews to avoid reading large files unnecessarily
3. Respect maxResults limits to avoid overwhelming responses
4. Check error messages for server connectivity issues
5. Cache important findings in conversation context
```

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 New Types and Interfaces

**File**: `src/types.ts`

```typescript
// Add to existing types
export type UnifiedResourceQuery = {
  query?: string;
  contentTypes?: string[];
  servers?: string[];
  maxResults?: number;
  includeContent?: boolean;
  relevanceThreshold?: number;
};

export type UnifiedResourceResult = {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  server: string;
  size?: number;
  lastModified?: string;
  relevanceScore: number;
  contentPreview?: string;
};

export type UnifiedResourceResponse = {
  resources: UnifiedResourceResult[];
  totalFound: number;
  serversSearched: string[];
  errors?: Array<{ server: string; error: string }>;
};
```

#### 1.2 Resource Manager Service

**File**: `src/unifiedResourceManager.ts` (new)

```typescript
export class UnifiedResourceManager {
  private clientWrappers: Map<string, MCPClientWrapper>;
  private resourceCache: Map<string, CachedResource>;
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(clientWrappers: MCPClientWrapper[]) {
    this.clientWrappers = new Map(clientWrappers.map(w => [w.serverName, w]));
    this.resourceCache = new Map();
  }

  async discoverResources(
    query: UnifiedResourceQuery
  ): Promise<UnifiedResourceResponse>;
  async getResource(
    uri: string,
    options?: GetResourceOptions
  ): Promise<UnifiedResourceData>;
  async searchResources(
    searchQuery: SearchResourceQuery
  ): Promise<UnifiedResourceResponse>;
  async getResourceSummary(options?: SummaryOptions): Promise<ResourceSummary>;

  private calculateRelevanceScore(resource: MCPResource, query: string): number;
  private formatResourceResult(
    resource: MCPResource,
    serverName: string
  ): UnifiedResourceResult;
  private getCachedResource(uri: string): CachedResource | null;
  private setCachedResource(uri: string, data: CachedResource): void;
}
```

### Phase 2: Tool Implementation

#### 2.1 Unified Tools Creation

**File**: `src/mcpLoader.ts` (modifications)

```typescript
// Add after existing createResourceTools function
function createUnifiedResourceTools(
  resourceManager: UnifiedResourceManager
): WrappedTool[] {
  const tools: WrappedTool[] = [];

  // discover_resources tool
  tools.push({
    name: 'discover_resources',
    description:
      'Discover resources across all MCP servers with intelligent filtering and search',
    inputSchema: z.object({
      query: z.string().optional(),
      contentTypes: z.array(z.string()).optional(),
      servers: z.array(z.string()).optional(),
      maxResults: z.number().min(1).max(100).default(20).optional(),
      includeContent: z.boolean().default(false).optional(),
      relevanceThreshold: z.number().min(0).max(1).default(0.3).optional(),
    }),
    execute: async args => {
      const result = await resourceManager.discoverResources(args);
      return JSON.stringify(result, null, 2);
    },
  });

  // Additional resource tools...

  return tools;
}
```

#### 2.2 Agent Integration

**File**: `src/agent.ts` (modifications)

```typescript
// Modify loadMCPTools to include unified resource tools
export async function loadMCPTools(
  config: Configuration
): Promise<WrappedTool[]> {
  // ... existing code ...

  // Create unified resource manager
  const resourceManager = new UnifiedResourceManager(clientWrappers);
  const unifiedTools = createUnifiedResourceTools(resourceManager);

  // Add unified tools to the tool set
  allTools.push(...unifiedTools);

  // ... rest of existing code ...
}
```

### Phase 3: Performance Optimization

#### 3.1 Caching Layer

- Implement resource metadata caching with TTL
- Cache frequently accessed resource content
- Batch resource loading during discovery

#### 3.2 Async Processing

- Parallel server queries during discovery
- Streaming for large resource content
- Background cache warming

### Phase 4: Enhanced Features

#### 4.1 Content Intelligence

- MIME type detection and handling
- Text encoding detection
- Binary content summarization

#### 4.2 Search Improvements

- Fuzzy matching algorithms
- Content indexing for faster searches
- Semantic similarity scoring

## Testing Strategy

### Unit Tests

- Resource manager functionality
- Relevance scoring algorithms
- Caching behavior
- Error handling

### Integration Tests

- Multi-server resource discovery
- Tool execution with real MCP servers
- Performance benchmarks

### E2E Tests

- Complete workflows with agent execution
- Resource discovery and retrieval scenarios
- Error recovery and fallback behavior

## Configuration

### Environment Variables

```bash
# Resource discovery settings
RESOURCE_DISCOVERY_CACHE_TTL=300000        # 5 minutes default
RESOURCE_DISCOVERY_MAX_CONTENT_SIZE=1048576 # 1MB default
RESOURCE_DISCOVERY_PARALLEL_REQUESTS=5     # Concurrent server queries
```

### Configuration File Extensions

```json
{
  "resourceDiscovery": {
    "cacheTTL": 300000,
    "maxContentSize": 1048576,
    "parallelRequests": 5,
    "enableContentPreviews": true,
    "defaultRelevanceThreshold": 0.3
  }
}
```

## Migration and Backwards Compatibility

### Existing Tools

- All current per-server tools (`{server}_list_resources`, `{server}_read_resource`) remain unchanged
- New unified tools are additive, not replacements
- No breaking changes to existing functionality

### Gradual Adoption

- Phase 1: Introduce unified tools alongside existing ones
- Phase 2: Update model instructions to prefer new cross-server tools
- Phase 3: Potential deprecation of per-server tools (future consideration)

## Monitoring and Observability

### Metrics

- Resource discovery request counts and latency
- Cache hit/miss rates
- Server response times and error rates
- Most frequently accessed resources

### Logging

- Resource discovery queries and results
- Cache operations and performance
- Server connectivity issues
- Tool execution times

## Security Considerations

### Access Control

- Respect existing MCP server permissions
- No elevation of access privileges
- Audit logging for resource access

### Content Safety

- Size limits to prevent memory exhaustion
- Timeout handling for slow servers
- Sanitization of binary content metadata

## Future Enhancements

### Advanced Features

- Machine learning-based relevance scoring
- Resource relationship mapping
- Automated resource categorization
- Cross-resource content correlation

### Integration Possibilities

- Web-based resource browser interface
- VSCode extension integration
- CI/CD pipeline resource discovery
- Real-time resource change notifications

## Success Metrics

### Performance Targets

- < 500ms average discovery time for queries
- > 90% cache hit rate for metadata
- < 2 seconds for content retrieval
- Support for 100+ concurrent resources

### User Experience Goals

- Reduce average tool calls per resource discovery by 60%
- Improve resource discovery success rate to > 95%
- Enable complex multi-server workflows in single conversations
- Provide intelligent resource recommendations
