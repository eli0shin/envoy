# MCP Server and Tool Disable Functionality Requirements

## Overview

This document outlines the functional requirements for implementing the ability to disable tools from MCP servers or whole MCP servers in the Envoy CLI agent. This addresses todo item #9: "ability to disable tools from mcp servers or whole mcp server in the config file and constants file".

## Current State Analysis

### Configuration Architecture Overview

The existing configuration system follows a clean hierarchical structure:

**Configuration Flow:**

1. `loadConfiguration()` → creates `RuntimeConfiguration` from file configs + CLI overrides
2. `getMCPServersFromConfig()` → extracts server configs and filters disabled servers
3. `loadMCPServersWithClients()` → initializes servers, loads tools, and aggregates into `allTools` map

**Server Discovery Sources:**

- **Hardcoded servers** from `MCP_SERVERS` constant (filesystem, shell, todo-list)
- **Config file servers** from `mcpServers` configuration object
- **Dynamic servers** conditionally added (agent-spawner)

### Already Implemented ✅

- **Server-level disable**: `disabled: boolean` field implemented in both `config.ts:convertToLegacyMCPServers()` (line 368) and `constants.ts:convertToLegacyMCPServers()` (line 212)
- **Schema support**: `disabledTools: string[]` per server in `EnhancedMCPServerConfig`
- **Schema support**: `disabledInternalTools: string[]` globally in `ToolsConfig`
- **Configuration infrastructure**: Complete loading, validation, and runtime config creation

### Missing Implementation ❌

- **Central tool filtering**: Integration point in `loadMCPServersWithClients()` tool aggregation loop
- **Runtime config access**: Pass `RuntimeConfiguration` to tool loading functions
- **Validation and logging**: Centralized disable decision logging

## Functional Requirements

### FR1: Per-Server Tool Filtering (High Priority)

**Requirement**: Implement filtering logic for `disabledTools` array in server configuration

**Implementation Details**:

- **Location**: `src/mcpLoader.ts` in `loadMCPServersWithClients()` function (around line 1014)
- **Integration Point**: Tool aggregation loop where `allTools.set(finalToolKey, tool)` occurs
- **Logic**: Central filtering function checks server-level disabled tools before adding to global tool map
- **Validation**: Warn about non-existent disabled tools to catch typos
- **Logging**: Debug log each disabled tool with reason

**Configuration Example**:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "disabledTools": ["write_file", "delete_file"]
    }
  }
}
```

**Implementation Architecture**:

```typescript
// Enhanced function signature
export async function loadMCPServersWithClients(
  serverConfigs: readonly MCPServerConfig[] | Readonly<MCPServerConfig[]>,
  runtimeConfig: RuntimeConfiguration // NEW: Pass runtime config for global filtering
): Promise<MCPLoadResult>;

// Central tool filtering function
function isToolDisabled(
  toolKey: string,
  tool: WrappedTool,
  serverConfig: MCPServerConfig,
  runtimeConfig: RuntimeConfiguration
): boolean {
  // Check server-level disabled tools
  const serverDisabledTools = (serverConfig as any).disabledTools || [];
  if (serverDisabledTools.includes(tool.toolName)) {
    return true;
  }

  // Check global disabled tools
  const globalDisabledTools = runtimeConfig.tools?.disabledInternalTools || [];
  return globalDisabledTools.some((pattern) => {
    // Exact match: "filesystem_write_file"
    if (toolKey === pattern) return true;

    // Unprefixed match: "write_file" matches "filesystem_write_file"
    if (tool.toolName === pattern) return true;

    // Suffix match: "*_write_file"
    if (toolKey.endsWith(`_${pattern}`)) return true;

    return false;
  });
}
```

### FR2: Global Tool Filtering (High Priority)

**Requirement**: Implement filtering logic for `disabledInternalTools` array in tools configuration

**Implementation Details**:

- **Location**: `src/mcpLoader.ts` in `loadMCPServersWithClients()` function (same integration point as FR1)
- **Function Enhancement**: Add `runtimeConfig: RuntimeConfiguration` parameter to access global settings
- **Logic**: Central filtering function checks global disabled tools from `runtimeConfig.tools?.disabledInternalTools`
- **Support**: Both prefixed (`filesystem_read_file`) and unprefixed (`read_file`) names
- **Matching**: Tool names are checked against both `toolName` and `serverName_toolName` patterns

**Configuration Example**:

```json
{
  "tools": {
    "disabledInternalTools": [
      "filesystem_write_file",
      "shell_exec",
      "write_file"
    ]
  }
}
```

**Integration Point Implementation**:

```typescript
// In loadMCPServersWithClients() around line 1014
// Current code:
for (const [toolKey, tool] of wrapper.tools) {
  let finalToolKey = toolKey;

  // Server prefix logic...

  allTools.set(finalToolKey, tool);
}

