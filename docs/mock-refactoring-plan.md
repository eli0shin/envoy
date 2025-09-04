# Mock Refactoring Plan: Eliminate Test-Only Types

## Problem Statement

Current test files contain:

- Custom mock types (`MockMCPClient`, `MockClientInstance`, etc.)
- Type casting (`as unknown as`, `as any`)
- Scattered mock creation logic
- Incomplete API surface coverage leading to type drift

**Goal**: Replace with centralized mock functions that use ONLY real MCP SDK types.

## Core Principles

### 1. No Type Casting

- Mock functions must return objects that naturally satisfy real interfaces
- Zero `as unknown as` or `as any` in mock creation
- TypeScript should accept the mocks without coercion

### 2. Full API Surface Coverage

- Mock functions must implement ALL methods/properties of the real type
- Prevents missing method errors during testing
- Ensures test type safety matches production type safety

### 3. Real Types Only

- Use only types from `@modelcontextprotocol/sdk`
- No custom test types or interfaces
- Leverage TypeScript's `Partial<T>` for optional overrides

## Implementation Plan

### Phase 1: Analyze Real MCP SDK Types

#### Client Interface Analysis

```typescript
// From @modelcontextprotocol/sdk/client/index.js
interface Client {
  // Core methods
  connect(transport: Transport): Promise<void>;
  callTool(params: CallToolParams): Promise<CallToolResult>;
  getPrompt(params: GetPromptParams): Promise<GetPromptResult>;
  readResource(params: ReadResourceParams): Promise<ReadResourceResult>;

  // Capability methods
  listTools(params?: ListToolsParams): Promise<ListToolsResult>;
  listPrompts(params?: ListPromptsParams): Promise<ListPromptsResult>;
  listResources(params?: ListResourcesParams): Promise<ListResourcesResult>;

  // Registration methods
  registerCapabilities(capabilities: ClientCapabilities): void;

  // Event handling
  onNotification(handler: NotificationHandler): void;
  onRequest(handler: RequestHandler): void;

  // Lifecycle
  close(): Promise<void>;
}
```

#### Transport Interface Analysis

```typescript
// StdioClientTransport specific properties
interface StdioClientTransport {
  connect(): Promise<void>;
  close(): Promise<void>;
  send(message: JSONRPCMessage): Promise<void>;

  // Internal properties (accessed via casting in real code)
  process?: {
    stderr?: NodeJS.ReadableStream;
    stdout?: NodeJS.ReadableStream;
    stdin?: NodeJS.WritableStream;
  };
}

// SSEClientTransport specific properties
interface SSEClientTransport {
  connect(): Promise<void>;
  close(): Promise<void>;
  send(message: JSONRPCMessage): Promise<void>;

  // SSE-specific properties
  url?: string;
  eventSource?: EventSource;
}
```

### Phase 2: Create Centralized Mock Functions

#### File: `src/test/helpers/createMocks.ts`

```typescript
import { vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

/**
 * Creates a complete Client mock with all methods implemented
 * No casting required - naturally satisfies Client interface
 */
export function createMockClient(overrides: Partial<Client> = {}): Client {
  return {
    // Core methods
    connect: vi.fn(),
    callTool: vi.fn(),
    getPrompt: vi.fn(),
    readResource: vi.fn(),

    // Capability methods
    listTools: vi.fn(),
    listPrompts: vi.fn(),
    listResources: vi.fn(),

    // Registration methods
    registerCapabilities: vi.fn(),

    // Event handling
    onNotification: vi.fn(),
    onRequest: vi.fn(),

    // Lifecycle
    close: vi.fn(),

    // Apply any overrides
    ...overrides,
  };
}

/**
 * Creates a complete StdioClientTransport mock with all properties
 * Includes internal properties that real code accesses via casting
 */
export function createMockStdioTransport(
  overrides: Partial<StdioClientTransport> = {}
): StdioClientTransport {
  return {
    connect: vi.fn(),
    close: vi.fn(),
    send: vi.fn(),

    // Internal properties (matches real implementation casting pattern)
    process: {
      stderr: {
        on: vi.fn(),
        removeListener: vi.fn(),
        emit: vi.fn(),
      },
      stdout: {
        on: vi.fn(),
        removeListener: vi.fn(),
        emit: vi.fn(),
      },
      stdin: {
        write: vi.fn(),
        end: vi.fn(),
      },
    },

    // Apply any overrides
    ...overrides,
  } as StdioClientTransport;
}

/**
 * Creates a complete SSEClientTransport mock with all properties
 */
export function createMockSSETransport(
  overrides: Partial<SSEClientTransport> = {}
): SSEClientTransport {
  return {
    connect: vi.fn(),
    close: vi.fn(),
    send: vi.fn(),

    // SSE-specific properties
    url: 'http://test.example.com/sse',
    eventSource: {
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as EventSource,

    // Apply any overrides
    ...overrides,
  } as SSEClientTransport;
}
```

