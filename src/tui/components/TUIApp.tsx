import { useState, useEffect, useCallback } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { MessageList } from "./MessageList.js";
import { InputArea } from "./InputArea.js";
import { StatusBar } from "./StatusBar.js";
import { Header } from "./Header.js";
import { colors } from "../theme.js";
import { runAgent } from "../../agent/index.js";
import { commandRegistry } from "../commands/registry.js";
import { setCommandCallbacks } from "../commands/builtins.js";
import "../commands/builtins.js"; // Import to ensure commands are registered
import type { CoreMessage } from "ai";
import type { RuntimeConfiguration } from "../../config/types.js";
import type { AgentSession } from "../../agentSession.js";

type TUIAppProps = {
  config: RuntimeConfiguration;
  session: AgentSession;
};

type Status = "READY" | "PROCESSING";

export function TUIApp({ config, session }: TUIAppProps) {
  const [messages, setMessages] = useState<(CoreMessage & { id: string })[]>(
    [],
  );
  const [status, setStatus] = useState<Status>("READY");
  const [resizeKey, setResizeKey] = useState(0);
  const { width, height } = useTerminalDimensions();

  const handleInputResize = useCallback(() => {
    setResizeKey((prev) => prev + 1);
  }, []);

  const handleExit = useCallback(() => {
    process.exit(0);
  }, []);

  // Load existing conversation history if available and set command callbacks
  useEffect(() => {
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
      onExit: handleExit,
    });
  }, [session, handleExit]);

  // Handle keyboard shortcuts - only Ctrl+C exits
  useKeyboard((key) => {
    if (key.name === "c" && key.ctrl) {
      handleExit();
    }
  });

  const handleCommandExecute = useCallback(
    (commandInput: string, result?: string) => {
      // Add command invocation to message history
      const commandMessage = commandRegistry.formatCommandMessage(commandInput);
      const commandMessageWithId: CoreMessage & { id: string } = {
        ...commandMessage,
        id: `command-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      };
      
      setMessages((prev) => [...prev, commandMessageWithId]);
      
      // Persist the command message if available
      if (session.conversationPersistence) {
        session.conversationPersistence.persistMessages([...messages, commandMessageWithId]);
      }
    },
    [messages, session],
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      // Add user message with our own generated id
      const userMessage: CoreMessage & { id: string } = {
        role: "user",
        content,
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      };
      const newMessages = [...messages, userMessage];

      setMessages((prev) => [...prev, userMessage]);
      setStatus("PROCESSING");

      try {
        // Process with agent
        await runAgent(newMessages, config, session, true, (message) => {
          setMessages((prev) => {
            return [
              ...prev,
              {
                ...message,
                id:
                  "id" in message && typeof message.id === "string"
                    ? message.id
                    : `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              },
            ];
          });
        });
      } catch (error) {
        // Add error message
        const errorMessage: CoreMessage & { id: string } = {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setStatus("READY");
      }
    },
    [messages],
  );

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      backgroundColor={colors.backgrounds.main}
    >
      <Header />
      <MessageList
        key={`${resizeKey}-${messages.length}`}
        messages={messages}
        width={width}
      />
      <InputArea 
        onSubmit={handleSendMessage} 
        onCommandExecute={handleCommandExecute}
        onResize={handleInputResize} 
      />
      <StatusBar status={status} session={session} />
    </box>
  );
}