// Enhanced code:
for (const [toolKey, tool] of wrapper.tools) {
  let finalToolKey = toolKey;

  // Server prefix logic...

  // NEW: Central tool filtering
  if (isToolDisabled(finalToolKey, tool, serverInit.config, runtimeConfig)) {
    logger.debug(`Tool '${finalToolKey}' disabled by configuration`, {
      toolKey: finalToolKey,
      serverName: serverInit.config.name,
      reason: 'disabled_by_config',
    });
    continue;
  }

  allTools.set(finalToolKey, tool);
}
```

### FR3: Constants File Support (Low Priority)

**Requirement**: Add disable support to hardcoded `MCP_SERVERS` array

**Implementation Details**:

- **Location**: `src/constants.ts`
- **Fields**: Add optional `disabled` and `disabledTools` fields to server objects

**Implementation**:

```typescript
// Update MCP_SERVERS array
export const MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'todo-list',
    type: 'stdio',
    command: 'npx',
    args: ['tsx', './src/todoServer.ts'],
    // ... existing config
  },
  {
    name: 'filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    // Optional disable support
    disabled: false,
    disabledTools: ['write_file', 'delete_file'], // example
  },
  // ... other servers
];
```

### FR4: Validation and Logging (Medium Priority)

**Requirement**: Provide clear feedback about disabled servers/tools

**Implementation Details**:

- **Validation**: Warn when disabled tools don't exist (catch typos)
- **Logging**: Log disabled servers/tools during startup
- **Debug**: Provide detailed information about filtering decisions

**Logging Examples**:

```typescript
// Server disable logging
logger.info(`Server '${serverName}' disabled by configuration`);

// Tool disable logging
logger.info(`Server '${serverName}': ${disabledCount} tools disabled`);
logger.debug(
  `Server '${serverName}': disabled tools: ${disabledTools.join(', ')}`
);

// Validation warnings
logger.warn(
  `Server '${serverName}': disabled tools not found: ${invalidTools.join(', ')}`
);

// Global disable logging
logger.info(`Globally disabled tools: ${globalDisabledTools.join(', ')}`);
```

## Implementation Priority

### Phase 1: Core Filtering Logic (High Priority)

1. **FR1**: Per-server tool filtering in `loadToolsFromServer()`
2. **FR2**: Global tool filtering in `loadMCPServersWithClients()`

### Phase 2: Constants Support and Validation (Medium Priority)

3. **FR4**: Validation and logging for disabled tools
4. **FR3**: Constants file disable support

## Configuration Examples

### Complete .envoy.json Example

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "disabledTools": ["write_file", "delete_file"]
    },
    "shell": {
      "command": "npx",
      "args": ["-y", "mcp-shell"],
      "disabledTools": ["exec"]
    },
    "dangerous-server": {
      "command": "dangerous-mcp-server",
      "disabled": true
    }
  },
  "tools": {
    "disabledInternalTools": ["shell_exec", "filesystem_write_file"]
  }
}
```

## Success Criteria

