# MCP Prompt Autocomplete Integration Design Proposal

## Overview

This document proposes integrating MCP (Model Context Protocol) prompt autocomplete and execution into the interactive session's command system, providing the same user experience as built-in commands like `/help`, `/exit`, etc.

## Current State Analysis

### Existing Functionality

**Command Autocomplete System** (`src/ui/components/InputPrompt.tsx:91-150`):

- Commands start with `/` character
- `CommandRegistry.getSuggestions()` generates autocomplete suggestions
- Tab completion, up/down navigation, ESC dismissal
- Supports both command name and argument completion
- Uses `AutocompleteOverlay` for visual display

**MCP Prompt Infrastructure**:

- `MCPPrompt` type with `name`, `description`, and `arguments[]` (`src/types/index.ts`)
- MCP prompt arguments support `name`, `description`, `required` boolean
- `AgentSession.mcpClients: MCPClientWrapper[]` provides access to MCP servers
- Existing CLI commands: `--list-prompts`, `--prompt <name>`, `--interactive-prompt`
- `executePrompt()` and MCP capability tools (`list_prompts`, `get_prompt`)

**Built-in Commands** (`src/interactiveSession.ts:170-265`):

- `/exit`, `/quit`, `/clear`, `/help`, `/history`, `/resume`, `/conversations`
- `SpecialCommand` type with `command`, `description`, `handler`, `arguments?`
- `CommandArgument` type supports predefined `values: string[]` for autocomplete

### Current Gaps

1. **No MCP Integration in Interactive Session**: MCP prompts are available via CLI flags and agent tools, but not as `/` commands
2. **No Dynamic Command Loading**: `CommandRegistry` uses static `getSpecialCommands()` function
3. **No Access to MCP Clients**: Interactive session components don't have access to `AgentSession.mcpClients`

## Design Proposal

### 1. Enhanced CommandRegistry Architecture

**Simple Function-Based Approach**:

```typescript
// src/ui/commands/commandProviders.ts

/**
 * Gets built-in special commands
 */
export async function getBuiltinCommands(): Promise<SpecialCommand[]> {
  return getSpecialCommands(); // Existing function
}

/**
 * Gets MCP prompt commands from all connected servers using cached prompts
 */
export function getMCPPromptCommands(
  mcpClients: MCPClientWrapper[]
): SpecialCommand[] {
  const commands: SpecialCommand[] = [];

  for (const client of mcpClients) {
    // Use cached prompts from startup - no network call needed
    const prompts = Array.from(client.prompts.values());

    for (const prompt of prompts) {
      commands.push({
        command: `/${client.serverName}:${prompt.name}`,
        description:
          prompt.description ||
          `Execute ${prompt.name} prompt from ${client.serverName}`,
        handler: async (session, args) => {
          await executeMCPPrompt(client, prompt.name, args, session);
        },
        arguments: prompt.arguments?.map(arg => ({
          name: arg.name,
          description: arg.description || '',
          required: arg.required || false,
        })),
      });
    }
  }

  return commands;
}

/**
 * Executes an MCP prompt and adds result to session
 */
async function executeMCPPrompt(
  client: MCPClientWrapper,
  promptName: string,
  args?: string,
  session?: InteractiveSession
): Promise<void> {
  try {
    const parsedArgs = parsePromptArguments(args);
    const result = await client.getPrompt(promptName, parsedArgs);

    // Add prompt result as user message to continue conversation
    if (session && result.messages.length > 0) {
      const promptContent = result.messages
        .map(
          msg =>
            `[${msg.role}] ${msg.content.text || JSON.stringify(msg.content)}`
        )
        .join('\n');

      // Add as user message to trigger agent response
      session.messages.push({
        role: 'user',
        content: promptContent,
      });
    }
  } catch (error) {
    console.error(
      `Failed to execute prompt ${promptName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parses prompt arguments from string
 */
function parsePromptArguments(args?: string): Record<string, unknown> {
  if (!args) return {};

  // Simple implementation: "key1=value1 key2=value2"
  const parsed: Record<string, unknown> = {};
  const pairs = args.split(' ');

  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=');
      try {
        parsed[key] = JSON.parse(value);
      } catch {
        parsed[key] = value;
      }
    }
  }

  return parsed;
}

/**
 * Sets up MCP notification handlers for prompt list changes
 */
