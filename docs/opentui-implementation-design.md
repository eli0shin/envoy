# OpenTUI Implementation Design for Language Learner CLI

## Executive Summary

This document outlines the design and implementation plan for adding a Terminal User Interface (TUI) to the Language Learner CLI using OpenTUI with React integration. The TUI will activate when the CLI is run without arguments, providing an interactive conversational interface with message history and input capabilities.

## Requirements

### Functional Requirements

1. **TUI Activation**: The TUI shall launch when the CLI is run without any prompt arguments
2. **Message Display**: Show conversation messages in a scrollable view
3. **User Input**: Provide an input box at the bottom for user messages
4. **Real-time Updates**: Display assistant responses as they stream in
5. **Session Management**: Load and continue existing conversation sessions
6. **Keyboard Navigation**: Support keyboard shortcuts for common actions
7. **Exit Mechanism**: Provide clear exit options (Ctrl+C, Esc, /exit command)

### Non-Functional Requirements

1. **Performance**: Smooth scrolling and rendering with minimal lag
2. **Compatibility**: Work across macOS, Linux, and Windows terminals
3. **Accessibility**: Clear visual hierarchy and keyboard-only navigation
4. **Responsiveness**: Adapt to terminal resize events
5. **Integration**: Seamlessly integrate with existing CLI architecture

## Architecture Overview

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    App Component                         │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │              Header Component                     │  │
│  │  - Title: "Language Learner"                    │  │
│  │  - Session ID display                           │  │
│  │  - Status indicators                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          MessageList Component                    │  │
│  │  - Scrollable message history                    │  │
│  │  - User messages (right aligned)                 │  │
│  │  - Assistant messages (left aligned)             │  │
│  │  - Tool calls display                            │  │
│  │  - Thinking indicators                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          InputArea Component                      │  │
│  │  - Multi-line input support                      │  │
│  │  - Submit button / Enter to send                 │  │
│  │  - Input validation                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          StatusBar Component                      │  │
│  │  - Connection status                              │  │
│  │  - Keyboard shortcuts help                       │  │
│  │  - Progress indicators                           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Integration Architecture

```
CLI Entry Point (src/cli/index.ts)
    ↓
executionFlow.main()
    ↓
Check for interactive mode conditions
    ↓
If no message and no special flags
    ↓
Launch OpenTUI Interface (src/tui/index.tsx)
    ↓
Initialize React with OpenTUI renderer
    ↓
Connect to existing AgentSession
    ↓
Render TUI and handle user interactions
```

## Technical Implementation Guide

### Phase 1: Project Setup and Dependencies

#### 1.1 Add OpenTUI Dependencies

```json
{
  "dependencies": {
    "@opentui/core": "^0.1.13",
    "@opentui/react": "^0.1.13",
    "bun": "latest"
  }
}
```

#### 1.2 Update TypeScript Configuration

Update the existing `tsconfig.json` to support OpenTUI React JSX:

````json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@opentui/react"
    // ... other existing options
  }
}

### Phase 2: Core TUI Components

#### 2.1 Main TUI Entry Point (`src/tui/index.tsx`)