- ✅ Users can disable entire MCP servers via config files
- ✅ Users can disable specific tools per server via config files
- ✅ Users can disable tools globally via config files
- ✅ Clear logging shows what servers/tools have been disabled
- ✅ Validation warns about non-existent disabled tools (typos)
- ✅ All disable functionality works with both file-based and constants-based server configuration
- ✅ Backward compatibility is maintained - all changes are additive

## Testing Requirements

### Unit Tests

- Test tool filtering logic in `loadToolsFromServer()`
- Test global tool filtering in `loadMCPServersWithClients()`
- Test validation of disabled tools

### Integration Tests

- Test complete disable workflow with config files
- Test logging and validation warnings
- Test interaction between server disable and tool disable

### Edge Cases

- Empty disable lists
- Non-existent servers/tools in disable lists
- Tool name conflicts between servers

---

# Implementation Plan

Based on comprehensive analysis of the current codebase architecture, this section provides detailed implementation guidance for each functional requirement.

## Architecture Analysis

### Current Implementation Assessment

**Existing Foundation**:

1. **Server-level filtering**: Already implemented in `convertToLegacyMCPServers()` functions
   - `config.ts:convertToLegacyMCPServers()` (line 368-369): `if (config.disabled) { continue; }`
   - `constants.ts:convertToLegacyMCPServers()` (line 212-213): `if (config.disabled) { continue; }`
2. **Configuration schema**: `EnhancedMCPServerConfig` and `ToolsConfig` types include disable fields
3. **Runtime configuration**: Clean separation between file config and runtime config

**Integration Points**:

1. **Primary**: Tool aggregation in `loadMCPServersWithClients()` around line 1014
2. **Secondary**: Function signature enhancement to pass `RuntimeConfiguration`
3. **Validation**: Central logging and validation in filtering function

### Current Tool Loading Flow

```
loadMCPServersWithClients()
├── Phase 1: initializeServerWithCapabilities()
├── Phase 2: loadCapabilitiesAndCreateWrapper()
│   └── loadToolsFromServer()
│       └── createWrappedTool()
└── Phase 3: Tool Aggregation ← **Central Integration Point**
    ├── Server prefix logic
    ├── NEW: isToolDisabled() filtering ← **FR1 & FR2 Implementation**
    └── allTools.set(finalToolKey, tool)
```

### Architecture Benefits

**Clean Separation**:

1. **Config Phase**: Filters servers entirely (existing `convertToLegacyMCPServers()`)
2. **Tool Phase**: Filters individual tools centrally (new `isToolDisabled()`)
3. **Single Source of Truth**: Runtime config drives all filtering decisions

**Performance**:

1. **Server filtering**: Disabled servers never get initialized (efficient)
2. **Tool filtering**: Only happens once during aggregation (efficient)
3. **Logging**: Central place for all disable decisions (debuggable)

## Detailed Implementation Plan

### Phase 1: Core Filtering Logic

#### Step 1.1: Central Tool Filtering Function (FR1 & FR2)

**File**: `src/mcpLoader.ts`  
**Function**: New `isToolDisabled()` helper function

**New Central Filtering Function**:

```typescript
/**
 * Central tool filtering function that handles both server-level and global filtering
 */
function isToolDisabled(
  toolKey: string,
  tool: WrappedTool,
  serverConfig: MCPServerConfig,
  runtimeConfig: RuntimeConfiguration
): boolean {
  // Check server-level disabled tools (FR1)
  const serverDisabledTools = (serverConfig as any).disabledTools || [];
  if (serverDisabledTools.includes(tool.toolName)) {
    logger.debug(
      `Tool '${tool.toolName}' disabled by server '${serverConfig.name}' configuration`,
      { toolKey, serverName: serverConfig.name, reason: 'server_config' }
    );
    return true;
  }

  // Check global disabled tools (FR2)
  const globalDisabledTools = runtimeConfig.tools?.disabledInternalTools || [];
  const isGloballyDisabled = globalDisabledTools.some((pattern) => {
    // Exact match: "filesystem_write_file"
    if (toolKey === pattern) return true;

    // Unprefixed match: "write_file" matches "filesystem_write_file"
    if (tool.toolName === pattern) return true;

    // Suffix match: "*_write_file"
    if (toolKey.endsWith(`_${pattern}`)) return true;

    return false;
  });

  if (isGloballyDisabled) {
    logger.debug(`Tool '${toolKey}' disabled by global configuration`, {
      toolKey,
      serverName: serverConfig.name,
      reason: 'global_config',
    });
    return true;
  }

  return false;
}
```

