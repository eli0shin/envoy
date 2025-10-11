import {
  createContext,
  use,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { ModelMessage } from 'ai';
import { runAgent } from '../../agent/index.js';
import type { RuntimeConfiguration } from '../../config/types.js';
import type { AgentSession } from '../../agentSession.js';

type Status = 'READY' | 'PROCESSING';

type ConversationContextValue = {
  messages: (ModelMessage & { id: string })[];
  queuedMessages: (ModelMessage & { id: string })[];
  status: Status;
  abortController: AbortController | null;
  sendMessage: (content: string) => Promise<void>;
  cancelAgent: () => void;
  clearQueue: () => void;
  getUserMessageHistory: (messages: (ModelMessage & { id: string })[]) => string[];
};

const ConversationContext = createContext<ConversationContextValue | null>(
  null
);

type ConversationProviderProps = {
  config: RuntimeConfiguration;
  session: AgentSession;
  children: ReactNode;
};

const generateMessageId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

const getUserMessageHistory = (
  messages: (ModelMessage & { id: string })[]
): string[] => {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : ''));
};

export function ConversationProvider({
  config,
  session,
  children,
}: ConversationProviderProps) {
  const [messages, setMessages] = useState<(ModelMessage & { id: string })[]>(
    []
  );
  const [queuedMessages, setQueuedMessages] = useState<
    (ModelMessage & { id: string })[]
  >([]);
  const [status, setStatus] = useState<Status>('READY');
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const processQueue = useCallback(async () => {
    if (queuedMessages.length === 0) return;

    // Capture queued messages before clearing
    const messagesToProcess = [...queuedMessages];

    // Clear queue first
    setQueuedMessages([]);

    // Add queued messages to current messages
    const allMessages = [...messages, ...messagesToProcess];
    setMessages(allMessages);

    // Create abort controller for this agent execution
    const controller = new AbortController();
    setAbortController(controller);

    // Process entire conversation including newly added messages
    setStatus('PROCESSING');
    try {
      await runAgent(
        allMessages,
        config,
        session,
        true,
        (message) => {
          // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect -- Processing agent messages in stream callback from queue processing
          setMessages((prev) => {
            return [
              ...prev,
              {
                ...message,
                id:
                  'id' in message && typeof message.id === 'string' ?
                    message.id
                  : generateMessageId('agent'),
              },
            ];
          });
        },
        controller.signal
      );
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
        id: generateMessageId('error'),
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

  const sendMessage = useCallback(
    async (content: string) => {
      // Add user message with our own generated id
      const userMessage: ModelMessage & { id: string } = {
        role: 'user',
        content,
        id: generateMessageId('user'),
      };

      if (status === 'PROCESSING') {
        // Agent is busy - add to queue
        setQueuedMessages((prev) => [...prev, userMessage]);
        return;
      }

      // Agent is ready - process immediately
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);

      // Create abort controller for this agent execution
      const controller = new AbortController();
      setAbortController(controller);
      setStatus('PROCESSING');

      try {
        // Process with agent
        await runAgent(
          newMessages,
          config,
          session,
          true,
          (message) => {
            setMessages((prev) => {
              return [
                ...prev,
                {
                  ...message,
                  id:
                    'id' in message && typeof message.id === 'string' ?
                      message.id
                    : generateMessageId('agent'),
                },
              ];
            });
          },
          controller.signal
        );
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
          id: generateMessageId('error'),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setStatus('READY');
        setAbortController(null);
      }
    },
    [status, messages, config, session]
  );

  const cancelAgent = useCallback(() => {
    if (status === 'PROCESSING' && abortController) {
      abortController.abort();
      setStatus('READY');
      setAbortController(null);
    }
  }, [status, abortController]);

  const clearQueue = useCallback(() => {
    setQueuedMessages([]);
  }, []);

  // Cleanup abort controller on component unmount
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  const value: ConversationContextValue = useMemo(
    () => ({
      messages,
      queuedMessages,
      status,
      abortController,
      sendMessage,
      cancelAgent,
      clearQueue,
      getUserMessageHistory,
    }),
    [
      messages,
      queuedMessages,
      status,
      abortController,
      sendMessage,
      cancelAgent,
      clearQueue,
    ]
  );

  return <ConversationContext value={value}>{children}</ConversationContext>;
}

export function useConversation(): ConversationContextValue {
  const context = use(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within ConversationProvider');
  }
  return context;
}