```typescript
import { render } from '@opentui/react';
import { TUIApp } from './components/TUIApp';
import type { AgentSession } from '../agentSession';
import type { RuntimeConfiguration } from '../config/types';

export async function launchTUI(
  config: RuntimeConfiguration,
  agentSession: AgentSession
): Promise<void> {
  // Initialize TUI with existing session
  await render(
    <TUIApp
      config={config}
      session={agentSession}
    />
  );
}
````

#### 2.2 Main App Component (`src/tui/components/TUIApp.tsx`)

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { StatusBar } from './StatusBar';
import { Header } from './Header';
import type { CoreMessage } from 'ai';

type TUIAppProps = {
  config: RuntimeConfiguration;
  session: AgentSession;
};

type Status = 'READY' | 'PROCESSING';

export function TUIApp({ config, session }: TUIAppProps) {
  const [messages, setMessages] = useState<CoreMessage[]>([]);
  const [status, setStatus] = useState<Status>('READY');
  const { width, height } = useTerminalDimensions();

  // Load existing conversation history if available
  useEffect(() => {
    async function loadHistory() {
      if (session.conversationPersistence) {
        const history = await session.conversationPersistence.loadConversation();
        if (history) {
          setMessages(history);
        }
      }
    }
    loadHistory();
  }, [session]);

  // Handle keyboard shortcuts - only Ctrl+C exits
  useKeyboard((key, event) => {
    if (key === 'c' && event.ctrlKey) {
      handleExit();
    }
  });

  const handleSendMessage = async (content: string) => {
    // Add user message with our own generated id
    const userMessage: CoreMessage & { id: string } = {
      role: 'user',
      content,
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    setMessages(prev => [...prev, userMessage]);
    setStatus('PROCESSING');

    // Process with agent
    const response = await runAgent(content, config, session);

    // Add assistant response
    setMessages(prev => [...prev, response]);
    setStatus('READY');
  };

  return (
    <box flexDirection="column" width={width} height={height}>
      <Header sessionId={session.conversationPersistence?.sessionId} />
      <MessageList
        messages={messages}
        height={height - 10} // Reserve space for header, input, status
      />
      <InputArea
        onSubmit={handleSendMessage}
      />
      <StatusBar
        status={status}
      />
    </box>
  );
}
```

#### 2.3 Message List Component (`src/tui/components/MessageList.tsx`)

```typescript
import React, { useRef, useEffect } from 'react';
import { Message } from './Message';
import type { CoreMessage } from 'ai';

type MessageListProps = {
  messages: CoreMessage[];
  height: number;
};

export function MessageList({ messages, height }: MessageListProps) {
  // Render all messages - OpenTUI's scrollable box handles scrolling
  // Note: response.messages from generateText are ResponseMessage type (CoreMessage + id)
  return (
    <box
      flexDirection="column"
      flexGrow={1}
      padding={1}
      borderStyle="single"
      scrollable={true}
    >
      {messages.map((message) => {
        // ResponseMessage has id for assistant/tool messages
        // User messages might not have id, use fallback
        const messageId = (message as any).id || `${message.role}-${messages.indexOf(message)}`;

        // Handle content based on type - can be string or array of parts
        if (typeof message.content === 'string') {
          return (
            <Message
              key={messageId}
              message={message}
            />
          );
        }

        // Content is an array of parts - render each part separately
        return message.content.map((part, partIndex) => {
          // Extract displayable content from different part types
          let displayContent = '';
          let contentType = 'normal';

          if (part.type === 'text') {
            displayContent = part.text;
          } else if (part.type === 'reasoning') {
            displayContent = part.text;
            contentType = 'reasoning';
          } else if (part.type === 'redacted-reasoning') {
            displayContent = '[Reasoning redacted]';
            contentType = 'reasoning';
          } else if (part.type === 'tool-call') {
            displayContent = `🔧 Calling ${part.toolName}`;
            contentType = 'tool';
          } else if (part.type === 'tool-result') {
            displayContent = `✅ ${part.toolName} result`;
            contentType = 'tool';
          }

          if (!displayContent) return null;

          return (
            <Message
              key={`${messageId}-${partIndex}`}
              message={{
                ...message,
                content: displayContent
              }}
              contentType={contentType}
            />
          );
        });
      })}
    </box>
  );
}
```

#### 2.4 Input Area Component (`src/tui/components/InputArea.tsx`)

```typescript
import React, { useState } from 'react';
import { TextAttributes } from '@opentui/core';

type InputAreaProps = {
  onSubmit: (message: string) => void;
};

export function InputArea({ onSubmit }: InputAreaProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(true);

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSubmit(trimmedValue);
      setValue('');
    }
  };

  return (
    <box
      height={3}
      padding={0.5}
      borderStyle="single"
    >
      <input
        placeholder="Type your message..."
        value={value}
        focused={focused}
        onInput={setValue}
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          backgroundColor: focused ? '#333333' : '#222222'
        }}
      />
    </box>
  );
}
```

### Phase 3: CLI Integration

#### 3.1 Modify executionFlow.ts

