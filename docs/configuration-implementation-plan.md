# CLI AI Agent Configuration Implementation Plan

## Overview

This document outlines the implementation plan for adding file-based configuration support to the CLI AI Agent, addressing compatibility with the MCP ecosystem and providing enhanced flexibility for users.

## Research Summary

Based on analysis of MCP ecosystem tools (Claude Desktop, MCPHub.nvim, VS Code extensions), the standard configuration format uses JSON with `mcpServers` as the root key. Common patterns include:

- Standard JSON structure with command/args/env patterns
- Environment variable expansion with `${VAR_NAME}` syntax
- Timeout and transport configuration
- Tool-level enabling/disabling controls
- Workspace vs global configuration separation

## Phase 1: Foundation & Async Refactoring (Priority: Critical)

### 1.1 Async Agent Initialization

**Problem**: Current code loads MCP servers synchronously at import time, incompatible with file-based config.

**Solution**: Refactor agent initialization to be async-first:

```typescript
// Before: constants.ts (sync import)
export const MCP_SERVERS: MCPServerConfig[] = [...];

// After: config.ts (async loading)
export async function loadConfiguration(): Promise<Configuration> {
  // Load from files, env vars, defaults
}
```

**Files to modify**: `src/agent.ts`, `src/cli.ts`, `src/mcpLoader.ts`

### 1.2 JSON Schema Definition

**Problem**: No validation for configuration structure.

**Solution**: Define comprehensive JSON schema first:

```typescript
// src/configSchema.ts
export const CONFIG_SCHEMA = {
  type: "object",
  properties: {
    mcpServers: { ... },
    providers: { ... },
    agent: { ... }
  },
  required: ["mcpServers"]
};
```

## Phase 2: Simple File-Based Config (Priority: High)

### 2.1 Single Config File Support

**Scope**: Support only `.envoy.json` in current directory initially.