export function setupMCPPromptNotifications(
  mcpClients: MCPClientWrapper[],
  onPromptsChanged: () => void
): void {
  for (const wrapper of mcpClients) {
    try {
      // Access the underlying MCP client to set up notification handlers
      const client = wrapper.client; // Note: Need to expose client in MCPClientWrapper

      // Set up handler for prompt list changes
      client.setNotificationHandler(
        {
          method: z.literal('notifications/prompts/list_changed'),
          params: z
            .object({
              _meta: z.object({}).optional(),
            })
            .optional(),
        },
        async notification => {
          logger.debug(
            `Prompts list changed for server: ${wrapper.serverName}`
          );

          // Refresh the wrapper's internal prompt cache
          try {
            const prompts = await wrapper.listPrompts();
            wrapper.prompts.clear();

            for (const prompt of prompts) {
              wrapper.prompts.set(prompt.name, prompt);
            }
          } catch (error) {
            logger.warn(
              `Failed to refresh prompts for ${wrapper.serverName}: ${error}`
            );
          }

          // Notify that prompts changed
          onPromptsChanged();
        }
      );
    } catch (error) {
      logger.warn(
        `Failed to set up notification handlers for ${wrapper.serverName}: ${error}`
      );
    }
  }
}
```

**Simplified CommandRegistry**:

```typescript
// src/ui/commands/CommandRegistry.ts (simplified)
export type CommandRegistry = {
  commandCache: Map<string, SpecialCommand>;
  mcpClients?: MCPClientWrapper[];
  isInitialized: boolean;
};

export function createCommandRegistry(
  mcpClients?: MCPClientWrapper[]
): CommandRegistry {
  const registry: CommandRegistry = {
    commandCache: new Map(),
    mcpClients,
    isInitialized: false,
  };

  // Set up MCP notifications if clients are provided
  if (mcpClients) {
    setupMCPPromptNotifications(mcpClients, () => refreshCommands(registry));
  }

  return registry;
}

export async function initializeCommands(
  registry: CommandRegistry
): Promise<void> {
  if (registry.isInitialized) return;

  await refreshCommands(registry);
  registry.isInitialized = true;
}

export async function refreshCommands(
  registry: CommandRegistry
): Promise<void> {
  registry.commandCache.clear();

  try {
    // Load built-in commands
    const builtinCommands = await getBuiltinCommands();
    for (const command of builtinCommands) {
      registry.commandCache.set(command.command, command);
    }

    // Load MCP prompt commands if clients are available
    if (registry.mcpClients) {
      const mcpCommands = getMCPPromptCommands(registry.mcpClients);
      for (const command of mcpCommands) {
        registry.commandCache.set(command.command, command);
      }
    }
  } catch (error) {
    logger.warn(`Failed to load commands: ${error}`);
  }
}

export async function getSuggestions(
  registry: CommandRegistry,
  input: string
): Promise<AutocompleteSuggestion[]> {
  await initializeCommands(registry);

  if (!input.startsWith('/')) return [];

  const parts = input.split(' ');
  const commandPart = parts[0];

  if (parts.length === 1) {
    // Complete command name
    return Array.from(registry.commandCache.values())
      .filter(cmd =>
        cmd.command.toLowerCase().startsWith(commandPart.toLowerCase())
      )
      .map(cmd => ({
        value: cmd.command,
        description: cmd.description,
        type: 'command' as const,
      }));
  }

  // Complete arguments for known command
  const command = registry.commandCache.get(commandPart);
  if (command && command.arguments) {
    const currentArg =
      parts.length === 2 && parts[1] === '' ? '' : parts[parts.length - 1];
    return getArgumentSuggestions(command, currentArg);
  }

  return [];
}

