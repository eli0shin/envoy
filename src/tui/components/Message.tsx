import { bold, fg } from "@opentui/core";
import { parseMarkdown } from "../utils/markdown.js";
import { roleColors, contentTypeColors, colors } from "../theme.js";
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
    if (isUser) return roleColors.user;
    return contentTypeColors[contentType];
  };

  const getPrefix = () => {
    if (isUser) return "You";
    if (contentType === "reasoning") return "Assistant (thinking)";
    if (contentType === "tool") return "Tool";
    return "Assistant";
  };

  const getBackgroundColor = () => {
    return isUser ? colors.backgrounds.userMessage : colors.backgrounds.assistantMessage;
  };

  const displayContent =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);

  // Calculate available width for text (terminal width minus scrollbox, padding, and margins)
  const textWidth = width - 6; // 6 = scrollbox (2) + padding (2) + margin/border space (2)

  // Helper function to wrap text manually by inserting newlines
  // First splits on existing newlines, then wraps each line individually
  const wrapText = (text: string, maxWidth: number): string => {
    const prefix = `${getPrefix()}: `;
    const prefixLength = prefix.length;
    const availableWidth = maxWidth - prefixLength;
    
    if (availableWidth <= 0) return text;
    
    // First split by existing newlines to preserve intentional line breaks
    const existingLines = text.split('\n');
    const wrappedLines: string[] = [];
    
    // Process each existing line individually
    for (const line of existingLines) {
      if (line.length <= availableWidth) {
        // Line fits within width, keep as is
        wrappedLines.push(line);
      } else {
        // Line needs wrapping, wrap by words
        const words = line.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          
          if (testLine.length <= availableWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              wrappedLines.push(currentLine);
              currentLine = word;
            } else {
              // Word is longer than available width, break it
              let remainingWord = word;
              while (remainingWord.length > availableWidth) {
                wrappedLines.push(remainingWord.substring(0, availableWidth));
                remainingWord = remainingWord.substring(availableWidth);
              }
              if (remainingWord) {
                currentLine = remainingWord;
              }
            }
          }
        }
        
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
      }
    }
    
    return wrappedLines.join('\n');
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

