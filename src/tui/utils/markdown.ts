import {
  StyledText,
  bold,
  italic,
  underline,
  strikethrough,
  fg,
  bg,
  stringToStyledText,
} from '@opentui/core';
import type { TextChunk } from '@opentui/core';
import { marked } from 'marked';
import type { Token, Tokens } from 'marked';
import { colors as themeColors } from '../colors.js';

// Markdown-specific color mappings using theme colors
const colors = {
  code: themeColors.text,
  codeBackground: themeColors.backgrounds.input,
  header1: themeColors.primary,
  header2: themeColors.success,
  header3: themeColors.lightGray,
  link: themeColors.primary,
  list: themeColors.lightGray,
  quote: themeColors.muted,
  quoteBorder: themeColors.quoteBorder,
  admonitionNote: themeColors.primary,
  admonitionWarning: themeColors.admonitionWarning,
  admonitionError: themeColors.error,
  admonitionSuccess: themeColors.success,
  definitionTerm: themeColors.lightGray,
  text: themeColors.lightGray, // Default text color for markdown content
} as const;

// Helper function to safely append a newline only if needed
function appendNewlineIfNeeded(chunks: TextChunk[]): void {
  if (chunks.length === 0) {
    chunks.push(fg(colors.text)('\n'));
    return;
  }

  const lastChunk = chunks[chunks.length - 1];
  if (lastChunk && lastChunk.text && !lastChunk.text.endsWith('\n')) {
    chunks.push(fg(colors.text)('\n'));
  }
}

// Helper function to recursively process tokens and apply formatting
function processTokensRecursively(
  tokens: Token[],
  listDepth: number = 0
): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const token of tokens) {
    chunks.push(...tokenToStyledChunks(token, listDepth));
  }

  return chunks;
}

// Helper function to get appropriate bullet character for list depth
function getBulletForDepth(
  depth: number,
  ordered: boolean = false,
  itemIndex: number = 0
): string {
  if (ordered) {
    return `${itemIndex + 1}. `;
  }

  switch (depth % 3) {
    case 0:
      return '• ';
    case 1:
      return '◦ ';
    case 2:
      return '▪ ';
    default:
      return '• ';
  }
}

// Helper function to get indentation for list depth
function getIndentForDepth(depth: number): string {
  return '  '.repeat(depth);
}