```typescript
import { launchTUI } from '../tui/index.js';

export async function main(): Promise<void> {
  // ... existing code ...

  // Check for interactive TUI mode
  const shouldLaunchTUI =
    !message &&
    !options.stdin &&
    !hasPromptResourceCommands &&
    !options.resources &&
    !options.autoResources;

  if (shouldLaunchTUI) {
    // Initialize agent session first
    const agentSession = await initializeAgentSession(
      configResult.config,
      false
    );

    // Launch TUI interface
    await launchTUI(configResult.config, agentSession);

    // TUI handles its own exit
    return;
  }

  // ... continue with existing CLI flow ...
}
```

### Phase 4: Advanced Features

#### 4.1 Message Rendering with Markdown

```typescript
import { fg, bold, t } from '@opentui/core';
import { parseMarkdown } from '../utils/markdown';

type MessageProps = {
  message: CoreMessage;
  contentType?: 'normal' | 'reasoning' | 'tool';
};

export function Message({ message, contentType = 'normal' }: MessageProps) {
  const isUser = message.role === 'user';

  // Style based on content type
  const getContentColor = () => {
    if (isUser) return 'cyan';
    if (contentType === 'reasoning') return 'yellow';
    if (contentType === 'tool') return 'magenta';
    return 'green';
  };

  const getPrefix = () => {
    if (isUser) return 'You';
    if (contentType === 'reasoning') return 'Assistant (thinking)';
    if (contentType === 'tool') return 'Tool';
    return 'Assistant';
  };

  return (
    <box
      marginBottom={1}
      padding={0.5}
      backgroundColor={isUser ? '#1a1a2e' : '#0f0f0f'}
      borderStyle="round"
    >
      <text>
        {bold(fg(getContentColor())(getPrefix()))}: {parseMarkdown(message.content)}
      </text>
    </box>
  );
}
```

#### 4.2 Tool Call Display

```typescript
export function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  return (
    <box
      borderStyle="single"
      borderColor="#666666"
      padding={0.5}
      marginVertical={0.5}
    >
      <text attributes={TextAttributes.DIM}>
        🔧 {toolCall.toolName}: {toolCall.args}
      </text>
    </box>
  );
}
```

## Testing Strategy

### Unit Tests

- Component rendering tests
- Input validation tests
- Message parsing tests
- Scroll logic tests

### Integration Tests

- TUI launch conditions
- Session loading
- Message persistence
- Agent communication

### E2E Tests

- Full conversation flow
- Keyboard navigation
- Error recovery
- Exit mechanisms

### Manual Testing Checklist

- [ ] TUI launches when no arguments provided
- [ ] Messages display correctly
- [ ] Scrolling works smoothly
- [ ] Input accepts text and submits
- [ ] Keyboard shortcuts work
- [ ] Terminal resize handled
- [ ] Exit cleanly with Ctrl+C
- [ ] Sessions persist correctly

## Conclusion

This design provides a comprehensive plan for implementing a modern TUI for the Language Learner CLI using OpenTUI. The phased approach allows for iterative development while maintaining the existing CLI functionality. The architecture is designed to be maintainable, performant, and extensible for future enhancements.

## Appendix A: Key Dependencies

- `@opentui/core`: Core rendering engine
- `@opentui/react`: React bindings
- `bun`: Runtime and build tool
- `react`: UI framework
- `ai`: Vercel AI SDK for agent integration

## Appendix B: File Structure

```
src/
├── cli/
│   └── handlers/
│       └── executionFlow.ts (modified)
├── tui/
│   ├── index.tsx
│   ├── components/
│   │   ├── TUIApp.tsx
│   │   ├── Header.tsx
│   │   ├── MessageList.tsx
│   │   ├── Message.tsx
│   │   ├── InputArea.tsx
│   │   ├── StatusBar.tsx
│   │   └── ToolCallDisplay.tsx
│   └── utils/
│       ├── markdown.ts
│       └── formatting.ts
```

## Appendix C: Example Usage

```bash
# Launch TUI mode
$ language-learner

# Traditional CLI mode (unchanged)
$ language-learner "What is the weather?"

# With stdin (unchanged)
$ echo "Hello" | language-learner --stdin
```
