import {
  StyledText,
  bold,
  italic,
  underline,
  strikethrough,
  fg,
  bg,
  stringToStyledText,
} from "@opentui/core";
import type { TextChunk } from "@opentui/core";
import { marked } from "marked";
import type { Token, Tokens } from "marked";

const colors = {
  code: "#D4D4D4",
  codeBackground: "#2D2D30",
  header1: "#4fc1ff", // primary
  header2: "#89d185", // success
  header3: "#DCDCDC", // lightGray
  link: "#4fc1ff", // primary
  list: "#DCDCDC", // lightGray
};

// Helper function to recursively process tokens and apply formatting
function processTokensRecursively(
  tokens: Token[],
  listDepth: number = 0,
): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const token of tokens) {
    chunks.push(...tokenToStyledChunks(token, listDepth));
  }

  return chunks;
}

// Helper function to get appropriate bullet character for list depth
function getBulletForDepth(depth: number, ordered: boolean = false): string {
  if (ordered) {
    return "1. "; // For now, just use 1. for all ordered lists
  }

  switch (depth % 3) {
    case 0:
      return "• ";
    case 1:
      return "◦ ";
    case 2:
      return "▪ ";
    default:
      return "• ";
  }
}

// Helper function to get indentation for list depth
function getIndentForDepth(depth: number): string {
  return "  ".repeat(depth);
}