function tokenToStyledChunks(token: Token, listDepth: number = 0): TextChunk[] {
  const chunks: TextChunk[] = [];

  switch (token.type) {
    case 'text': {
      // Handle text tokens that may contain nested formatting
      const textToken = token as Token & { tokens?: Token[] }; // marked types incomplete for nested text tokens
      if (
        'tokens' in textToken &&
        textToken.tokens &&
        textToken.tokens.length > 0
      ) {
        // Process nested tokens recursively
        chunks.push(...processTokensRecursively(textToken.tokens, listDepth));
      } else {
        // Simple text token
        chunks.push(fg(colors.text)(token.text));
      }
      break;
    }

    case 'strong': {
      // Bold text - process inner tokens recursively
      const strongToken = token as Tokens.Strong;
      const strongChunks = processTokensRecursively(
        strongToken.tokens,
        listDepth
      );
      // Apply bold with the same text color (not brighter)
      chunks.push(
        ...strongChunks.map((chunk) => bold(fg(colors.text)(chunk.text)))
      );
      break;
    }

    case 'em': {
      // Italic text - process inner tokens recursively
      const emToken = token as Tokens.Em;
      const emChunks = processTokensRecursively(emToken.tokens, listDepth);
      chunks.push(...emChunks.map((chunk) => italic(chunk.text)));
      break;
    }

    case 'del': {
      // Strikethrough text - process inner tokens recursively
      const delToken = token as Tokens.Del;
      const delChunks = processTokensRecursively(delToken.tokens, listDepth);
      chunks.push(...delChunks.map((chunk) => strikethrough(chunk.text)));
      break;
    }

    case 'codespan': {
      // Inline code
      const codespanToken = token as Tokens.Codespan;
      chunks.push(
        bg(colors.codeBackground)(fg(colors.code)(` ${codespanToken.text} `))
      );
      break;
    }

    case 'code': {
      // Code block
      const codeToken = token as Tokens.Code;
      chunks.push(
        bg(colors.codeBackground)(fg(colors.code)(`\n${codeToken.text}\n`))
      );
      break;
    }

    case 'heading': {
      // Headers - process inner tokens recursively for formatting
      const headingToken = token as Tokens.Heading;
      const level = headingToken.depth;
      const headerColor =
        level === 1 ? colors.header1
        : level === 2 ? colors.header2
        : colors.header3;

      // Process heading tokens recursively to preserve formatting
      const headingChunks = processTokensRecursively(
        headingToken.tokens,
        listDepth
      );
      const headingText = headingChunks.map((chunk) => chunk.text).join('');

      // Add the heading text
      chunks.push(bold(fg(headerColor)(headingText)));

      // Check if raw ends with newline and add it
      const raw = headingToken.raw;
      if (raw.endsWith('\n')) {
        chunks.push(fg(colors.text)('\n'));
      }
      break;
    }

    case 'list': {
      // Lists - process each list item recursively with proper indentation
      const listToken = token as Tokens.List;

      // For top-level lists, always ensure we start on a new line
      // We can't check previous content since chunks is local to this token
      if (listDepth === 0) {
        chunks.push(fg(colors.text)('\n'));
      }

      for (let i = 0; i < listToken.items.length; i++) {
        const item = listToken.items[i];

        // Separate main item content from nested lists
        const itemChunks: TextChunk[] = [];
        const nestedChunks: TextChunk[] = [];

        for (const itemToken of item.tokens) {
          if (itemToken.type === 'paragraph') {
            // Process paragraph tokens recursively to preserve formatting
            const paraToken = itemToken as Tokens.Paragraph;
            itemChunks.push(
              ...processTokensRecursively(paraToken.tokens, listDepth)
            );
          } else if (itemToken.type === 'list') {
            // Handle nested lists separately - they should start on new lines
            nestedChunks.push(...tokenToStyledChunks(itemToken, listDepth + 1));
          } else if (
            itemToken.type === 'text' &&
            'tokens' in itemToken &&
            itemToken.tokens
          ) {
            // Handle text tokens that contain nested formatting
            const textToken = itemToken as Token & { tokens?: Token[] }; // marked types are incomplete for nested text tokens
            itemChunks.push(
              ...processTokensRecursively(textToken.tokens || [], listDepth)
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
        if ('task' in item && item.task) {
          // Task list item - use checkbox instead of bullet
          bullet = item.checked ? '☑ ' : '☐ ';
        } else {
          // Regular list item
          bullet = getBulletForDepth(listDepth, listToken.ordered, i);
        }

        // Add newline before each item except the first one at depth 0
        // (we already handled newline before the list if needed)
        if (i > 0 || listDepth > 0) {
          chunks.push(fg(colors.text)('\n'));
        }

        chunks.push(fg(colors.text)(indent));
        chunks.push(fg(colors.list)(bullet));
        chunks.push(...itemChunks);

        // Add nested lists directly - they handle their own newlines
        if (nestedChunks.length > 0) {
          chunks.push(...nestedChunks);
        }
      }
      break;
    }

    case 'link': {
      // Links - process inner tokens recursively and show URL
      const linkToken = token as Tokens.Link;
      const linkChunks = processTokensRecursively(linkToken.tokens, listDepth);
      const linkText = linkChunks.map((chunk) => chunk.text).join('');

      // In terminal, show both link text and URL
      if (linkText === linkToken.href) {
        // If link text is same as URL, just show URL
        chunks.push(underline(fg(colors.link)(linkToken.href)));
      } else {
        // Show link text followed by URL in parentheses
        chunks.push(underline(fg(colors.link)(linkText)));
        chunks.push(fg(colors.quote)(` (${linkToken.href})`));
      }
      break;
    }

    case 'paragraph': {
      // Paragraphs - process inner tokens recursively
      const paragraphToken = token as Tokens.Paragraph;
      chunks.push(
        ...processTokensRecursively(paragraphToken.tokens, listDepth)
      );
      break;
    }

    case 'hr': {
      // Horizontal rules - render with proper separator line
      appendNewlineIfNeeded(chunks);
      chunks.push(fg(colors.quote)('─'.repeat(60))); // 60-character horizontal line
      appendNewlineIfNeeded(chunks);
      break;
    }

    case 'space': {
      // Whitespace/newlines - but avoid double newlines
      const spaceToken = token as Tokens.Space;
      // Only add space if it won't create double newlines
      if (spaceToken.raw === '\n' && chunks.length > 0) {
        const lastChunk = chunks[chunks.length - 1];
        if (lastChunk && lastChunk.text && lastChunk.text.endsWith('\n')) {
          // Skip this newline as it would create a double newline
          break;
        }
      }
      chunks.push(fg(colors.text)(spaceToken.raw));
      break;
    }

    case 'br': {
      // Line breaks
      appendNewlineIfNeeded(chunks);
      break;
    }

    case 'blockquote': {
      // Quote blocks - render with left border and indentation
      // Also handles admonitions/callouts (> [!NOTE], > [!WARNING], etc.)
      const blockquoteToken = token as Tokens.Blockquote;

      // Process inner tokens to get the quote content
      const quoteChunks = processTokensRecursively(
        blockquoteToken.tokens,
        listDepth
      );
      const quoteText = quoteChunks.map((chunk) => chunk.text).join('');

      // Check if this is an admonition (starts with [!TYPE])
      const admonitionMatch = quoteText.match(
        /^\[!(NOTE|WARNING|ERROR|SUCCESS|INFO|TIP|CAUTION)\](.*)/is
      );

      appendNewlineIfNeeded(chunks); // Start with newline

      if (admonitionMatch) {
        // This is an admonition/callout
        const [, type, content] = admonitionMatch;
        const typeUpper = type.toUpperCase();

        // Get appropriate color and icon for the admonition type
        let admonitionColor: string = colors.admonitionNote; // default
        let icon = 'ℹ️ '; // default info icon

        switch (typeUpper) {
          case 'NOTE':
          case 'INFO':
            admonitionColor = colors.admonitionNote;
            icon = 'ℹ️ ';
            break;
          case 'WARNING':
          case 'CAUTION':
            admonitionColor = colors.admonitionWarning;
            icon = '⚠️ ';
            break;
          case 'ERROR':
            admonitionColor = colors.admonitionError;
            icon = '❌ ';
            break;
          case 'SUCCESS':
          case 'TIP':
            admonitionColor = colors.admonitionSuccess;
            icon = '✅ ';
            break;
        }

        // Render admonition header
        chunks.push(
          bg(admonitionColor)(
            fg(themeColors.admonitionText)(`${icon}${typeUpper}`)
          )
        );
        appendNewlineIfNeeded(chunks);

        // Render admonition content with left border
        const contentLines = content.trim().split('\n');
        for (let i = 0; i < contentLines.length; i++) {
          const line = contentLines[i];
          chunks.push(fg(admonitionColor)('│ '));
          chunks.push(fg(colors.text)(line));
          if (i < contentLines.length - 1) {
            appendNewlineIfNeeded(chunks);
          }
        }
      } else {
        // Regular quote block
        const lines = quoteText.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          chunks.push(fg(colors.quoteBorder)('│ ')); // Quote border character
          chunks.push(fg(colors.quote)(line));
          if (i < lines.length - 1) {
            appendNewlineIfNeeded(chunks);
          }
        }
      }

      appendNewlineIfNeeded(chunks); // End with newline
      break;
    }

    case 'table': {
      // Tables - render with proper box drawing characters
      const tableToken = token as Tokens.Table;
      appendNewlineIfNeeded(chunks); // Start with newline

      // Box drawing characters
      const box = {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│',
        topTee: '┬',
        bottomTee: '┴',
        leftTee: '├',
        rightTee: '┤',
        cross: '┼',
      };

      // Process header row with formatting
      const headerRow = tableToken.header.map((cell) => {
        const cellChunks = processTokensRecursively(cell.tokens, listDepth);
        return cellChunks.map((chunk) => chunk.text).join('');
      });

      // Process data rows with formatting
      const dataRows = tableToken.rows.map((row) =>
        row.map((cell) => {
          const cellChunks = processTokensRecursively(cell.tokens, listDepth);
          return {
            text: cellChunks.map((chunk) => chunk.text).join(''),
            chunks: cellChunks,
          };
        })
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
      chunks.push(fg(colors.quote)(topBorder));
      appendNewlineIfNeeded(chunks);

      // Render header row
      chunks.push(fg(colors.quote)(box.vertical + ' '));
      for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
        const header = headerRow[colIndex];
        chunks.push(
          bold(fg(colors.header2)(header.padEnd(colWidths[colIndex])))
        );

        if (colIndex < headerRow.length - 1) {
          chunks.push(fg(colors.quote)(' ' + box.vertical + ' '));
        }
      }
      chunks.push(fg(colors.quote)(' ' + box.vertical));
      appendNewlineIfNeeded(chunks);

      // Render header separator
      const headerSeparator =
        box.leftTee +
        colWidths
          .map((width) => box.horizontal.repeat(width + 2))
          .join(box.cross) +
        box.rightTee;
      chunks.push(fg(colors.quote)(headerSeparator));
      appendNewlineIfNeeded(chunks);

      // Render data rows with formatting
      for (const row of dataRows) {
        chunks.push(fg(colors.quote)(box.vertical + ' '));

        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cell = row[colIndex];
          if (cell) {
            // Add formatted cell content
            chunks.push(...cell.chunks);

            // Add padding to match column width
            const padding = colWidths[colIndex] - cell.text.length;
            if (padding > 0) {
              chunks.push(fg(colors.text)(' '.repeat(padding)));
            }
          } else {
            // Empty cell
            chunks.push(fg(colors.text)(' '.repeat(colWidths[colIndex])));
          }

          if (colIndex < row.length - 1) {
            chunks.push(fg(colors.quote)(' ' + box.vertical + ' '));
          }
        }

        chunks.push(fg(colors.quote)(' ' + box.vertical));
        appendNewlineIfNeeded(chunks);
      }

      // Render bottom border
      const bottomBorder =
        box.bottomLeft +
        colWidths
          .map((width) => box.horizontal.repeat(width + 2))
          .join(box.bottomTee) +
        box.bottomRight;
      chunks.push(fg(colors.quote)(bottomBorder));
      appendNewlineIfNeeded(chunks);

      break;
    }

    default: {
      // Fallback for unhandled tokens - use raw text if available
      const rawText =
        'raw' in token ? token.raw
        : 'text' in token ? (token as Token & { text?: string }).text
        : '';
      if (rawText) {
        chunks.push(fg(colors.text)(rawText));
      }
      break;
    }
  }

  return chunks;
}

export function parseMarkdown(content: string): StyledText {
  try {
    if (content === '') {
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
