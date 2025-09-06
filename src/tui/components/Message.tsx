import { bold, fg } from "@opentui/core";
import { parseMarkdown } from "../utils/markdown.js";
import type { CoreMessage } from "ai";

type MessageProps = {
  message: CoreMessage;
  contentType?: "normal" | "reasoning" | "tool";
  width: number;
};

export function Message({ message, contentType = "normal", width }: MessageProps) {
  const isUser = message.role === "user";

  // Style based on content type
  const getContentColor = () => {
    if (isUser) return "cyan";
    if (contentType === "reasoning") return "yellow";
    if (contentType === "tool") return "magenta";
    return "green";
  };

  const getPrefix = () => {
    if (isUser) return "You";
    if (contentType === "reasoning") return "Assistant (thinking)";
    if (contentType === "tool") return "Tool";
    return "Assistant";
  };

  const getBackgroundColor = () => {
    return isUser ? "#1a1a2e" : "#0f0f0f";
  };

  const displayContent =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);

  // Calculate available width for text (terminal width minus scrollbox, padding, and margins)
  const textWidth = width - 6; // 6 = scrollbox (2) + padding (2) + margin/border space (2)

  // Helper function to wrap text manually by inserting newlines
  const wrapText = (text: string, maxWidth: number): string => {
    const prefix = `${getPrefix()}: `;
    const prefixLength = prefix.length;
    const availableWidth = maxWidth - prefixLength;
    
    if (availableWidth <= 0) return text;
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length <= availableWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is longer than available width, break it
          let remainingWord = word;
          while (remainingWord.length > availableWidth) {
            lines.push(remainingWord.substring(0, availableWidth));
            remainingWord = remainingWord.substring(availableWidth);
          }
          if (remainingWord) {
            currentLine = remainingWord;
          }
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.join('\n');
  };

  const wrappedContent = wrapText(displayContent, textWidth);

  return (
    <box 
      marginBottom={1} 
      padding={1} 
      backgroundColor={getBackgroundColor()}
      width={width - 4}
    >
      <text
        style={{
          width: textWidth,
          flexWrap: "wrap"
        }}
      >
        {bold(fg(getContentColor())(getPrefix()))}:{" "}
        {parseMarkdown(wrappedContent)}
      </text>
    </box>
  );
}

