import { useState, useEffect, useCallback } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { MessageList } from "./MessageList.js";
import { InputArea } from "./InputArea.js";
import { StatusBar } from "./StatusBar.js";
import { Header } from "./Header.js";
import { colors } from "../theme.js";
import { runAgent } from "../../agent/index.js";
import type { CoreMessage } from "ai";
import type { RuntimeConfiguration } from "../../config/types.js";
import type { AgentSession } from "../../agentSession.js";

type TUIAppProps = {
  config: RuntimeConfiguration;
  session: AgentSession;
};

type Status = "READY" | "PROCESSING";

export function TUIApp({ config, session }: TUIAppProps) {
  const [messages, setMessages] = useState<CoreMessage[]>([]);
  const [status, setStatus] = useState<Status>("READY");
  const [resizeKey, setResizeKey] = useState(0);
  const { width, height } = useTerminalDimensions();

  const handleInputResize = useCallback(() => {
    setResizeKey((prev) => prev + 1);
  }, []);

  // Load existing conversation history if available
  useEffect(() => {
    async function loadHistory() {
      if (session.conversationPersistence) {
        const history =
          await session.conversationPersistence.loadConversation();
        if (history) {
          setMessages(history);
        }
      }
    }
    loadHistory();
  }, [session]);

  // Handle keyboard shortcuts - only Ctrl+C exits
  useKeyboard((key) => {
    if (key.name === "c" && key.ctrl) {
      handleExit();
    }
  });

  const handleExit = useCallback(() => {
    process.exit(0);
  }, []);

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
            return [...prev, message];
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
    <box flexDirection="column" width={width} height={height} backgroundColor={colors.backgrounds.main}>
      <Header />
      <MessageList key={resizeKey} messages={messages} width={width} />
      <InputArea onSubmit={handleSendMessage} onResize={handleInputResize} />
      <StatusBar status={status} session={session} />
    </box>
  );
}
