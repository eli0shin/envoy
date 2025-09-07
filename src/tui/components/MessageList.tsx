import { useRef, useEffect } from "react";
import { Message } from "./Message.js";
import type { CoreMessage } from "ai";
import type { ScrollBoxRenderable } from "@opentui/core";

type MessageListProps = {
  messages: (CoreMessage & { id: string })[];
  width: number;
  key: string;
};

export function MessageList({ messages, width }: MessageListProps) {
  const scrollBoxRef = useRef<ScrollBoxRenderable>(null);

  const scrollToBottom = () => {
    if (scrollBoxRef.current) {
      const maxScrollTop =
        scrollBoxRef.current.scrollHeight -
        scrollBoxRef.current.viewport.height;
      scrollBoxRef.current.scrollTop = Math.max(0, maxScrollTop);
    }
  };

  useEffect(() => {
    setImmediate(() => {
      scrollToBottom();
    });
  }, [messages]);
  const renderMessage = (
    message: CoreMessage & { id: string },
    _index: number,
  ) => {
    // Handle content based on type - can be string or array of parts
    if (typeof message.content === "string") {
      return <Message message={message} width={width} key={message.id} />;
    }

    // Content is an array of parts - render each part separately
    const parts = [];
    for (let partIndex = 0; partIndex < message.content.length; partIndex++) {
      const part = message.content[partIndex];

      // Extract displayable content from different part types
      let displayContent = "";
      let contentType: "normal" | "reasoning" | "tool" = "normal";

      if (part?.type === "text" && "text" in part) {
        displayContent = part.text;
      } else if (part?.type === "reasoning" && "text" in part) {
        displayContent = part.text;
        contentType = "reasoning";
      } else if (part?.type === "redacted-reasoning") {
        displayContent = "[Reasoning redacted]";
        contentType = "reasoning";
      } else if (part?.type === "tool-call" && "toolName" in part) {
        displayContent = `🔧 Calling ${part.toolName}`;
        contentType = "tool";
      } else if (part?.type === "tool-result" && "toolName" in part) {
        displayContent = `✅ ${part.toolName} result`;
        contentType = "tool";
      }

      if (displayContent) {
        const partMessage: CoreMessage = {
          role: "assistant",
          content: displayContent,
        };

        parts.push(
          <Message
            key={`${message.id}-part-${partIndex}`}
            message={partMessage}
            contentType={contentType}
            width={width}
          />,
        );
      }
    }

    return parts;
  };

  return (
    <scrollbox
      ref={scrollBoxRef}
      style={{
        rootOptions: {
          flexGrow: 1,
        },
        contentOptions: {
          flexDirection: "column",
          padding: 1,
        },
        scrollbarOptions: {
          showArrows: false,
        },
      }}
    >
      {messages.map((message, index) => (
        <box key={message.id}>{renderMessage(message, index)}</box>
      ))}
    </scrollbox>
  );
}