**Function Signature Enhancement**:

```typescript
// Current function signature
export async function loadMCPServersWithClients(
  serverConfigs: readonly MCPServerConfig[] | Readonly<MCPServerConfig[]>
): Promise<MCPLoadResult>;

// Enhanced function signature
export async function loadMCPServersWithClients(
  serverConfigs: readonly MCPServerConfig[] | Readonly<MCPServerConfig[]>,
  runtimeConfig: RuntimeConfiguration // NEW: Pass runtime config for global filtering
): Promise<MCPLoadResult>;
```

#### Step 1.2: Integration Point Implementation

**File**: `src/mcpLoader.ts`  
**Function**: `loadMCPServersWithClients()` (around line 1014)

**Current Implementation**:

```typescript
// Add all tools from the wrapper
for (const [toolKey, tool] of wrapper.tools) {
  let finalToolKey = toolKey;

  // If the toolKey doesn't start with server name, add server prefix
  if (!toolKey.startsWith(`${serverInit.config.name}_`)) {
    finalToolKey = `${serverInit.config.name}_${toolKey}`;
  }

  if (allTools.has(finalToolKey)) {
    errors.push({
      serverName: serverInit.config.name,
      error: `Tool name conflict: ${toolKey} already exists`,
    });
    continue;
  }

  allTools.set(finalToolKey, tool);
}
```

**Enhanced Implementation**:

```typescript
// Add all tools from the wrapper with central filtering
for (const [toolKey, tool] of wrapper.tools) {
  let finalToolKey = toolKey;

  // If the toolKey doesn't start with server name, add server prefix
  if (!toolKey.startsWith(`${serverInit.config.name}_`)) {
    finalToolKey = `${serverInit.config.name}_${toolKey}`;
  }

  // NEW: Central tool filtering (handles both server-level and global)
  if (isToolDisabled(finalToolKey, tool, serverInit.config, runtimeConfig)) {
    continue; // Skip disabled tools (logging handled in isToolDisabled)
  }

  if (allTools.has(finalToolKey)) {
    errors.push({
      serverName: serverInit.config.name,
      error: `Tool name conflict: ${toolKey} already exists`,
    });
    continue;
  }

  allTools.set(finalToolKey, tool);
}
```

#### Step 1.3: Caller Updates

**Required Changes**: Update all callers of `loadMCPServersWithClients()` to pass `runtimeConfig`

**Integration Points**:

```typescript
// In src/interactiveSession.ts or wherever loadMCPServersWithClients is called
const mcpResult = await loadMCPServersWithClients(
  getMCPServersFromConfig(runtimeConfig),
  runtimeConfig // NEW: Pass runtime config
);
```

**Validation Enhancement** (Optional):

```typescript
/**
 * Validates disabled tool configurations and warns about non-existent tools
 */
function validateDisabledTools(
  availableTools: Map<string, WrappedTool>,
  runtimeConfig: RuntimeConfiguration
): void {
  const globalDisabledTools = runtimeConfig.tools?.disabledInternalTools || [];
  const availableToolNames = Array.from(availableTools.keys());

  const invalidTools = globalDisabledTools.filter(
    (tool) =>
      !availableToolNames.some(
        (name) =>
          name === tool ||
          name.endsWith(`_${tool}`) ||
          availableTools.get(name)?.toolName === tool
      )
  );

  if (invalidTools.length > 0) {
    logger.warn(`Global disabled tools not found: ${invalidTools.join(', ')}`, {
      invalidTools,
      availableTools: availableToolNames,
    });
  }
}
```