**Format**: Standard MCP-compatible JSON:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "type": "stdio",
      "timeout": 30000
    }
  },
  "providers": {
    "default": "openrouter",
    "openrouter": {
      "model": "google/gemini-2.0-flash-exp:free"
    }
  }
}
```

### 2.2 Backward Compatibility Strategy

**Problem**: Existing hard-coded constants.ts conflicts with file-based config.

**Solution**: Merge approach - constants as defaults, config file as overrides:

```typescript
async function loadConfiguration(): Promise<Configuration> {
  const defaults = getDefaultConfiguration(); // From constants.ts
  const fileConfig = await loadConfigFile(); // Optional
  return mergeConfigurations(defaults, fileConfig);
}
```

## Phase 3: Enhanced Configuration (Priority: Medium)

### 3.1 Environment Variable Expansion

**Security-focused approach**:

```json
{
  "mcpServers": {
    "github": {
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}" // Only allow existing env vars
      }
    }
  }
}
```

### 3.2 User-Level Configuration

**Location**: `~/.config/envoy/config.json`
**Precedence**: Project config overrides user config overrides defaults

## Detailed Configuration Schema

### Complete Configuration Structure

```json
{
  "mcpServers": {
    "server-name": {
      "command": "command-to-run",
      "args": ["arg1", "arg2"],
      "env": {
        "API_KEY": "${ENV_VAR_NAME}"
      },
      "type": "stdio",
      "timeout": 30000,
      "initTimeout": 10000,
      "disabled": false,
      "disabledTools": ["tool1", "tool2"],
      "autoApprove": ["safe-tool"]
    }
  },
  "providers": {
    "default": "openrouter",
    "openai": {
      "apiKey": "${OPENAI_API_KEY}",
      "model": "gpt-4",
      "baseURL": "https://api.openai.com/v1"
    },
    "openrouter": {
      "apiKey": "${OPENROUTER_API_KEY}",
      "model": "google/gemini-2.0-flash-exp:free",
      "baseURL": "https://openrouter.ai/api/v1"
    }
  },
  "agent": {
    "maxSteps": 20,
    "timeout": 300000,
    "verbose": false,
    "streaming": true
  },
  "tools": {
    "disabledInternalTools": ["internal-tool-name"],
    "globalTimeout": 60000
  }
}
```

### Configuration Parameters

#### MCP Servers

- `mcpServers`: Object with server configurations
- Per-server: `command`, `args`, `env`, `type`, timeouts, tool controls

#### AI Providers

- `providers`: Configuration for OpenAI, OpenRouter, etc.
- Provider selection with `default` field
- Model selection per provider

#### Agent Behavior

- `maxSteps`: Maximum conversation steps
- `timeout`: Overall execution timeout
- `verbose`: Logging level
- `streaming`: Real-time output control

#### Tool Management

- `disabledInternalTools`: Disable built-in tools
- `globalTimeout`: Default timeout for all tools
- Per-server tool disabling with `disabledTools`

## Implementation Strategy

### Security Measures

1. **No Code Execution**: JSON only, no JavaScript evaluation
2. **Environment Variable Validation**: Only allow existing env vars
3. **File Permission Checks**: Validate config file is readable
4. **Schema Validation**: All config must pass JSON schema validation

### Error Handling

1. **Graceful Degradation**: Missing config files use defaults
2. **Clear Error Messages**: Specific feedback for validation failures
3. **Partial Loading**: Continue with valid servers if some fail

### Configuration File Locations & Precedence

1. **Project Level**: `./.envoy.json` (highest precedence)
2. **User Level**: `~/.config/envoy/config.json` or `~/.envoy.json`
3. **Environment Variables**: Current env var support (lowest precedence)

### Configuration Loading Logic

```typescript
async function loadConfiguration(): Promise<Config> {
  const defaultConfig = getDefaultConfiguration();
  const userConfig = await loadUserConfig();
  const projectConfig = await loadProjectConfig();

  return mergeConfigurations([defaultConfig, userConfig, projectConfig]);
}
```

### CLI Integration & Overrides

Allow CLI flags to override config file settings:

- `--provider openai` overrides `providers.default`
- `--model gpt-4` overrides provider model
- `--verbose` overrides `agent.verbose`
- `--max-steps 10` overrides `agent.maxSteps`

## Testing Strategy

### Unit Tests

```typescript
describe('Configuration Loading', () => {
  test('uses defaults when no config file exists');
  test('merges config file with defaults correctly');
  test('validates config schema and rejects invalid files');
  test('handles missing environment variables gracefully');
  test('maintains backward compatibility with constants.ts');
  test('applies CLI overrides correctly');
  test('expands environment variables securely');
});
```

### Integration Tests

- End-to-end with real config files
- CLI override behavior
- Provider switching
- MCP server configuration changes

### Test Cases

- Missing config files (use defaults)
- Invalid JSON syntax
- Missing environment variables
- Conflicting configurations
- Tool enabling/disabling
- Cross-platform path handling
- Permission failures

## Migration Strategy

### Migration Path

1. **Phase 1**: Keep existing constants.ts working
2. **Phase 2**: Add config file support as optional enhancement
3. **Phase 3**: Deprecate constants.ts approach (future release)
4. **Documentation**: Clear migration guide with examples

### Backward Compatibility

- Existing usage continues to work without changes
- Configuration files are optional enhancements
- Constants.ts serves as fallback defaults

## Implementation Components

### New Files

- `src/config.ts`: Configuration loading, merging, validation
- `src/configTypes.ts`: TypeScript interfaces for config schema
- `src/configSchema.ts`: JSON schema definition
- `src/config.test.ts`: Configuration loading tests

### Modified Files

- `src/constants.ts`: Move hardcoded values to config system defaults
- `src/agent.ts`: Use config for maxSteps, timeouts, providers
- `src/mcpLoader.ts`: Use config for server definitions and timeouts
- `src/cli.ts`: Add config loading, CLI overrides
- `src/types.ts`: Add config-related types

## Key Principles

1. **Async-First**: All configuration loading is asynchronous
2. **Validation-First**: Schema validation before any processing
3. **Merge Strategy**: Layered configuration with clear precedence
4. **Security-Focused**: No code execution, only data configuration
5. **MCP Ecosystem Compatibility**: Standard JSON format alignment
6. **Backward Compatibility**: Existing workflows remain unchanged

## Success Criteria

- [ ] Configuration files load and merge correctly
- [ ] All existing functionality works without config files
- [ ] JSON schema validation prevents invalid configurations
- [ ] Environment variable expansion works securely
- [ ] CLI overrides function as expected
- [ ] MCP servers can be configured via files
- [ ] Provider and model selection works from config
- [ ] Tests achieve >90% coverage for config system
- [ ] Documentation provides clear migration examples
- [ ] Cross-platform compatibility verified

This plan provides a structured approach to implementing file-based configuration while maintaining system stability and user experience.
