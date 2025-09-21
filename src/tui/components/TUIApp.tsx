import { useState, useEffect, useCallback } from 'react';
import { useTerminalDimensions, useRenderer } from '@opentui/react';
import { MessageList } from './MessageList.js';
import { InputArea } from './InputArea.js';
import { StatusBar } from './StatusBar.js';
import { Header } from './Header.js';
import { ModalProvider } from './ModalProvider.js';
import { ModalDisplay } from './ModalDisplay.js';
import { colors } from '../theme.js';
import { runAgent } from '../../agent/index.js';
import { commandRegistry } from '../commands/registry.js';
import { setCommandCallbacks } from '../commands/builtins.js';
import '../commands/builtins.js'; // Import to ensure commands are registered
import { KeyDispatcher } from '../keys/dispatcher.js';
import { useKeys, parseKeys } from '../keys/index.js';
import { keybindingsRegistry } from '../keys/index.js';
import { defaultKeybindings, mergeKeybindings } from '../keys/index.js';
import type { KeybindingsConfig } from '../keys/index.js';
import type { TUIKeybindings } from '../../config/types.js';
import { KeysProvider } from '../keys/prefixContext.js';
import { setKeySettings } from '../keys/settings.js';
import type { ModelMessage } from 'ai';
import type { RuntimeConfiguration } from '../../config/types.js';
import type { AgentSession } from '../../agentSession.js';
import { ProcessManager } from '../../mcp/processManager.js';

type TUIAppProps = {
  config: RuntimeConfiguration;
  session: AgentSession;
};

type Status = 'READY' | 'PROCESSING';
type ModalType = 'help' | null;

type ExitConfirmationState = {
  active: boolean;
  timeoutId: NodeJS.Timeout;
};