### Phase 2: Constants File Support and Validation

#### Step 2.1: Enhance Constants File (FR3)

**File**: `src/constants.ts`  
**Location**: `MCP_SERVERS` array definition (lines 111-157)

**Enhanced Server Configuration**:

```typescript
// Example configuration with disable support
export const MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'todo-list',
    type: 'stdio',
    command: 'npx',
    args: ['tsx', './src/todoServer.ts'],
    env: {
      ...(Object.fromEntries(
        Object.entries(process.env).filter(([_, value]) => value !== undefined)
      ) as Record<string, string>),
      AGENT_SESSION_ID: getSessionId(),
    },
    description: 'Todo list management for tracking multi-step tasks',
    // Server-level disable (optional)
    disabled: false,
  },
  {
    name: 'filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    // Example: Disable dangerous file operations
    disabledTools: ['write_file', 'delete_file'],
  },
  {
    name: 'shell',
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-shell'],
    // Example: Completely disable shell server in production
    disabled: process.env.NODE_ENV === 'production',
    // Or disable specific dangerous commands
    disabledTools: ['exec', 'run_command'],
  },
];
```

#### Step 2.2: Add Tool Validation (FR4)

**Implementation**: Optional validation function to warn about configuration issues

```typescript
/**
 * Validates disabled tool configurations during startup
 */
function validateToolDisableConfiguration(
  mcpResult: MCPLoadResult,
  runtimeConfig: RuntimeConfiguration
): void {
  // Validate global disabled tools
  const globalDisabledTools = runtimeConfig.tools?.disabledInternalTools || [];
  const allToolNames = Array.from(mcpResult.tools.keys());

  const unmatchedGlobalTools = globalDisabledTools.filter((pattern) => {
    return !allToolNames.some(
      (toolName) =>
        toolName === pattern ||
        toolName.endsWith(`_${pattern}`) ||
        mcpResult.tools.get(toolName)?.toolName === pattern
    );
  });

  if (unmatchedGlobalTools.length > 0) {
    logger.warn(
      `Global disabled tools not found: ${unmatchedGlobalTools.join(', ')}`,
      { unmatchedTools: unmatchedGlobalTools, availableTools: allToolNames }
    );
  }

  // Log summary of disabled tools
  const disabledCount = globalDisabledTools.length;
  if (disabledCount > 0) {
    logger.info(`Global tool filtering: ${disabledCount} patterns configured`, {
      patterns: globalDisabledTools,
    });
  }
}
```

### Phase 3: Testing Implementation

#### Step 3.1: Unit Tests

**File**: `src/toolFiltering.test.ts` (new file)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyServerToolFiltering,
  isToolGloballyDisabled,
} from './mcpLoader.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