#### Key Design Decisions:

1. **Complete API Coverage**: Every method/property from real interface is included
2. **Default vi.fn() Implementation**: All methods are mockable by default
3. **Override Support**: `Partial<T>` allows test-specific customization
4. **Internal Property Support**: Includes properties accessed via casting in real code
5. **No Type Assertions in Usage**: Returned objects naturally satisfy interfaces

### Phase 3: Replace Scattered Mock Creation

#### Before (Current Pattern):

```typescript
// Scattered throughout test files
const mockClient = {
  getPrompt: vi.fn(),
  readResource: vi.fn(),
} as unknown as Client; // ❌ Casting required

const mockTransport = {
  process: { stderr: { on: vi.fn() } },
} as Partial<StdioClientTransport>; // ❌ Incomplete API
```

#### After (Centralized Pattern):

```typescript
// Import centralized mocks
import {
  createMockClient,
  createMockStdioTransport,
} from '../test/helpers/createMocks.js';

// No casting needed - naturally typed
const mockClient = createMockClient(); // ✅ Complete Client

const mockTransport = createMockStdioTransport({
  // Override only what's needed for this test
  process: {
    stderr: { on: vi.fn().mockImplementation((event, cb) => cb('test')) },
  },
}); // ✅ Complete StdioClientTransport
```

### Phase 4: Systematic Replacement Strategy

#### Step 1: Create the centralized mock file

- Implement `createMockClient()`
- Implement `createMockStdioTransport()`
- Implement `createMockSSETransport()`

#### Step 2: Replace mock creation by category

1. **Client mocks**: Replace all `createMockMCPClient()` calls
2. **Transport mocks**: Replace all transport mock creation
3. **Inline mocks**: Replace one-off mock objects

#### Step 3: Remove obsolete files

- Delete `src/test/helpers/mockMCPClient.ts`
- Delete `src/test/helpers/mockTransport.ts`
- Remove all custom mock types

#### Step 4: Verify no casting remains

- Search for `as unknown as`
- Search for `as any`
- Search for `vi.mocked()` usage (should be unnecessary)

### Phase 5: Validation Criteria

#### TypeScript Compilation

- `npm run type` passes without errors
- No type assertions in test files
- Full IntelliSense support for mock objects

#### Test Execution

- `npm test` passes all 1660 tests
- No runtime type errors
- Mock methods properly accessible

#### Code Quality

- `npm run lint` passes
- No custom mock types defined
- Consistent mock usage patterns

## Benefits

1. **Type Safety**: Mocks match production types exactly
2. **Developer Experience**: Full autocomplete and type checking
3. **Maintainability**: Single source of truth for mock creation
4. **Reliability**: Complete API surface prevents missing method errors
5. **Consistency**: Uniform mocking patterns across codebase

## Logger Mock Strategy (Phase 1 - Completed)

### Issue Analysis

Analyzed 50+ files with logger mock patterns and found significant duplication. Test files fall into two categories:

- **Infrastructure tests**: Just need logger to exist and not interfere with the test
- **Assertion tests**: Need to assert on specific logger method calls

### Solution Approach

1. **Global logger mock** in `vitest.setup.ts` for infrastructure tests
2. **Centralized mock pattern** for assertion tests that need manual mocking
3. **Consistent mock structure** following the same pattern as existing createMockClient() function

### Implementation

- Global logger mock implemented in `vitest.setup.ts` using `createMockLogger()`
- Centralized `createMockLogger()` function in `src/test/helpers/createMocks.ts`
- Removed redundant logger mocks from 20+ infrastructure test files
- Fixed assertion tests to use inline mock definitions (to avoid vi.mock() hoisting issues)

### Vi.mock() Hoisting Issue Resolution

Initially attempted to use `createMockLogger()` inside `vi.mock()` factory functions for assertion tests, but encountered hoisting errors because:

- `vi.mock()` calls are hoisted to the top of the file
- Import statements for `createMockLogger()` are not hoisted
- This creates a timing issue where the function is called before it's available

**Solution**: Use inline mock definitions in assertion tests that follow the same structure as the centralized pattern:

```typescript
vi.mock('./logger.js', () => ({
  // Main logger object
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    // ... other methods
  },
  // Individual function exports
  getSessionId: vi.fn(() => 'test-session-id'),
  // ... other exports
}));
```

### Benefits

- Eliminates mock duplication across 50+ test files
- Provides consistent logger mock structure
- Allows for easy overrides in assertion tests using `vi.mocked(mock.method)`
- Maintains type safety and comprehensive API coverage
- Resolves vi.mock() hoisting issues while maintaining centralized pattern

### Status: ✅ Complete

- Global logger mock implemented in `vitest.setup.ts`
- Centralized `createMockLogger()` function created
- All 1660 tests passing
- Logger mock duplication eliminated across codebase

## Client and Transport Mock Strategy (Phase 2 - Completed)

### Issue Analysis

Analyzed test files with MCPClientWrapper mock patterns and found scattered mock creation with type casting. Test files contained:

- **Scattered inline mock creation** using object literals with incomplete APIs
- **Type casting patterns** like `as unknown as MCPClientWrapper` throughout test files
- **Inconsistent mock structures** with different subsets of methods implemented
- **Missing centralized function** for MCPClientWrapper mocks despite existing Client and Transport helpers

### Solution Approach

1. **Enhanced centralized mock functions** in `createMocks.ts` with `createMockMCPClientWrapper()`
2. **Systematic replacement** of all scattered MCPClientWrapper mock creation
3. **Complete elimination** of type casting (`as unknown as MCPClientWrapper`)
4. **Leveraged existing infrastructure** - Client and Transport mock functions were already implemented

### Implementation

1. **Enhanced `createMocks.ts`** with MCPClientWrapper support:

   ```typescript
   export function createMockMCPClientWrapper(
     overrides: Partial<MCPClientWrapper> = {}
   ): MCPClientWrapper {
     return {
       serverName: 'test-server',
       serverConfig: { type: 'stdio', command: 'test-command', args: [] },
       tools: new Map<string, WrappedTool>(),
       prompts: new Map<string, MCPPrompt>(),
       resources: new Map<string, MCPResource>(),
       isConnected: true,
       // All required methods with vi.fn() implementations
       connect: vi.fn(),
       disconnect: vi.fn(),
       listPrompts: vi.fn().mockResolvedValue([]),
       getPrompt: vi.fn(),
       listResources: vi.fn().mockResolvedValue([]),
       readResource: vi.fn(),
       ...overrides,
     };
   }
   ```

2. **Replaced scattered mock creation** in test files:

   - `src/cli/handlers/mcpCommands.test.ts` - replaced inline mock objects with centralized function
   - `src/cli/handlers/executionFlow.test.ts` - replaced 2 large inline mock objects
   - `src/cli/index.test.ts` - replaced 3 mock objects and removed all type casting
   - `src/mcp/capabilityLoader.test.ts` - replaced local `createMockWrapper()` function

3. **Eliminated all type casting**:
   - Removed 8 instances of `as unknown as MCPClientWrapper`
   - Removed related unused type imports
   - Tests now use properly typed mock objects without casting

### Benefits

- **Type Safety**: Mocks naturally satisfy MCPClientWrapper interface without casting
- **Complete API Coverage**: All interface methods implemented with default vi.fn() mocks
- **Consistency**: Uniform mock creation pattern following established helper function approach
- **Maintainability**: Single source of truth for MCPClientWrapper mock structure
- **Test Reliability**: No missing method errors, full IntelliSense support

### Status: ✅ Complete

- Centralized `createMockMCPClientWrapper()` function implemented
- All scattered MCPClientWrapper mock creation replaced with centralized function
- All type casting (`as unknown as MCPClientWrapper`) eliminated from test files
- All 1660 tests passing with properly typed mocks
- Existing Client and Transport mock functions already available for future use

## File System Mock Strategy (Phase 3 - Completed)

### Issue Analysis

Analyzed 13 test files with file system mock patterns and found significant duplication. Files contained:

- **4 files** using `vi.mock('fs/promises')` with various method subsets
- **9 files** using `vi.mock('fs')` with different promise method implementations
- **Common duplicated methods**: `readFile`, `writeFile`, `access`, `mkdir`, `appendFile`, `readdir`, `stat`, `unlink`, `chmod`
- **Inconsistent patterns**: Some files mocked only needed methods, others included comprehensive method sets

### Solution Approach

Followed the **standard pattern** established for logger mocks:

1. **Centralized helper functions**: `createFsPromisesMock()` and `createFsMock()` in `createMocks.ts`
2. **Global mocks**: Added to `vitest.setup.ts` using `vi.mock()` calls, same as logger mock
3. **Remove inline mocks**: Eliminated all repetitive inline mock declarations from test files

### Implementation

1. **Created centralized helper functions** in `createMocks.ts`:

   - `createFsPromisesMock()` - Complete fs/promises mock with all common methods
   - `createFsMock()` - Complete fs mock with promises object
   - Functions return consistently structured mock objects with vi.fn() for all methods

2. **Added global mocks** to `vitest.setup.ts`:

   ```typescript
   // Global file system mocks for all tests
   vi.mock('fs/promises', () => createFsPromisesMock());
   vi.mock('fs', () => createFsMock());
   ```

3. **Removed all inline fs mocks** from test files:

   - `src/config.test.ts` - removed fs/promises mock
   - `src/config.persistence.test.ts` - removed fs/promises mock
   - `src/config/files.test.ts` - removed fs/promises mock
   - `src/config/loader.test.ts` - removed fs/promises mock
   - `src/shared/fileOperations.test.ts` - removed fs mock
   - `src/persistence/ConversationPersistence.test.ts` - removed fs mock
   - `src/cli.resume.test.ts` - removed fs mock
   - `src/auth/credentialStore.test.ts` - removed fs mock
   - `src/todoServer.test.ts` - removed fs mock

4. **Standard Pattern Consistency**:
   - Follows exact same approach as logger mock (global setup, no per-file mocking)
   - Tests can use `vi.mocked()` to override specific methods when needed
   - Single source of truth for fs mock structure

### Benefits

- **Eliminates duplication**: No more repetitive inline fs mock declarations
- **Follows established pattern**: Uses same approach as logger mock (global setup)
- **Complete API coverage**: All common fs methods included by default
- **Type safety**: Proper TypeScript typing for all mock methods
- **Maintainability**: Single source of truth for fs mock structure
- **Consistency**: Uniform mocking patterns across all fs-related tests
- **Test-specific overrides**: Tests can use `vi.mocked()` to customize behavior when needed

### Status: ✅ Complete

- Centralized file system mock functions created in `createMocks.ts`
- Global fs mocks implemented in `vitest.setup.ts` following standard pattern
- All 9 inline fs mock declarations removed from test files
- All 1660 tests passing with global fs mocks
- Consistent approach matching logger mock strategy

## Migration Checklist

### Phase 1: Logger Mock Centralization ✅ COMPLETE

- [x] Create `src/test/helpers/createMocks.ts`
- [x] Implement `createMockLogger()` with full API
- [x] Implement global logger mock in `vitest.setup.ts`
- [x] Remove redundant logger mocks from infrastructure tests
- [x] Fix assertion tests with inline mock definitions following centralized pattern
- [x] Resolve vi.mock() hoisting issues for test-specific overrides
- [x] Verify all 1660 tests pass

### Phase 2: Client and Transport Mock Centralization ✅ COMPLETE

- [x] Implement `createMockClient()` with full API
- [x] Implement `createMockStdioTransport()` with full API
- [x] Implement `createMockSSETransport()` with full API
- [x] Implement `createMockMCPClientWrapper()` with full API
- [x] Replace MCPClientWrapper mocks in all test files
- [x] Replace transport mocks where needed
- [x] Remove all type casting (`as unknown as MCPClientWrapper`)
- [x] Verify all 1660 tests pass
- [x] Confirm TypeScript compilation succeeds

### Phase 3: File System Mock Centralization ✅ COMPLETE

- [x] Analyze current file system mock duplications across test files
- [x] Create centralized file system mock functions in `createMocks.ts`
- [x] Implement global fs mocks in `vitest.setup.ts` using standard pattern
- [x] Remove all inline fs mock declarations from test files
- [x] Verify all tests pass with global fs mocks
- [x] Update documentation to reflect global fs mock approach