export async function executeCommand(
  registry: CommandRegistry,
  input: string,
  session?: InteractiveSession
): Promise<boolean> {
  await initializeCommands(registry);

  const { command, args } = parseSpecialCommand(input);
  const specialCommand = registry.commandCache.get(command);

  if (!specialCommand) return false;

  await specialCommand.handler(session!, args);
  return true;
}
```

### 2. Integration Points

**Modified InputPrompt Component**:

```typescript
// src/ui/components/InputPrompt.tsx (key changes)
export function InputPrompt({
  onSubmit,
  value,
  onChange,
  isLoading,
  queuedMessages,
  onPopFromQueue,
  mcpClients, // NEW: Pass MCP clients
}: InputPromptProps & { mcpClients?: MCPClientWrapper[] }) {
  const commandRegistry = useRef<CommandRegistry | null>(null);

  useEffect(() => {
    // Initialize command registry when MCP clients are available
    if (mcpClients && mcpClients.length > 0 && !commandRegistry.current) {
      commandRegistry.current = createCommandRegistry(mcpClients);
    }
  }, [mcpClients]);

  // Update autocomplete to use async getSuggestions
  const updateAutocomplete = async (newState: MultilineInputState) => {
    if (!commandRegistry.current) return;

    const currentValue = joinLines(newState.lines);
    const suggestions = await getSuggestions(
      commandRegistry.current,
      currentValue
    );

    setAutocompleteState({
      isActive: suggestions.length > 0,
      suggestions,
      selectedIndex: 0,
    });
  };

  // Handle submission with enhanced command execution
  const handleSubmit = async (input: string) => {
    if (isSpecialCommand(input) && commandRegistry.current) {
      const executed = await executeCommand(
        commandRegistry.current,
        input,
        session
      );
      if (executed) {
        // Command was executed, don't pass to agent
        return;
      }
    }

    // Regular message submission
    onSubmit(input);
  };
}
```

**Enhanced InkInterface Integration**:

```typescript
// src/ui/InkInterface.tsx (modifications)
function InkApp({
  session,
  agentSession,
  config
}: InkInterfaceProps) {
  // Pass MCP clients to InputPrompt
  return (
    <Box flexDirection="column" height="100%">
      {/* ... existing components ... */}
      <InputPrompt
        // ... existing props ...
        mcpClients={agentSession.mcpClients} // NEW: Pass MCP clients
      />
    </Box>
  );
}
```

### 3. Command Naming Strategy

**Proposed Format**: `/{serverName}:{promptName}`

**Examples**:

- `/filesystem:search` - Search prompt from filesystem server
- `/git:commit-message` - Commit message prompt from git server
- `/docs:summarize` - Summarize prompt from docs server

**Benefits**:

- Clear namespace separation prevents conflicts
- Easy to identify source server
- Consistent with existing `server:prompt` pattern in CLI

**Alternative Considered**: `/{promptName}` (simpler but risk of conflicts)

### 4. Argument Handling Strategy

**Current MCP Limitation**: MCP prompt arguments don't have predefined `values[]` like built-in commands

**Proposed Solutions**:

1. **Simple Key-Value Parsing**: `name=value language=python`
2. **JSON Arguments**: `--args '{"name": "example", "language": "python"}'`
3. **Interactive Argument Collection** (future enhancement): Prompt user for required arguments

**Initial Implementation**: Simple key-value parsing for MVP

### 5. Execution Flow Differentiation

**Command Type Detection**:

```typescript
function isBuiltinCommand(command: string): boolean {
  return [
    '/exit',
    '/quit',
    '/clear',
    '/help',
    '/history',
    '/resume',
    '/conversations',
  ].includes(command);
}

function isMCPPromptCommand(command: string): boolean {
  return command.includes(':') && command.startsWith('/');
}
```

**Execution Handling**:

1. **Built-in Commands**: Execute immediately, don't trigger agent
2. **MCP Prompt Commands**: Execute prompt, inject result as user message to trigger agent response
3. **Regular Messages**: Pass to agent as normal

### 6. Required Infrastructure Changes

**MCPClientWrapper Enhancement**:

The current `MCPClientWrapper` interface needs to expose the underlying MCP `Client` instance to enable notification handler setup:

```typescript
// src/types/index.ts (enhancement needed)
export type MCPClientWrapper = {
  serverName: string;
  serverConfig: MCPServerConfig;
  tools: Map<string, WrappedTool>;
  prompts: Map<string, MCPPrompt>;
  resources: Map<string, MCPResource>;
  isConnected: boolean;
  childProcess?: ChildProcess;
  client: Client; // NEW: Expose underlying MCP client for notification handlers

  // ... existing methods
};
```

This change allows the `MCPPromptCommandProvider` to:

- Set up `notifications/prompts/list_changed` handlers
- Automatically refresh command cache when prompts change
- Maintain real-time synchronization with MCP server state

## Implementation Plan

### Phase 1: Core Infrastructure

1. Create `CommandProvider` interface and implementations
2. Enhance `CommandRegistry` with async capabilities
3. Update `InputPrompt` to support async autocomplete

### Phase 2: MCP Integration

1. Create `MCPPromptCommandProvider` with notification handlers
2. Integrate MCP clients into UI components
3. Implement basic argument parsing
