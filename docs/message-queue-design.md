# Message Queue Design

## Problem Statement

Currently, when the agent is processing and a user submits another prompt, `runAgent` is called in parallel, causing both agent processes to add messages concurrently to the same messages array. This creates race conditions and incorrect conversation flow.

## Solution: Message Queue System

### Core Architecture

#### State Management (TUIApp.tsx)

```typescript
const [messages, setMessages] = useState<(CoreMessage & { id: string })[]>([]);
const [queuedMessages, setQueuedMessages] = useState<(CoreMessage & { id: string })[]>([]);
const [status, setStatus] = useState<Status>('READY');
```

Two separate arrays:
- `messages`: The actual conversation history in correct chronological order
- `queuedMessages`: User messages waiting to be processed when agent is busy

### Visual Design

#### MessageList Rendering

```tsx
// MessageList.tsx
type MessageListProps = {
  messages: (CoreMessage & { id: string })[];
  queuedMessages: (CoreMessage & { id: string })[];
  width: number;
};

export function MessageList({ messages, queuedMessages, width }: MessageListProps) {
  return (
    <>
      {/* Render actual conversation */}
      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          width={width}
        />
      ))}

      {/* Visual separator if there are queued messages */}
      {queuedMessages.length > 0 && (
        <box height={1}>
          <text color={colors.text.muted}>─── Queued Messages ───</text>
        </box>
      )}

      {/* Render queued messages with different styling */}
      {queuedMessages.map((message) => (
        <Message
          key={message.id}
          message={message}
          width={width}
          isQueued={true}
        />
      ))}
    </>
  );
}
```

#### Message Component Styling

```tsx
// Message.tsx
type MessageProps = {
  message: CoreMessage & { id: string };
  width: number;
  isQueued?: boolean;
};

function Message({ message, width, isQueued = false }: MessageProps) {
  // Queued messages have gray prefix instead of blue
  const prefix = isQueued ?
    <text color={colors.text.muted}>{'>'}</text> :
    <text color={colors.primary.main}>{'>'}</text>;

  // Dimmed text for queued messages
  const textOpacity = isQueued ? 0.6 : 1;
  // Rest of rendering logic...
}
```

### Behavior Implementation

#### Message Submission Logic

```typescript
const handleSendMessage = async (content: string) => {
  const userMessage: CoreMessage & { id: string } = {
    role: 'user',
    content,
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
  };

  if (status === 'PROCESSING') {
    // Agent is busy - add to queue
    setQueuedMessages(prev => [...prev, userMessage]);
    // Clear input, show visual feedback
    return;
  }

  // Agent is ready - process immediately
  setMessages(prev => [...prev, userMessage]);
  setStatus('PROCESSING');

  try {
    await runAgent([...messages, userMessage], config, session, true, (message) => {
      setMessages(prev => [...prev, { ...message, id: generateId() }]);
    });
  } finally {
    setStatus('READY');
    await processQueue();
  }
};
```

#### Queue Processing

```typescript
const processQueue = async () => {
  if (queuedMessages.length === 0) return;

  // Move all queued messages to main conversation
  const allQueued = [...queuedMessages];
  setMessages(prev => [...prev, ...allQueued]);
  setQueuedMessages([]);

  // Process entire conversation including newly added messages
  setStatus('PROCESSING');
  try {
    const allMessages = [...messages, ...allQueued];
    await runAgent(
      allMessages,
      config,
      session,
      true,
      (message) => {
        setMessages(prev => [...prev, { ...message, id: generateId() }]);
      }
    );
  } finally {
    setStatus('READY');
    // Recursively process any messages that were queued during processing
    await processQueue();
  }
};
```

#### Up Arrow Queue Interaction

When the user presses the up arrow on the first line of input and there are queued messages, the most recent queued message is pulled back into the input field for editing:

```typescript
const handleInputArrowKey = (direction, isOnFirstLine) => {
  if (direction === 'up' && isOnFirstLine && queuedMessages.length > 0) {
    // Pop the most recent queued message
    const lastQueued = queuedMessages[queuedMessages.length - 1];

    // Remove from queue
    setQueuedMessages(prev => prev.slice(0, -1));

    // Populate input field
    setValue(lastQueued.content);
    return true;
  }

  // Otherwise, use normal history navigation
  // ... existing history code
};
```

### Status Bar Enhancement

```typescript
function StatusBar({ status, session, exitConfirmation }) {
  const queuedCount = queuedMessages.length;

  if (status === 'PROCESSING' && queuedCount > 0) {
    return `Processing... (${queuedCount} message${queuedCount > 1 ? 's' : ''} queued)`;
  }
  // ... rest of status display
}
```

## Key Design Decisions

1. **Visual Integration**: Queued messages appear in the message list with special styling (gray `>` prefix) rather than in a separate UI component.

2. **Batch Processing**: All queued messages are sent as a single conversation continuation in one `runAgent` call, maintaining context.

3. **No Persistence**: Queue clears on exit - queued messages are transient and not persisted to disk.

4. **Unlimited Queue**: No artificial limits on queue size.

5. **Clean Separation**: Messages remain pure data - no special "queued" property. The queue state is determined by which array contains the message.

## User Experience Flow

1. User submits message while agent is idle → Message processes immediately
2. User submits message while agent is busy → Message appears at bottom with gray `>` and dimmed text
3. Multiple queued messages stack visually below the conversation
4. Agent completes → All queued messages move to conversation and process together
5. Up arrow on first line with queued messages → Pull most recent queued message back to edit

## Benefits

- **No Race Conditions**: Only one agent process runs at a time
- **Clear Visual Feedback**: Users see queued messages immediately
- **Natural Interaction**: Up arrow to edit queued messages feels intuitive
- **Maintains Context**: All messages process as continuous conversation
- **Simple State Management**: Two arrays with clear, distinct purposes