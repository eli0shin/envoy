# Help Command Logs Directory Enhancement Plan

## Overview

Enhance the CLI help command to display the logs directory path, making it easier for users to find their log files for debugging and troubleshooting purposes.

## Current State Analysis

### Help Command Implementation

- **Technology**: Uses `yargs` for CLI argument parsing and help generation
- **Location**: `/src/cli.ts` lines 33-136
- **Trigger**: `--help` or `-h` flags
- **Structure**: Comprehensive help with usage, options, examples, and environment variables

### Logging System

- **Technology**: Custom logging implementation with `env-paths` for directory resolution
- **Location**: `/src/logger.ts`
- **Directory**: Uses `envPaths('envoy').data` which resolves to:
  - macOS: `~/Library/Application Support/envoy/`
  - Linux: `~/.local/share/envoy/`
  - Windows: `%APPDATA%/envoy/`
- **Subdirectories**:
  - `sessions/` - Session-based logs
  - `mcp-tools/` - MCP tool-specific logs

## Proposed Solution

### 1. Logger Enhancement

Add a public method to the Logger class to expose the logs directory path:

```typescript
// In logger.ts
getLogDirectory(): string {
  return this.paths.data;
}
```

### 2. Help Command Enhancement

Add logs directory information to the yargs epilogue section in the help output:

**Option A: Environment Variables Section**
Add logs directory path alongside existing environment variables documentation.

**Option B: New Troubleshooting Section**
Create a dedicated troubleshooting section with logs directory information.

**Option C: Examples Section Enhancement**
Add examples showing how to find and view logs.

### 3. Implementation Approach

#### Phase 1: Logger Method Addition

- Add `getLogDirectory()` method to Logger class
- Export method for external access
- Ensure thread-safe access to paths

#### Phase 2: Help Text Enhancement

- Import logger in CLI module
- Add logs directory path to yargs epilogue
- Format output consistently with existing help style

#### Phase 3: Testing & Validation

- Test help output on different platforms
- Verify directory path accuracy
- Ensure no performance impact on help command

## Implementation Details

### 1. Logger Changes (`src/logger.ts`)

```typescript
// Add public method to Logger class
getLogDirectory(): string {
  return this.paths.data;
}

// Export singleton instance method
export const getLogDirectory = (): string => {
  return logger.getLogDirectory();
};
```

### 2. CLI Changes (`src/cli.ts`)

```typescript
// Import logger utility
import { getLogDirectory } from './logger.js';

// Enhance epilogue with logs directory
const epilogue = `
Environment Variables:
  OPENAI_API_KEY          Required for OpenAI provider
  OPENROUTER_API_KEY      Required for OpenRouter provider
  AGENT_SPAWNING_DISABLED Set to 'true' to disable agent spawning

Logs Directory:
  ${getLogDirectory()}
  
  Session logs: sessions/
  Tool logs:    mcp-tools/

Examples:
  [existing examples...]
`;
```

### 3. Alternative Lightweight Approach

If importing logger creates circular dependencies or performance concerns:

```typescript
// Direct env-paths usage in CLI
import envPaths from 'env-paths';

const paths = envPaths('envoy');
const epilogue = `
...
Logs Directory:
  ${paths.data}
...
`;
```

## Testing Strategy

### 1. Unit Tests

- Test logger `getLogDirectory()` method
- Verify path resolution on different platforms
- Test help command output formatting

### 2. Integration Tests

- Test help command with actual directory paths
- Verify logs directory exists and is accessible
- Cross-platform compatibility testing

### 3. Manual Testing

- Run `npx . --help` and verify logs directory is shown
- Check path accuracy on macOS/Linux/Windows
- Verify formatting consistency

## Benefits

### 1. User Experience

- **Discoverability**: Users can easily find their log files
- **Troubleshooting**: Faster debugging and support
- **Transparency**: Clear visibility into where logs are stored

### 2. Support & Maintenance

- **Reduced Support**: Fewer "where are my logs?" questions
- **Self-service**: Users can find logs independently
- **Documentation**: Built-in documentation via help command

### 3. Development

- **Consistency**: Unified approach to showing system paths
- **Extensibility**: Pattern for showing other system information

## Risks & Mitigation

### 1. Path Resolution Issues

- **Risk**: Directory path might not exist or be inaccessible
- **Mitigation**: Show path regardless of existence, as it's informational

### 2. Performance Impact

- **Risk**: Help command might be slower due to path resolution
- **Mitigation**: Use lightweight approach or cache path resolution

### 3. Cross-Platform Compatibility

- **Risk**: Path format differences across platforms
- **Mitigation**: Rely on `env-paths` library for consistent path resolution

## Success Criteria

### 1. Functional Requirements

- [ ] Help command shows logs directory path
- [ ] Path is accurate and platform-appropriate
- [ ] No performance degradation in help command
- [ ] Cross-platform compatibility maintained

### 2. User Experience Requirements

- [ ] Clear, readable formatting in help output
- [ ] Consistent with existing help style
- [ ] Helpful context (subdirectories explanation)

### 3. Technical Requirements

- [ ] No circular dependencies introduced
- [ ] Minimal code changes required
- [ ] Backward compatibility maintained
- [ ] Test coverage for new functionality

## Timeline

- **Phase 1**: Logger enhancement (1-2 hours)
- **Phase 2**: Help command enhancement (1-2 hours)
- **Phase 3**: Testing & validation (1 hour)
- **Total**: 3-5 hours

## Future Enhancements

### 1. Log Management Commands

- Add CLI commands for log cleanup
- Add commands to open logs directory
- Add commands to view recent logs

### 2. Enhanced Help Sections

- Add troubleshooting section with common issues
- Add system information section
- Add configuration file locations

### 3. Interactive Help

- Add interactive help mode
- Add contextual help based on current state
- Add help for specific commands or options

## Conclusion

This enhancement provides significant value to users with minimal implementation complexity. The approach leverages existing infrastructure (yargs, env-paths, logger) and follows established patterns in the codebase. The implementation is low-risk and provides immediate benefits for user experience and support efficiency.