export function TUIApp({ config, session }: TUIAppProps) {
  const [messages, setMessages] = useState<(ModelMessage & { id: string })[]>(
    []
  );
  const [queuedMessages, setQueuedMessages] = useState<
    (ModelMessage & { id: string })[]
  >([]);
  const [status, setStatus] = useState<Status>('READY');
  const [resizeKey, setResizeKey] = useState(0);
  const [modalState, setModalState] = useState<ModalType>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [originalInput, setOriginalInput] = useState('');
  const [exitConfirmation, setExitConfirmation] =
    useState<ExitConfirmationState | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const { width, height } = useTerminalDimensions();
  const renderer = useRenderer();

  const getUserMessageHistory = useCallback(
    (messages: (ModelMessage & { id: string })[]): string[] => {
      return messages
        .filter((message) => message.role === 'user')
        .map((message) => {
          let content =
            typeof message.content === 'string' ? message.content : '';

          // Apply same parsing as Message.tsx
          content = content.replace(
            /<user-command>(.*?)<\/user-command>/gs,
            '$1'
          );
          content = content.replace(/<system-hint>.*?<\/system-hint>/gs, '');

          return content.trim();
        })
        .filter((content) => content.length > 0);
    },
    []
  );

  const handleInputResize = useCallback(() => {
    setResizeKey((prev) => prev + 1);
  }, []);

  const handleExit = useCallback(() => {
    // Clean up MCP server processes before exiting
    const processManager = ProcessManager.getInstance();
    processManager.cleanupAll();

    renderer.destroy();
    // Move cursor to bottom left of terminal
    process.stdout.write('\x1b[999B\x1b[1G');
    process.exit(0);
  }, [renderer]);

  const handleAgentCancel = useCallback(() => {
    if (status === 'PROCESSING' && abortController) {
      abortController.abort();
      setStatus('READY');
      setAbortController(null);
      
      // Add cancellation message
      const cancelMessage: ModelMessage & { id: string } = {
        role: 'assistant',
        content: 'Operation cancelled by user.',
        id: `cancel-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      };
      setMessages((prev) => [...prev, cancelMessage]);
    }
  }, [status, abortController]);

  const handleExitAttempt = useCallback(() => {
    if (exitConfirmation) {
      // Second C-c within 3 seconds - exit immediately
      clearTimeout(exitConfirmation.timeoutId);
      handleExit();
    } else {
      // First C-c - start confirmation timer
      const timeoutId = setTimeout(() => {
        setExitConfirmation(null);
      }, 3000);
      setExitConfirmation({ active: true, timeoutId });
    }
  }, [exitConfirmation, handleExit]);

  // Remove all SIGINT handlers after TUI mounts to prevent immediate exit on C-c
  useEffect(() => {
    // Remove all SIGINT listeners to allow our double-press logic to work
    // This removes both our handler and OpenTUI's singleton handler
    process.removeAllListeners('SIGINT');
  }, []);

  // Load existing conversation history if available and set command callbacks
  useEffect(() => {
    // Initialize keybindings registry (defaults + user overrides)
    const overrides: TUIKeybindings | undefined = config.keybindings;
    const scopedOverrides: KeybindingsConfig = {
      global: overrides?.global,
      modal: overrides?.modal,
      autocomplete: overrides?.autocomplete,
      input: overrides?.input,
      messages: overrides?.messages,
    };
    keybindingsRegistry.set(
      mergeKeybindings(defaultKeybindings, scopedOverrides)
    );
    // Initialize prefix settings (always compile defaults, then apply overrides)
    setKeySettings({
      prefixes: overrides?.prefixes ?? { leader: 'C-e' },
      prefixCancel: overrides?.prefixCancel ?? 'escape',
    });

    async function loadHistory() {
      if (session.conversationPersistence) {
        const history =
          await session.conversationPersistence.loadConversation();
        if (history) {
          const messagesWithIds = history.map((msg, index) => ({
            ...msg,
            id: `loaded-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 11)}`,
          }));
          setMessages(messagesWithIds);
        }
      }
    }
    loadHistory();

    // Set callbacks for built-in commands (commands are already registered)
    setCommandCallbacks({
      onClear: () => {
        setMessages([]);
        // Clear persisted conversation if available
        if (session.conversationPersistence) {
          session.conversationPersistence.persistMessages([]);
        }
      },
      onExit: handleExitAttempt,
      onHelp: () => setModalState('help'),
    });
  }, [
    session,
    handleExit,
    handleExitAttempt,
    setModalState,
    config.keybindings,
  ]);

  const handleCommandExecute = useCallback(
    (commandInput: string) => {
      // Add command invocation to message history
      const commandMessage = commandRegistry.formatCommandMessage(commandInput);
      const commandMessageWithId: ModelMessage & { id: string } = {
        ...commandMessage,
        id: `command-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      };

      setMessages((prev) => [...prev, commandMessageWithId]);

      // Persist the command message if available
      if (session.conversationPersistence) {
        session.conversationPersistence.persistMessages([
          ...messages,
          commandMessageWithId,
        ]);
      }
    },
    [messages, session]
  );

  const handleQueuePop = useCallback(() => {
    if (queuedMessages.length === 0) return null;

    const lastQueued = queuedMessages[queuedMessages.length - 1];
    setQueuedMessages((prev) => prev.slice(0, -1));

    // Extract string content from message
    if (typeof lastQueued.content === 'string') {
      return lastQueued.content;
    }

    // If content is an array, extract text parts
    if (Array.isArray(lastQueued.content)) {
      const textParts: string[] = [];
      for (const part of lastQueued.content) {
        if (part?.type === 'text' && 'text' in part) {
          textParts.push(part.text);
        }
      }
      return textParts.join('\n');
    }

    return null;
  }, [queuedMessages]);

  const processQueue = useCallback(async () => {
    if (queuedMessages.length === 0) return;

    // Calculate the full conversation before any state updates
    const allMessages = [...messages, ...queuedMessages];

    // Move all queued messages to main conversation
    setMessages((prev) => [...prev, ...queuedMessages]);
    setQueuedMessages([]);

    // Create abort controller for this agent execution
    const controller = new AbortController();
    setAbortController(controller);

    // Process entire conversation including newly added messages
    setStatus('PROCESSING');
    try {
      await runAgent(allMessages, config, session, true, (message) => {
        setMessages((prev) => {
          return [
            ...prev,
            {
              ...message,
              id:
                'id' in message && typeof message.id === 'string' ?
                  message.id
                : `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            },
          ];
        });
      }, controller.signal);
    } catch (error) {
      // Handle abort error differently from other errors
      if (error instanceof Error && error.name === 'AbortError') {
        // Don't add error message for user-initiated cancellation
        return;
      }
      
      // Add error message for other errors
      const errorMessage: ModelMessage & { id: string } = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setStatus('READY');
      setAbortController(null);
    }
  }, [queuedMessages, messages, config, session]);

  // Process queue when agent becomes ready
  useEffect(() => {
    if (status === 'READY' && queuedMessages.length > 0) {
      processQueue();
    }
  }, [status, processQueue, queuedMessages.length]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      // Reset history navigation state
      setHistoryIndex(-1);
      setOriginalInput('');

      // Add user message with our own generated id
      const userMessage: ModelMessage & { id: string } = {
        role: 'user',
        content,
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      };

      if (status === 'PROCESSING') {
        // Agent is busy - add to queue
        setQueuedMessages((prev) => [...prev, userMessage]);
        return;
      }

      // Agent is ready - process immediately
      const newMessages = [...messages, userMessage];
      setMessages((prev) => [...prev, userMessage]);
      
      // Create abort controller for this agent execution
      const controller = new AbortController();
      setAbortController(controller);
      setStatus('PROCESSING');

      try {
        // Process with agent
        await runAgent(newMessages, config, session, true, (message) => {
          setMessages((prev) => {
            return [
              ...prev,
              {
                ...message,
                id:
                  'id' in message && typeof message.id === 'string' ?
                    message.id
                  : `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              },
            ];
          });
        }, controller.signal);
      } catch (error) {
        // Handle abort error differently from other errors
        if (error instanceof Error && error.name === 'AbortError') {
          // Don't add error message for user-initiated cancellation
          return;
        }
        
        // Add error message for other errors
        const errorMessage: ModelMessage & { id: string } = {
          role: 'assistant',
          content: `${error instanceof Error ? error.message : String(error)}`,
          id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setStatus('READY');
        setAbortController(null);
      }
    },
    [messages, status, config, session]
  );

  // Cleanup timeout and abort controller on component unmount
  useEffect(() => {
    return () => {
      if (exitConfirmation) {
        clearTimeout(exitConfirmation.timeoutId);
      }
      if (abortController) {
        abortController.abort();
      }
    };
  }, [exitConfirmation, abortController]);

  // Global key actions
  useKeys(
    (key) => {
      return (
        parseKeys(key, 'app.exit', handleExitAttempt, 'global') ||
        parseKeys(
          key,
          'help.toggle',
          () => setModalState((m) => (m === 'help' ? null : 'help')),
          'global'
        ) ||
        // Handle ESC key - cancel agent if processing, otherwise consume
        parseKeys(key, 'global.cancel', handleAgentCancel, 'global')
      );
    },
    { scope: 'global', enabled: true }
  );

  return (
    <KeysProvider>
      <ModalProvider modalState={modalState} setModalState={setModalState}>
        <KeyDispatcher />
        <box
          position="relative"
          flexDirection="column"
          width={width}
          height={height}
          backgroundColor={colors.backgrounds.main}
        >
          <Header />
          <MessageList
            key={`${resizeKey}-${messages.length}-${queuedMessages.length}`}
            messages={messages}
            queuedMessages={queuedMessages}
            width={width}
          />
          <InputArea
            onSubmit={handleSendMessage}
            onCommandExecute={handleCommandExecute}
            onResize={handleInputResize}
            userHistory={getUserMessageHistory(messages)}
            historyIndex={historyIndex}
            setHistoryIndex={setHistoryIndex}
            originalInput={originalInput}
            setOriginalInput={setOriginalInput}
            queuedMessages={queuedMessages}
            onQueuePop={handleQueuePop}
          />
          <StatusBar
            status={status}
            session={session}
            exitConfirmation={!!exitConfirmation}
            queuedMessages={queuedMessages}
          />
          <ModalDisplay />
        </box>
      </ModalProvider>
    </KeysProvider>
  );
}
