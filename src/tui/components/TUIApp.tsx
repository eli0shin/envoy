import { useState, useEffect, useCallback } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { fg } from "@opentui/core";
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
  const [showHelpModal, setShowHelpModal] = useState(false);
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
      onHelp: () => setShowHelpModal(true),
    });
  }, [session, handleExit]);

  // Handle keyboard shortcuts - Ctrl+C exits, ESC closes modal
  useKeyboard((key) => {
    if (key.name === "c" && key.ctrl) {
      handleExit();
    }
    if (key.name === "escape" && showHelpModal) {
      setShowHelpModal(false);
    }
  });

  const handleCommandExecute = useCallback(
    (commandInput: string) => {
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
      position="relative"
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
        disabled={showHelpModal}
      />
      <StatusBar status={status} session={session} />
      
      {/* Help Modal */}
      {showHelpModal && (() => {
        const commands = commandRegistry.getAll();
        
        // Calculate modal height: commands + header (1) + footer (2: text + spacer) + min scrollbox space
        // Ensure scrollbox has at least 5 lines visible, max total height of 20
        const minScrollboxHeight = 5;
        const headerFooterHeight = 3; // 1 for header, 2 for footer (spacer + text)
        const modalHeight = Math.min(
          20, 
          Math.max(
            minScrollboxHeight + headerFooterHeight,
            commands.length + headerFooterHeight
          )
        );
        
        // Calculate the longest command line (includes "  /" + name + " - " + description)
        const longestLine = Math.max(
          "Available Commands:".length,
          "Press ESC to close".length,
          ...commands.map(cmd => `  /${cmd.name} - ${cmd.description}`.length)
        );
        
        // Modal width needs to account for:
        // - Border (2 chars)
        // - Scrollbar (1 char) 
        // - ScrollBox padding (2 chars)
        // - Extra margin (5 chars)
        // Total: 10 extra chars
        const modalWidth = Math.min(
          longestLine + 10,
          Math.floor(width * 0.9)
        );
        
        return (
          <box
            position="absolute"
            top={Math.floor(height / 2) - Math.floor(modalHeight / 2)}
            left={Math.floor(width / 2) - Math.floor(modalWidth / 2)}
            width={modalWidth}
            height={modalHeight}
            zIndex={1000}
            borderStyle="single"
            borderColor={colors.primary}
            backgroundColor={colors.backgrounds.main}
            flexDirection="column"
          >
            <box height={1} paddingLeft={1}>
              <text>{fg(colors.primary)("Available Commands:")}</text>
            </box>
            
            <scrollbox
              focused={true}
              style={{
                rootOptions: {
                  flexGrow: 1,
                  paddingLeft: 1,
                  paddingRight: 1,
                },
                contentOptions: {
                  flexDirection: "column",
                },
                scrollbarOptions: {
                  showArrows: false,
                },
              }}
            >
              {commands.map((cmd, index) => (
                <box key={index} height={1}>
                  <text>  {fg(colors.accent)(`/${cmd.name}`)} - {cmd.description}</text>
                </box>
              ))}
            </scrollbox>
            
            <box height={1}>
              <text> </text>
            </box>
            <box height={1} paddingLeft={1}>
              <text>{fg(colors.muted)("Press ESC to close")}</text>
            </box>
          </box>
        );
      })()}
    </box>
  );
}