describe('Tool Filtering', () => {
  const mockTools: Tool[] = [
    { name: 'read_file', description: 'Read file' },
    { name: 'write_file', description: 'Write file' },
    { name: 'delete_file', description: 'Delete file' },
  ];

  describe('applyServerToolFiltering', () => {
    it('should filter disabled tools', () => {
      const result = applyServerToolFiltering(
        mockTools,
        ['write_file', 'delete_file'],
        'filesystem'
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('read_file');
    });

    it('should warn about non-existent disabled tools', () => {
      const loggerWarnSpy = vi.spyOn(logger, 'warn');

      applyServerToolFiltering(mockTools, ['nonexistent_tool'], 'filesystem');

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('disabled tools not found'),
        expect.any(Object)
      );
    });
  });

  describe('isToolGloballyDisabled', () => {
    const mockWrappedTool = {
      toolName: 'write_file',
      serverName: 'filesystem',
    };

    it('should match exact tool names', () => {
      const result = isToolGloballyDisabled(
        'filesystem_write_file',
        mockWrappedTool,
        ['filesystem_write_file']
      );
      expect(result).toBe(true);
    });

    it('should match unprefixed tool names', () => {
      const result = isToolGloballyDisabled(
        'filesystem_write_file',
        mockWrappedTool,
        ['write_file']
      );
      expect(result).toBe(true);
    });
  });
});
```

#### Step 3.2: Configuration Tests

**File**: `src/config.test.ts` (update existing)

```typescript
describe('Tool Disable Configuration', () => {
  it('should load config with disabled tools', async () => {
    const testConfig = {
      tools: {
        disabledInternalTools: ['write_file', 'delete_file'],
      },
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          disabledTools: ['exec'],
        },
      },
    };

    // Test configuration loading with disabled tools
    const result = await loadConfiguration(testConfig);

    expect(result.config.tools?.disabledInternalTools).toContain('write_file');
    expect(result.config.tools?.disabledInternalTools).toContain('delete_file');
    expect(result.config.mcpServers?.filesystem?.disabledTools).toContain(
      'exec'
    );
  });
});
```

#### Step 3.3: Integration Tests

**File**: `e2e/toolDisabling.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest';
import { loadMCPServersWithClients } from '../src/mcpLoader.js';
import { createRuntimeConfiguration } from '../src/config.js';

describe('Tool Disabling Integration', () => {
  it('should disable tools through complete pipeline', async () => {
    // Create runtime config with disabled tools
    const { config } = await createRuntimeConfiguration({
      stdin: false,
      json: false,
      tools: {
        disabledInternalTools: ['write_file', 'delete_file'],
      },
    });

    // Load MCP servers with disable functionality
    const result = await loadMCPServersWithClients(
      getMCPServersFromConfig(config),
      config
    );

    // Verify tools are disabled
    const toolNames = Array.from(result.tools.keys());
    expect(toolNames).not.toContain('filesystem_write_file');
    expect(toolNames).not.toContain('filesystem_delete_file');
  });
});
```

## Implementation Schedule

### Week 1: Phase 1 Implementation

- **Day 1-2**: Implement central `isToolDisabled()` filtering function
- **Day 3-4**: Enhance `loadMCPServersWithClients()` function signature and integration point
- **Day 5**: Update all callers and add unit tests for core filtering logic

### Week 2: Phase 2 Implementation

- **Day 1-2**: Add validation function and enhanced logging
- **Day 3-4**: Update constants file with example disable configurations
- **Day 5**: Integration tests for complete disable functionality

### Week 3: Testing & Polish

- **Day 1-2**: Comprehensive testing and edge case handling
- **Day 3-4**: Performance testing and validation of filtering efficiency
- **Day 5**: Documentation and code review

## Key Implementation Notes

1. **Preserve Existing Behavior**: All changes are additive - existing server filtering remains unchanged
2. **Central Integration Point**: Single filtering function handles both server-level and global tool filtering
3. **Clean Architecture**: Leverages existing runtime configuration and tool aggregation patterns
4. **Logging Strategy**: Structured logging with consistent metadata for debugging and audit trails
5. **Error Handling**: Follow existing patterns in `MCPLoadResult.errors` for error collection
6. **Type Safety**: Minimal type changes needed - only function signature enhancement
7. **Performance**: O(n) filtering during initialization only, no runtime performance impact
8. **Testing**: Follow existing Vitest patterns and mock strategies

## Success Metrics

- [ ] Central `isToolDisabled()` function implemented and tested
- [ ] `loadMCPServersWithClients()` enhanced with runtime config parameter
- [ ] All callers updated to pass runtime configuration
- [ ] Zero breaking changes to existing server filtering functionality
- [ ] Comprehensive test coverage (>80% for new filtering logic)
- [ ] Clear structured logging for all disable operations
- [ ] Constants file updated with example disable configurations
- [ ] Validation function for disabled tool configuration issues
