# Ink Frontend Design Document

## Executive Summary

This document outlines the design and implementation strategy for a new interactive terminal interface using Ink (React renderer for terminals) to replace the current inquirer-based interactive mode. The new interface will provide a modern, visually appealing, and responsive user experience while maintaining full compatibility with the existing agent architecture.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current State Analysis](#current-state-analysis)
3. [Design Goals](#design-goals)
4. [Technical Architecture](#technical-architecture)
5. [Component Design](#component-design)
6. [Integration Strategy](#integration-strategy)
7. [Implementation Plan](#implementation-plan)
8. [Testing Strategy](#testing-strategy)
9. [Performance Considerations](#performance-considerations)
10. [Risk Assessment](#risk-assessment)

## Problem Statement

The current interactive mode uses inquirer prompts with basic console logging, which creates several limitations:

- **Poor User Experience**: Simple text-based interface lacks visual hierarchy
- **Limited Interaction**: Basic prompt-response model without rich UI elements
- **Markdown Rendering**: Agent responses with markdown are not properly formatted
- **No Visual Feedback**: Missing loading indicators and status visualization
- **Input Limitations**: Single-line input with no persistent prompt positioning
- **Message Organization**: No visual distinction between different message types

## Current State Analysis

### Existing Interactive Mode Architecture

The current implementation consists of:

**Core Components:**

- `src/interactive.ts` - Main interactive mode orchestrator
- `src/interactiveSession.ts` - Session state management
- `src/cli.ts` - CLI entry point and mode activation

**Key Characteristics:**

- **Session-based architecture** with cached expensive operations
- **Event-driven loop** with signal handling for graceful shutdown
- **Message history management** via `InteractiveSession.messages: CoreMessage[]`
- **Special commands** (`/clear`, `/history`, `/help`, `/exit`)
- **Real-time streaming** via `onStepFinish` callback
- **Prefixed output** with `[assistant]` and `[tool-call]` tags

### Message Flow Analysis

**Message Structure:**

```typescript
type CoreMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  providerMetadata?: any;
};
```

**Message Processing:**

1. User input → `addUserMessage()` → Session history
2. Agent processing → `runAgentWithSession()` → Real-time streaming
3. Tool calls → `onStepFinish` callbacks → Console output
4. Response completion → `addAgentResponse()` → Session history

## Design Goals

### Primary Objectives

1. **Enhanced User Experience**

   - Persistent input prompt at bottom of terminal
   - Proper markdown rendering for agent responses
   - Visual indicators for different message types
   - Loading animations during processing

2. **Non-Disruptive Integration**

   - Maintain existing session management architecture
   - Preserve all current functionality
   - Support fallback to current interface
   - No changes to agent logic or MCP integration

3. **Performance & Reliability**

   - Efficient rendering with minimal re-renders
   - Memory-efficient message handling
   - Responsive interface even with long conversations
   - Graceful error handling and recovery

4. **Accessibility & Usability**
   - Keyboard navigation support
   - Clear visual hierarchy
   - Intuitive interaction patterns
   - Configurable via CLI flags and config files

### Secondary Objectives

1. **Extensibility**

   - Component-based architecture for future enhancements
   - Plugin system for custom UI elements
   - Theme support for different visual styles

2. **Developer Experience**
   - Comprehensive testing coverage
   - Clear component boundaries
   - Maintainable codebase using React patterns

## Technical Architecture

### Core Architecture Principles

**1. Separation of Concerns**

- UI layer (Ink components) separate from business logic
- Existing session management unchanged
- Message processing logic preserved

**2. React Component Model**

- Functional components with hooks
- Proper state management and lifecycle
- Reusable components with clear prop interfaces

**3. Performance-First Design**

- Efficient re-rendering strategies
- Virtualization for large message histories
- Debounced input handling

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                            CLI Entry Point                      │
│                         (src/cli.ts)                           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Mode Selection                              │
│    --ink flag or config → Ink Interface                       │
│    Default → Current Interface (fallback)                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Ink Interface Layer                          │
│                (src/ui/InkInterface.tsx)                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Session Bridge                                │
│              (src/ui/SessionBridge.ts)                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │        Existing Session Logic                          │   │
│   │    • AgentSession (expensive setup)                    │   │
│   │    • InteractiveSession (message history)              │   │
│   │    • runAgentWithSession (unchanged)                   │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                Component Hierarchy                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    <App>                                │    │
│  │  ┌─────────────┬─────────────┬─────────────┬─────────┐  │    │
│  │  │  <Header>   │<MessageList>│ <StatusBar> │<InputPrompt>│  │    │
│  │  │             │             │             │         │  │    │
│  │  │ • Model     │ • Message   │ • Status    │ • Input │  │    │
│  │  │   Info      │   History   │   Indicators│   Field │  │    │
│  │  │ • Session   │ • Markdown  │ • Commands  │ • Auto  │  │    │
│  │  │   Status    │   Rendering │   Help      │   Focus │  │    │
│  │  └─────────────┴─────────────┴─────────────┴─────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### Component Hierarchy

```tsx
<App>
├── <Header>                     // Static header with model info
├── <MessageList>               // Scrollable message history
│   ├── <MessageGroup>          // Groups messages by type/time
│   │   ├── <UserMessage>       // User input messages
│   │   ├── <AssistantMessage>  // AI responses with markdown
│   │   └── <ToolCallMessage>   // Tool execution info
│   └── <LoadingIndicator>      // Shows during AI/tool processing
├── <StatusBar>                 // Connection status, commands help
└── <InputPrompt>               // Always-visible input at bottom
```

### Component Specifications

#### 1. App Component (Root)

```tsx
type AppProps = {
  session: InteractiveSession;
  agentSession: AgentSession;
  config: RuntimeConfiguration;
};

function App({ session, agentSession, config }: AppProps) {
  const [uiState, setUIState] = useState<UIState>({
    isLoading: false,
    loadingMessage: '',
    currentInput: '',
    scrollPosition: 0,
    focusedComponent: 'input',
  });

  // Global keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      process.exit(0);
    }
    // Handle global shortcuts
  });

  return (
    <Box flexDirection="column" height="100%">
      <Header session={session} config={config} />
      <MessageList
        messages={session.messages}
        isLoading={uiState.isLoading}
        loadingMessage={uiState.loadingMessage}
      />
      <StatusBar session={session} />
      <InputPrompt
        onSubmit={handleUserInput}
        value={uiState.currentInput}
        onChange={setCurrentInput}
        isLoading={uiState.isLoading}
      />
    </Box>
  );
}
```

#### 2. WelcomeMessage Component

```tsx
type WelcomeMessageProps = {
  session: InteractiveSession;
  config: RuntimeConfiguration;
};

function WelcomeMessage({ session, config }: WelcomeMessageProps) {
  const { provider, model } = config;
  const startTime = session.startTime;

  return (
    <Box marginBottom={2} paddingX={1}>
      <Box flexDirection="column">
        <Text color="green" bold>
          🤖 Interactive mode activated
        </Text>
        <Text color="gray">
          Using {provider} ({model})
        </Text>
        <Text color="gray">
          Type your message and press Enter to chat with the AI.
        </Text>
        <Text color="gray">
          Special commands: /help, /clear, /history, /exit
        </Text>
        <Text color="gray">Press Ctrl+C to exit at any time.</Text>
      </Box>
    </Box>
  );
}
```

#### 3. MessageList Component

```tsx
type MessageListProps = {
  messages: CoreMessage[];
  config: RuntimeConfiguration;
  session: InteractiveSession;
  isLoading: boolean;
  loadingMessage: string;
};

function MessageList({
  messages,
  config,
  session,
  isLoading,
  loadingMessage,
}: MessageListProps) {
  const displayMessages = useMemo(
    () => transformMessagesForDisplay(messages),
    [messages]
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      <WelcomeMessage session={session} config={config} />
      <Box paddingX={1}>
        <Static items={displayMessages}>
          {(message, index) => <MessageGroup key={index} message={message} />}
        </Static>
        {isLoading && <LoadingIndicator message={loadingMessage} />}
      </Box>
    </Box>
  );
}
```

#### 4. Message Components

```tsx
// User Message
function UserMessage({ message }: { message: DisplayMessage }) {
  return (
    <Box marginBottom={1}>
      <Box marginRight={1}>
        <Text color="blue" bold>
          👤
        </Text>
      </Box>
      <Box flexDirection="column">
        <Text color="blue">{message.content}</Text>
        <Text color="gray" dimColor>
          {formatTimestamp(message.timestamp)}
        </Text>
      </Box>
    </Box>
  );
}

// Assistant Message with Markdown
function AssistantMessage({ message }: { message: DisplayMessage }) {
  const renderedContent = useMarkdown(message.content);

  return (
    <Box marginBottom={1}>
      <Box marginRight={1}>
        <Text color="green" bold>
          🤖
        </Text>
      </Box>
      <Box flexDirection="column">
        <MarkdownRenderer content={renderedContent} />
        <Text color="gray" dimColor>
          {formatTimestamp(message.timestamp)}
        </Text>
      </Box>
    </Box>
  );
}

// Tool Call Message
function ToolCallMessage({ message }: { message: DisplayMessage }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box marginBottom={1}>
      <Box marginRight={1}>
        <Text color="yellow" bold>
          🔧
        </Text>
      </Box>
      <Box flexDirection="column">
        <Box>
          <Text color="yellow" bold>
            Tool Call:{' '}
          </Text>
          <Text color="white">{message.toolName}</Text>
          <Text color="gray" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? ' [collapse]' : ' [expand]'}
          </Text>
        </Box>
        {isExpanded && (
          <Box borderLeft borderColor="yellow" paddingLeft={2} marginTop={1}>
            <Text color="gray">
              {JSON.stringify(message.toolArgs, null, 2)}
            </Text>
          </Box>
        )}
        <Text color="gray" dimColor>
          {formatTimestamp(message.timestamp)}
        </Text>
      </Box>
    </Box>
  );
}
```

#### 5. LoadingIndicator Component

```tsx
type LoadingIndicatorProps = {
  message: string;
};

function LoadingIndicator({ message }: LoadingIndicatorProps) {
  const [frame, setFrame] = useState(0);
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % spinner.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box marginBottom={1}>
      <Box marginRight={1}>
        <Text color="cyan">{spinner[frame]}</Text>
      </Box>
      <Text color="cyan" italic>
        {message}
      </Text>
    </Box>
  );
}
```

#### 6. InputPrompt Component

```tsx
type InputPromptProps = {
  onSubmit: (input: string) => void;
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
};

function InputPrompt({
  onSubmit,
  value,
  onChange,
  isLoading,
}: InputPromptProps) {
  const [cursorPosition, setCursorPosition] = useState(0);

  useInput((input, key) => {
    if (key.return && !isLoading) {
      onSubmit(value);
      onChange('');
      setCursorPosition(0);
    } else if (key.backspace || key.delete) {
      const newValue =
        value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(Math.max(0, cursorPosition - 1));
    } else if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
    } else if (key.rightArrow) {
      setCursorPosition(Math.min(value.length, cursorPosition + 1));
    } else if (input && !key.ctrl && !key.meta && !isLoading) {
      const newValue =
        value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition + input.length);
    }
  });

  return (
    <Box borderTop borderColor="blue" paddingX={1} paddingY={1}>
      <Box flexDirection="row">
        <Text color="blue" bold>
          {'> '}
        </Text>
        <Box flexGrow={1}>
          <Text>
            {value.slice(0, cursorPosition)}
            <Text backgroundColor={isLoading ? 'gray' : 'blue'} color="white">
              {value[cursorPosition] || ' '}
            </Text>
            {value.slice(cursorPosition + 1)}
          </Text>
        </Box>
        {isLoading && (
          <Text color="gray" italic>
            {' '}
            (Processing...)
          </Text>
        )}
      </Box>
    </Box>
  );
}
```

### Supporting Types and Utilities

```tsx
// UI State Management
type UIState = {
  isLoading: boolean;
  loadingMessage: string;
  currentInput: string;
  scrollPosition: number;
  focusedComponent: 'input' | 'messages';
};

// Display Message (transformed from CoreMessage)
type DisplayMessage = {
  id: string;
  type: 'user' | 'assistant' | 'tool-call' | 'system';
  content: string;
  timestamp: Date;
  toolName?: string;
  toolArgs?: any;
  metadata?: {
    streaming?: boolean;
    error?: string;
  };
};

// Message transformation utility
function transformMessagesForDisplay(
  messages: CoreMessage[]
): DisplayMessage[] {
  return messages.map((msg, index) => ({
    id: `msg-${index}`,
    type:
      msg.role === 'user'
        ? 'user'
        : msg.role === 'assistant'
          ? 'assistant'
          : msg.role === 'tool'
            ? 'tool-call'
            : 'system',
    content: msg.content,
    timestamp: new Date(),
    // Additional transformation logic
  }));
}

// Markdown rendering hook
function useMarkdown(content: string) {
  return useMemo(() => {
    // Transform markdown to Ink components
    // Handle code blocks, bold, italic, lists, etc.
    return <MarkdownRenderer content={content} />;
  }, [content]);
}
```

## Integration Strategy

### 1. Session Bridge Implementation

The session bridge provides seamless integration between the existing session management and the new Ink interface:

```typescript
// src/ui/SessionBridge.ts
export class SessionBridge {
  private session: InteractiveSession;
  private agentSession: AgentSession;
  private config: RuntimeConfiguration;
  private uiUpdateCallbacks: Set<(update: UIUpdate) => void> = new Set();

  constructor(
    session: InteractiveSession,
    agentSession: AgentSession,
    config: RuntimeConfiguration
  ) {
    this.session = session;
    this.agentSession = agentSession;
    this.config = config;
  }

  // Register UI update callback
  onUIUpdate(callback: (update: UIUpdate) => void) {
    this.uiUpdateCallbacks.add(callback);
  }

  // Handle user input (integrates with existing logic)
  async handleUserInput(input: string): Promise<void> {
    // Emit loading state
    this.emitUIUpdate({ type: 'loading', message: 'Processing...' });

    try {
      // Use existing session logic
      if (isSpecialCommand(input)) {
        await handleSpecialCommand(input, this.session);
      } else {
        await runAgentWithSession(
          this.session,
          input,
          this.config,
          this.agentSession
        );
      }
    } catch (error) {
      this.emitUIUpdate({ type: 'error', message: error.message });
    } finally {
      this.emitUIUpdate({ type: 'loading', message: '' });
    }
  }

  // Emit UI updates
  private emitUIUpdate(update: UIUpdate) {
    this.uiUpdateCallbacks.forEach(callback => callback(update));
  }
}
```

### 2. CLI Integration

```typescript
// src/cli.ts - Modified CLI entry point
async function main() {
  const config = await loadConfiguration();

  if (shouldActivateInteractiveMode(config)) {
    // Check for ink interface preference
    if (config.interface === 'ink' || process.argv.includes('--ink')) {
      try {
        await runInkInteractiveMode(config);
      } catch (error) {
        console.warn('Ink interface failed, falling back to standard mode:', error.message);
        await runInteractiveMode(config);
      }
    } else {
      await runInteractiveMode(config);
    }
  } else {
    await runSingleMode(config);
  }
}

// New ink interface runner
async function runInkInteractiveMode(config: RuntimeConfiguration): Promise<void> {
  const agentSession = await initializeAgentSession(config);
  const session = createInteractiveSession(config);

  // Render Ink interface
  const { unmount, waitUntilExit } = render(
    <InkApp session={session} agentSession={agentSession} config={config} />
  );

  // Handle cleanup
  process.on('SIGINT', () => {
    unmount();
    cleanupAgentSession(agentSession);
    process.exit(0);
  });

  await waitUntilExit();
}
```

### 3. Configuration Support

```typescript
// src/configTypes.ts - Add interface configuration
export type RuntimeConfiguration = {
  // ... existing configuration
  interface?: 'standard' | 'ink';
  inkOptions?: {
    theme?: 'default' | 'dark' | 'light';
    animations?: boolean;
    markdownRendering?: boolean;
    maxHistoryLength?: number;
  };
};

// Configuration schema update
export const configSchema = z.object({
  // ... existing schema
  interface: z.enum(['standard', 'ink']).optional(),
  inkOptions: z
    .object({
      theme: z.enum(['default', 'dark', 'light']).optional(),
      animations: z.boolean().optional(),
      markdownRendering: z.boolean().optional(),
      maxHistoryLength: z.number().optional(),
    })
    .optional(),
});
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)

1. **Setup Dependencies**

   - Add ink and related packages to package.json
   - Set up TypeScript configuration for React JSX
   - Create basic project structure

2. **Basic Components**

   - Implement App shell component
   - Create Header component with session info
   - Implement basic InputPrompt component
   - Add simple MessageList component

3. **Integration Layer**
   - Create SessionBridge class
   - Implement CLI integration with --ink flag
   - Add fallback mechanism to current interface

### Phase 2: Message Display (Week 3-4)

1. **Message Components**

   - Implement UserMessage, AssistantMessage, ToolCallMessage
   - Add message transformation utilities
   - Create LoadingIndicator component

2. **Markdown Rendering**

   - Implement markdown parsing for terminal display
   - Add code block syntax highlighting
   - Handle lists, bold, italic formatting

3. **Real-time Updates**
   - Hook into existing onStepFinish callbacks
   - Implement streaming message updates
   - Add proper state management

### Phase 3: Enhanced Features (Week 5-6)

1. **Visual Enhancements**

   - Add loading animations and status indicators
   - Implement message grouping and timestamps
   - Add visual indicators for different message types

2. **Input Handling**

   - Implement multi-line input support
   - Add special command auto-completion
   - Handle keyboard shortcuts and navigation

3. **Performance Optimization**
   - Implement message virtualization for long histories
   - Add efficient re-rendering strategies
   - Optimize memory usage

### Phase 4: Polish and Testing (Week 7-8)

1. **Testing**

   - Add comprehensive unit tests for all components
   - Implement integration tests with ink-testing-library
   - Add E2E tests for complete workflows

2. **Error Handling**

   - Implement graceful error recovery
   - Add user-friendly error messages
   - Handle edge cases and terminal resize

3. **Documentation**
   - Create user documentation
   - Add developer guide for component extension
   - Document configuration options

## Testing Strategy

### Unit Testing

```typescript
// Component testing with ink-testing-library
import { render } from 'ink-testing-library';
import { Header } from '../components/Header';

test('Header displays session information', () => {
  const mockSession = {
    startTime: new Date(),
    messages: [{ role: 'user', content: 'test' }],
  };

  const { lastFrame } = render(
    <Header session={mockSession} config={{ provider: 'anthropic' }} />
  );

  expect(lastFrame()).toContain('anthropic');
  expect(lastFrame()).toContain('1 messages');
});
```

### Integration Testing

```typescript
// Full app integration testing
test('App handles user input correctly', async () => {
  const mockSession = createMockSession();
  const mockAgentSession = createMockAgentSession();

  const { stdin, lastFrame } = render(
    <App session={mockSession} agentSession={mockAgentSession} />
  );

  // Simulate user input
  stdin.write('test message\r');

  await waitFor(() => {
    expect(lastFrame()).toContain('test message');
  });
});
```

### E2E Testing

```typescript
// Full workflow testing
test('Complete conversation flow', async () => {
  const cli = spawn('node', ['dist/cli/index.js', '--ink'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Send user input
  cli.stdin.write('Hello AI\n');

  // Wait for AI response
  const output = await waitForOutput(cli.stdout);
  expect(output).toContain('🤖');

  cli.kill();
});
```

## Performance Considerations

### Rendering Optimization

1. **React.memo for Components**

   - Prevent unnecessary re-renders
   - Implement proper prop comparison
   - Use callback memoization

2. **Virtual Scrolling**

   - Handle large message histories efficiently
   - Implement windowing for performance
   - Lazy load message content

3. **Debounced Input**
   - Reduce update frequency during typing
   - Batch state updates
   - Optimize keystroke handling

### Memory Management

1. **Message History Limits**

   - Implement configurable history limits
   - Cleanup old messages automatically
   - Maintain essential context

2. **Component Cleanup**
   - Proper useEffect cleanup
   - Remove event listeners
   - Clear timers and intervals

### Terminal Compatibility

1. **Size Handling**

   - Respond to terminal resize events
   - Implement minimum size requirements
   - Handle different terminal sizes gracefully

2. **Color Support**
   - Detect terminal color capabilities
   - Fallback to monochrome when needed
   - Respect terminal theme preferences

## Risk Assessment

### Technical Risks

**1. Ink Library Limitations**

- **Risk**: Ink may not support all required features
- **Mitigation**: Extensive prototyping and fallback mechanisms
- **Probability**: Medium | **Impact**: High

**2. Performance with Large Histories**

- **Risk**: Poor performance with very long conversations
- **Mitigation**: Virtual scrolling and message limits
- **Probability**: Medium | **Impact**: Medium

**3. Terminal Compatibility**

- **Risk**: Issues with different terminal emulators
- **Mitigation**: Comprehensive testing across terminals
- **Probability**: Low | **Impact**: Medium

### Integration Risks

**1. Breaking Existing Functionality**

- **Risk**: New interface disrupts current workflows
- **Mitigation**: Comprehensive testing and fallback option
- **Probability**: Low | **Impact**: High

**2. Configuration Complexity**

- **Risk**: Too many configuration options confuse users
- **Mitigation**: Sensible defaults and clear documentation
- **Probability**: Medium | **Impact**: Low

### User Experience Risks

**1. Learning Curve**

- **Risk**: Users struggle with new interface
- **Mitigation**: Intuitive design and comprehensive help
- **Probability**: Low | **Impact**: Medium

**2. Accessibility Issues**

- **Risk**: Interface not accessible to all users
- **Mitigation**: Accessibility testing and keyboard navigation
- **Probability**: Medium | **Impact**: Medium

## Conclusion

This design document outlines a comprehensive approach to implementing a modern, React-based terminal interface using Ink. The design prioritizes non-disruptive integration with existing functionality while providing significant improvements to the user experience.

Key benefits of this approach:

- **Familiar Development Model**: React patterns for maintainability
- **Enhanced User Experience**: Rich UI elements and proper formatting
- **Performance Optimized**: Efficient rendering and memory management
- **Backwards Compatible**: Fallback to existing interface ensures reliability
- **Extensible Architecture**: Component-based design enables future enhancements

The implementation plan provides a structured approach to delivery while managing risks through comprehensive testing and gradual feature rollout. The result will be a professional, modern terminal interface that significantly improves the user experience while maintaining the robustness and functionality of the existing system.

## Dependencies

### Required Packages

```json
{
  "dependencies": {
    "ink": "^4.4.1",
    "react": "^18.2.0",
    "@types/react": "^18.2.0"
  },
  "devDependencies": {
    "ink-testing-library": "^3.0.0",
    "@testing-library/react": "^14.0.0"
  }
}
```

### File Structure

```
src/
├── ui/
│   ├── components/
│   │   ├── App.tsx
│   │   ├── WelcomeMessage.tsx
│   │   ├── MessageList.tsx
│   │   ├── InputPrompt.tsx
│   │   └── messages/
│   │       ├── UserMessage.tsx
│   │       ├── AssistantMessage.tsx
│   │       ├── ToolCallMessage.tsx
│   │       └── LoadingIndicator.tsx
│   ├── hooks/
│   │   ├── useMarkdown.ts
│   │   ├── useMessageTransform.ts
│   │   └── useSessionBridge.ts
│   ├── utils/
│   │   ├── messageTransform.ts
│   │   ├── markdownRenderer.ts
│   │   └── formatting.ts
│   ├── SessionBridge.ts
│   └── InkInterface.tsx
└── cli.ts (modified)
```

This design provides a solid foundation for creating a modern, professional terminal interface that will significantly enhance the user experience while maintaining full compatibility with the existing system.