function tokenToStyledChunks(token: Token, listDepth: number = 0): TextChunk[] {
  const chunks: TextChunk[] = [];

  switch (token.type) {
    case "text":
      // Handle text tokens that may contain nested formatting
      const textToken = token as any; // marked types incomplete for nested text tokens
      if (
        "tokens" in textToken &&
        textToken.tokens &&
        textToken.tokens.length > 0
      ) {
        // Process nested tokens recursively
        chunks.push(...processTokensRecursively(textToken.tokens, listDepth));
      } else {
        // Simple text token
        chunks.push(fg("#FFFFFF")(token.text));
      }
      break;

    case "strong":
      // Bold text - process inner tokens recursively
      const strongToken = token as Tokens.Strong;
      const strongChunks = processTokensRecursively(
        strongToken.tokens,
        listDepth,
      );
      chunks.push(...strongChunks.map((chunk) => bold(chunk.plainText)));
      break;

    case "em":
      // Italic text - process inner tokens recursively
      const emToken = token as Tokens.Em;
      const emChunks = processTokensRecursively(emToken.tokens, listDepth);
      chunks.push(...emChunks.map((chunk) => italic(chunk.plainText)));
      break;

    case "del":
      // Strikethrough text - process inner tokens recursively
      const delToken = token as Tokens.Del;
      const delChunks = processTokensRecursively(delToken.tokens, listDepth);
      chunks.push(...delChunks.map((chunk) => strikethrough(chunk.plainText)));
      break;

    case "codespan":
      // Inline code
      const codespanToken = token as Tokens.Codespan;
      chunks.push(
        bg(colors.codeBackground)(fg(colors.code)(` ${codespanToken.text} `)),
      );
      break;

    case "code":
      // Code block
      const codeToken = token as Tokens.Code;
      chunks.push(
        bg(colors.codeBackground)(fg(colors.code)(`\n${codeToken.text}\n`)),
      );
      break;

    case "heading":
      // Headers - process inner tokens recursively for formatting
      const headingToken = token as Tokens.Heading;
      const level = headingToken.depth;
      const headerColor =
        level === 1
          ? colors.header1
          : level === 2
            ? colors.header2
            : colors.header3;

      // Process heading tokens recursively to preserve formatting
      const headingChunks = processTokensRecursively(
        headingToken.tokens,
        listDepth,
      );
      const headingText = headingChunks
        .map((chunk) => chunk.plainText)
        .join("");

      // Extract trailing whitespace from raw field
      const raw = headingToken.raw;
      const trailingWhitespace = raw.match(/^#+\s+.+?(\s*)$/)?.[1] || "";

      chunks.push(bold(fg(headerColor)(headingText)));
      if (trailingWhitespace) {
        chunks.push(fg("#FFFFFF")(trailingWhitespace));
      }
      break;

    case "list":
      // Lists - process each list item recursively with proper indentation
      const listToken = token as Tokens.List;

      for (let i = 0; i < listToken.items.length; i++) {
        const item = listToken.items[i];

        // Separate main item content from nested lists
        const itemChunks: TextChunk[] = [];
        const nestedChunks: TextChunk[] = [];

        for (const itemToken of item.tokens) {
          if (itemToken.type === "paragraph") {
            // Process paragraph tokens recursively to preserve formatting
            const paraToken = itemToken as Tokens.Paragraph;
            itemChunks.push(
              ...processTokensRecursively(paraToken.tokens, listDepth),
            );
          } else if (itemToken.type === "list") {
            // Handle nested lists separately - they should start on new lines
            nestedChunks.push(...tokenToStyledChunks(itemToken, listDepth + 1));
          } else if (
            itemToken.type === "text" &&
            "tokens" in itemToken &&
            itemToken.tokens
          ) {
            // Handle text tokens that contain nested formatting
            const textToken = itemToken as any; // marked types are incomplete for nested text tokens
            itemChunks.push(
              ...processTokensRecursively(textToken.tokens, listDepth),
            );
          } else {
            // Process other tokens directly
            itemChunks.push(...tokenToStyledChunks(itemToken, listDepth));
          }
        }

        // Add proper indentation and bullet point (or checkbox for tasks)
        const indent = getIndentForDepth(listDepth);
        let bullet: string;

        // Check if this is a task list item
        if ("task" in item && item.task) {
          // Task list item - use checkbox instead of bullet
          bullet = item.checked ? "☑ " : "☐ ";
        } else {
          // Regular list item
          bullet = getBulletForDepth(listDepth, listToken.ordered);
        }

        // Always start list items on a new line
        chunks.push(fg("#FFFFFF")("\n"));

        chunks.push(fg("#FFFFFF")(indent));
        chunks.push(fg(colors.list)(bullet));
        chunks.push(...itemChunks);

        // Add nested lists on separate lines with proper newline separation
        if (nestedChunks.length > 0) {
          chunks.push(...nestedChunks);
        }
      }
      break;

    case "link":
      // Links - process inner tokens recursively and show URL
      const linkToken = token as Tokens.Link;
      const linkChunks = processTokensRecursively(linkToken.tokens, listDepth);
      const linkText = linkChunks.map((chunk) => chunk.plainText).join("");

      // In terminal, show both link text and URL
      if (linkText === linkToken.href) {
        // If link text is same as URL, just show URL
        chunks.push(underline(fg(colors.link)(linkToken.href)));
      } else {
        // Show link text followed by URL in parentheses
        chunks.push(underline(fg(colors.link)(linkText)));
        chunks.push(fg("#888888")(` (${linkToken.href})`));
      }
      break;

    case "paragraph":
      // Paragraphs - process inner tokens recursively
      const paragraphToken = token as Tokens.Paragraph;
      chunks.push(
        ...processTokensRecursively(paragraphToken.tokens, listDepth),
      );
      break;

    case "hr":
      // Horizontal rules - render with proper separator line
      chunks.push(fg("#FFFFFF")("\n"));
      chunks.push(fg("#888888")("─".repeat(60))); // 60-character horizontal line
      chunks.push(fg("#FFFFFF")("\n\n"));
      break;

    case "space":
      // Whitespace/newlines
      const spaceToken = token as Tokens.Space;
      chunks.push(fg("#FFFFFF")(spaceToken.raw));
      break;

    case "br":
      // Line breaks
      chunks.push(fg("#FFFFFF")("\n"));
      break;

    case "table":
      // Tables - render with proper box drawing characters
      const tableToken = token as Tokens.Table;
      chunks.push(fg("#FFFFFF")("\n")); // Start with newline

      // Box drawing characters
      const box = {
        topLeft: "┌",
        topRight: "┐",
        bottomLeft: "└",
        bottomRight: "┘",
        horizontal: "─",
        vertical: "│",
        topTee: "┬",
        bottomTee: "┴",
        leftTee: "├",
        rightTee: "┤",
        cross: "┼",
      };

      // Process header row with formatting
      const headerRow = tableToken.header.map((cell) => {
        const cellChunks = processTokensRecursively(cell.tokens, listDepth);
        return cellChunks.map((chunk) => chunk.plainText).join("");
      });

      // Process data rows with formatting
      const dataRows = tableToken.rows.map((row) =>
        row.map((cell) => {
          const cellChunks = processTokensRecursively(cell.tokens, listDepth);
          return {
            text: cellChunks.map((chunk) => chunk.plainText).join(""),
            chunks: cellChunks,
          };
        }),
      );

      // Calculate column widths (minimum 3 chars for padding)
      const colWidths = headerRow.map((header, colIndex) => {
        let maxWidth = Math.max(header.length, 3);
        for (const row of dataRows) {
          if (row[colIndex]) {
            maxWidth = Math.max(maxWidth, row[colIndex].text.length);
          }
        }
        return Math.min(maxWidth, 30); // Cap column width at 30 chars
      });

      // Render top border
      const topBorder =
        box.topLeft +
        colWidths
          .map((width) => box.horizontal.repeat(width + 2))
          .join(box.topTee) +
        box.topRight;
      chunks.push(fg("#888888")(topBorder));
      chunks.push(fg("#FFFFFF")("\n"));

      // Render header row
      chunks.push(fg("#888888")(box.vertical + " "));
      for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
        const header = headerRow[colIndex];
        chunks.push(
          bold(fg(colors.header2)(header.padEnd(colWidths[colIndex]))),
        );

        if (colIndex < headerRow.length - 1) {
          chunks.push(fg("#888888")(" " + box.vertical + " "));
        }
      }
      chunks.push(fg("#888888")(" " + box.vertical));
      chunks.push(fg("#FFFFFF")("\n"));

      // Render header separator
      const headerSeparator =
        box.leftTee +
        colWidths
          .map((width) => box.horizontal.repeat(width + 2))
          .join(box.cross) +
        box.rightTee;
      chunks.push(fg("#888888")(headerSeparator));
      chunks.push(fg("#FFFFFF")("\n"));

      // Render data rows with formatting
      for (const row of dataRows) {
        chunks.push(fg("#888888")(box.vertical + " "));

        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cell = row[colIndex];
          if (cell) {
            // Add formatted cell content
            chunks.push(...cell.chunks);

            // Add padding to match column width
            const padding = colWidths[colIndex] - cell.text.length;
            if (padding > 0) {
              chunks.push(fg("#FFFFFF")(" ".repeat(padding)));
            }
          } else {
            // Empty cell
            chunks.push(fg("#FFFFFF")(" ".repeat(colWidths[colIndex])));
          }

          if (colIndex < row.length - 1) {
            chunks.push(fg("#888888")(" " + box.vertical + " "));
          }
        }

        chunks.push(fg("#888888")(" " + box.vertical));
        chunks.push(fg("#FFFFFF")("\n"));
      }

      // Render bottom border
      const bottomBorder =
        box.bottomLeft +
        colWidths
          .map((width) => box.horizontal.repeat(width + 2))
          .join(box.bottomTee) +
        box.bottomRight;
      chunks.push(fg("#888888")(bottomBorder));
      chunks.push(fg("#FFFFFF")("\n"));

      chunks.push(fg("#FFFFFF")("\n")); // End with extra newline
      break;

    default:
      // Fallback for unhandled tokens - use raw text if available
      const rawText =
        "raw" in token ? token.raw : "text" in token ? (token as any).text : "";
      if (rawText) {
        chunks.push(fg("#FFFFFF")(rawText));
      }
      break;
  }

  return chunks;
}

export function parseMarkdown(content: string): StyledText {
  try {
    if (content === "") {
      return new StyledText([]);
    }

    // Parse markdown to AST using marked
    const tokens = marked.lexer(content);

    const allChunks: TextChunk[] = [];

    for (const token of tokens) {
      const chunks = tokenToStyledChunks(token);
      allChunks.push(...chunks);
    }

    return new StyledText(allChunks);
  } catch (error) {
    // Fallback to plain text if parsing fails
    return stringToStyledText(content);
  }
}
