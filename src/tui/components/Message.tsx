import { formatContent, formatBackground } from "../theme.js";
import type { CoreMessage } from "ai";

type MessageProps = {
  message: CoreMessage;
  contentType?: "normal" | "reasoning" | "tool";
  width: number;
};

export function Message({
  message,
  contentType = "normal",
  width,
}: MessageProps) {

  const displayContent =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);

  // Calculate available width for text (terminal width minus scrollbox, padding, and margins)
  const textWidth = width - 6; // 6 = scrollbox (2) + padding (2) + margin/border space (2)

  // Simple text wrapping - formatContent will handle prefixes
  const wrapText = (text: string, maxWidth: number): string => {
    if (maxWidth <= 0) return text;

    // First split by existing newlines to preserve intentional line breaks
    const existingLines = text.split("\n");
    const wrappedLines: string[] = [];

    // Process each existing line individually
    for (const line of existingLines) {
      if (line.length <= maxWidth) {
        wrappedLines.push(line);
      } else {
        // Line needs wrapping, wrap by words
        const words = line.split(" ");
        let currentLine = "";

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;

          if (testLine.length <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              wrappedLines.push(currentLine);
              currentLine = word;
            } else {
              // Word is longer than available width, break it
              let remainingWord = word;
              while (remainingWord.length > maxWidth) {
                wrappedLines.push(remainingWord.substring(0, maxWidth));
                remainingWord = remainingWord.substring(maxWidth);
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

    return wrappedLines.join("\n");
  };

  const wrappedContent = wrapText(displayContent, textWidth);
  const styledContent = formatContent(message.role, contentType, wrappedContent);
  const backgroundColor = formatBackground(message.role);

  return (
    <box padding={1} backgroundColor={backgroundColor} width={width - 4}>
      <text
        style={{
          width: textWidth,
          flexWrap: "wrap",
        }}
      >
        {styledContent}
      </text>
    </box>
  );
}
