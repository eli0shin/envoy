import type { ReactNode } from 'react';
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

function tokenToReactElements(token: Token, listDepth: number = 0, key?: string, compact: boolean = false): ReactNode {
  const baseKey = key || `token-${Math.random()}`;

  switch (token.type) {
    case 'text': {
      const textToken = token as Token & { tokens?: Token[] };
      if (textToken.tokens && textToken.tokens.length > 0) {
        return <span key={baseKey}>{textToken.tokens.map((t, i) => tokenToReactElements(t, listDepth, `${baseKey}-${i}`, compact))}</span>;
      }
      return <span key={baseKey} fg={colors.text}>{token.text}</span>;
    }

    case 'strong': {
      const strongToken = token as Tokens.Strong;
      return (
        <b key={baseKey}>
          <span fg={colors.text}>
            {strongToken.tokens.map((t, i) => tokenToReactElements(t, listDepth, `${baseKey}-${i}`, compact))}
          </span>
        </b>
      );
    }

    case 'em': {
      const emToken = token as Tokens.Em;
      return (
        <i key={baseKey}>
          {emToken.tokens.map((t, i) => tokenToReactElements(t, listDepth, `${baseKey}-${i}`, compact))}
        </i>
      );
    }

    case 'del': {
      const delToken = token as Tokens.Del;
      return (
        <span key={baseKey}>
          {delToken.tokens.map((t, i) => tokenToReactElements(t, listDepth, `${baseKey}-${i}`, compact))}
        </span>
      );
    }

    case 'codespan': {
      const codespanToken = token as Tokens.Codespan;
      return (
        <span key={baseKey} bg={colors.codeBackground} fg={colors.code}>
          {` ${codespanToken.text} `}
        </span>
      );
    }

    case 'code': {
      const codeToken = token as Tokens.Code;
      return (
        <span key={baseKey}>
          <span bg={colors.codeBackground} fg={colors.code}>
            {`\n${codeToken.text}\n`}
          </span>
          <span fg={colors.text}>{'\n'}</span>
        </span>
      );
    }

    case 'heading': {
      const headingToken = token as Tokens.Heading;
      const level = headingToken.depth;
      const headerColor =
        level === 1 ? colors.header1
        : level === 2 ? colors.header2
        : colors.header3;

      const content = headingToken.tokens.map((t, i) => tokenToReactElements(t, listDepth, `${baseKey}-${i}`, compact));

      return (
        <span key={baseKey}>
          <b>
            <span fg={headerColor}>{content}</span>
          </b>
          <span fg={colors.text}>{'\n'}</span>
        </span>
      );
    }

    case 'list': {
      const listToken = token as Tokens.List;
      const elements: ReactNode[] = [];

      // For top-level lists, start on a new line (unless compact mode)
      if (listDepth === 0 && !compact) {
        elements.push(<span key={`${baseKey}-nl`} fg={colors.text}>{'\n'}</span>);
      }

      /* eslint-disable react/no-array-index-key -- List item position is semantically important */
      listToken.items.forEach((item, itemIndex) => {
        const itemElements: ReactNode[] = [];
        const nestedElements: ReactNode[] = [];

        // Check if this is an in-progress task to filter out the marker
        const rawItem = (item as { raw?: string }).raw || '';
        const isInProgress = rawItem.includes('[⟳]');

        item.tokens.forEach((itemToken, tokenIndex) => {
          if (itemToken.type === 'paragraph') {
            const paraToken = itemToken as Tokens.Paragraph;
            itemElements.push(
              ...paraToken.tokens.map((t, i) => {
                // Filter out [⟳] marker from text tokens
                if (isInProgress && t.type === 'text') {
                  const textToken = t as Tokens.Text;
                  const cleanedText = textToken.text.replace(/\[⟳\]\s*/, '');
                  if (cleanedText) {
                    return tokenToReactElements(
                      { ...textToken, text: cleanedText, raw: cleanedText },
                      listDepth,
                      `${baseKey}-item${itemIndex}-${tokenIndex}-${i}`,
                      compact
                    );
                  }
                  return null;
                }
                return tokenToReactElements(t, listDepth, `${baseKey}-item${itemIndex}-${tokenIndex}-${i}`, compact);
              }).filter(Boolean)
            );
          } else if (itemToken.type === 'list') {
            nestedElements.push(
              tokenToReactElements(itemToken, listDepth + 1, `${baseKey}-item${itemIndex}-nested${tokenIndex}`, compact)
            );
          } else if (itemToken.type === 'text' && 'tokens' in itemToken && itemToken.tokens) {
            const textToken = itemToken as Token & { tokens?: Token[] };
            itemElements.push(
              ...(textToken.tokens || []).map((t, i) => {
                // Filter out [⟳] marker from text tokens
                if (isInProgress && t.type === 'text') {
                  const textToken = t as Tokens.Text;
                  const cleanedText = textToken.text.replace(/\[⟳\]\s*/, '');
                  if (cleanedText) {
                    return tokenToReactElements(
                      { ...textToken, text: cleanedText, raw: cleanedText },
                      listDepth,
                      `${baseKey}-item${itemIndex}-${tokenIndex}-${i}`,
                      compact
                    );
                  }
                  return null;
                }
                return tokenToReactElements(t, listDepth, `${baseKey}-item${itemIndex}-${tokenIndex}-${i}`, compact);
              }).filter(Boolean)
            );
          } else {
            itemElements.push(
              tokenToReactElements(itemToken, listDepth, `${baseKey}-item${itemIndex}-${tokenIndex}`, compact)
            );
          }
        });

        const indent = getIndentForDepth(listDepth);
        let bullet: string;

        if ('task' in item && item.task) {
          bullet = item.checked ? '● ' : '○ ';
        } else if (isInProgress) {
          bullet = '◐ ';
        } else {
          bullet = getBulletForDepth(listDepth, listToken.ordered, itemIndex);
        }

        // Add newline before each item except the first one at depth 0
        if (itemIndex > 0 || listDepth > 0) {
          elements.push(<span key={`${baseKey}-item${itemIndex}-nl`} fg={colors.text}>{'\n'}</span>);
        }

        elements.push(
          <span key={`${baseKey}-item${itemIndex}`}>
            <span fg={colors.text}>{indent}</span>
            <span fg={colors.list}>{bullet}</span>
            {itemElements}
            {nestedElements}
          </span>
        );
      });
      /* eslint-enable react/no-array-index-key */

      // Add blank line after top-level lists
      if (listDepth === 0 && !compact) {
        elements.push(<span key={`${baseKey}-trailing-nl`} fg={colors.text}>{'\n'}</span>);
      }

      return <span key={baseKey}>{elements}</span>;
    }

    case 'link': {
      const linkToken = token as Tokens.Link;
      const linkContent = linkToken.tokens.map((t, i) => tokenToReactElements(t, listDepth, `${baseKey}-${i}`, compact));

      // In terminal, show both link text and URL
      const textContent = linkToken.tokens.map(t => t.type === 'text' ? (t as Tokens.Text).text : '').join('');

      if (textContent === linkToken.href) {
        return (
          <u key={baseKey}>
            <span fg={colors.link}>{linkToken.href}</span>
          </u>
        );
      }

      return (
        <span key={baseKey}>
          <u>
            <span fg={colors.link}>{linkContent}</span>
          </u>
          <span fg={colors.quote}>{` (${linkToken.href})`}</span>
        </span>
      );
    }

    case 'paragraph': {
      const paragraphToken = token as Tokens.Paragraph;
      return (
        <span key={baseKey}>
          {paragraphToken.tokens.map((t, i) => tokenToReactElements(t, listDepth, `${baseKey}-${i}`, compact))}
          <span fg={colors.text}>{'\n'}</span>
        </span>
      );
    }

    case 'hr': {
      return (
        <span key={baseKey}>
          <span fg={colors.text}>{'\n'}</span>
          <span fg={colors.quote}>{'─'.repeat(60)}</span>
          <span fg={colors.text}>{'\n'}</span>
        </span>
      );
    }

    case 'space': {
      // Normalize multiple blank lines to single newline
      return <span key={baseKey} fg={colors.text}>{'\n'}</span>;
    }

    case 'br': {
      return <span key={baseKey} fg={colors.text}>{'\n'}</span>;
    }

    case 'blockquote': {
      const blockquoteToken = token as Tokens.Blockquote;
      const content = blockquoteToken.tokens.map((t, i) => tokenToReactElements(t, listDepth, `${baseKey}-${i}`, compact));

      // Get text content for admonition detection
      const getText = (tokens: Token[]): string => {
        return tokens.map(t => {
          if (t.type === 'text') return (t as Tokens.Text).text;
          if (t.type === 'paragraph') return getText((t as Tokens.Paragraph).tokens);
          if ('tokens' in t && Array.isArray(t.tokens)) return getText(t.tokens);
          return '';
        }).join('');
      };

      const quoteText = getText(blockquoteToken.tokens);
      const admonitionMatch = quoteText.match(/^\[!(NOTE|WARNING|ERROR|SUCCESS|INFO|TIP|CAUTION)\](.*)/is);

      if (admonitionMatch) {
        const [, type, admonitionContent] = admonitionMatch;
        const typeUpper = type.toUpperCase();

        let admonitionColor: string = colors.admonitionNote;
        let icon = 'ℹ️ ';

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

        const contentLines = admonitionContent.trim().split('\n');

        return (
          <span key={baseKey}>
            <span fg={colors.text}>{'\n'}</span>
            <span bg={admonitionColor} fg={themeColors.admonitionText}>{`${icon}${typeUpper}`}</span>
            <span fg={colors.text}>{'\n'}</span>
            {/* eslint-disable react/no-array-index-key -- Line position is semantically important */}
            {contentLines.map((line, i) => (
              <span key={i}>
                <span fg={admonitionColor}>{'│ '}</span>
                <span fg={colors.text}>{line}</span>
                {i < contentLines.length - 1 && <span fg={colors.text}>{'\n'}</span>}
              </span>
            ))}
            {/* eslint-enable react/no-array-index-key */}
            <span fg={colors.text}>{'\n'}</span>
          </span>
        );
      }

      // Regular quote block
      const lines = quoteText.split('\n');

      return (
        <span key={baseKey}>
          <span fg={colors.text}>{'\n'}</span>
          {/* eslint-disable react/no-array-index-key -- Line position is semantically important */}
          {lines.map((line, i) => (
            <span key={i}>
              <span fg={colors.quoteBorder}>{'│ '}</span>
              <span fg={colors.quote}>{line}</span>
              {i < lines.length - 1 && <span fg={colors.text}>{'\n'}</span>}
            </span>
          ))}
          {/* eslint-enable react/no-array-index-key */}
          <span fg={colors.text}>{'\n'}</span>
        </span>
      );
    }

    case 'table': {
      const tableToken = token as Tokens.Table;

      // Process header and rows
      const headerRow = tableToken.header.map(cell => {
        const tokens = cell.tokens;
        return tokens.map(t => {
          if (t.type === 'text') return (t as Tokens.Text).text;
          if ('tokens' in t && Array.isArray(t.tokens)) {
            return t.tokens.map(st => st.type === 'text' ? (st as Tokens.Text).text : '').join('');
          }
          return '';
        }).join('');
      });

      const dataRows = tableToken.rows.map(row =>
        row.map(cell => {
          const tokens = cell.tokens;
          const text = tokens.map(t => {
            if (t.type === 'text') return (t as Tokens.Text).text;
            if ('tokens' in t && Array.isArray(t.tokens)) {
              return t.tokens.map(st => st.type === 'text' ? (st as Tokens.Text).text : '').join('');
            }
            return '';
          }).join('');
          return { text, tokens };
        })
      );

      // Calculate column widths
      const colWidths = headerRow.map((header, colIndex) => {
        let maxWidth = Math.max(header.length, 3);
        for (const row of dataRows) {
          if (row[colIndex]) {
            maxWidth = Math.max(maxWidth, row[colIndex].text.length);
          }
        }
        return Math.min(maxWidth, 30);
      });

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

      const topBorder =
        box.topLeft +
        colWidths.map(w => box.horizontal.repeat(w + 2)).join(box.topTee) +
        box.topRight;

      const headerSeparator =
        box.leftTee +
        colWidths.map(w => box.horizontal.repeat(w + 2)).join(box.cross) +
        box.rightTee;

      const bottomBorder =
        box.bottomLeft +
        colWidths.map(w => box.horizontal.repeat(w + 2)).join(box.bottomTee) +
        box.bottomRight;

      return (
        <span key={baseKey}>
          <span fg={colors.text}>{'\n'}</span>
          <span fg={colors.quote}>{topBorder}</span>
          <span fg={colors.text}>{'\n'}</span>
          <span fg={colors.quote}>{box.vertical + ' '}</span>
          {/* eslint-disable react/no-array-index-key -- Column position is semantically important */}
          {headerRow.map((header, i) => (
            <span key={i}>
              <b>
                <span fg={colors.header2}>{header.padEnd(colWidths[i])}</span>
              </b>
              {i < headerRow.length - 1 && <span fg={colors.quote}>{' ' + box.vertical + ' '}</span>}
            </span>
          ))}
          {/* eslint-enable react/no-array-index-key */}
          <span fg={colors.quote}>{' ' + box.vertical}</span>
          <span fg={colors.text}>{'\n'}</span>
          <span fg={colors.quote}>{headerSeparator}</span>
          <span fg={colors.text}>{'\n'}</span>
          {/* eslint-disable react/no-array-index-key -- Row position is semantically important */}
          {dataRows.map((row, rowIndex) => (
            <span key={rowIndex}>
              <span fg={colors.quote}>{box.vertical + ' '}</span>
              {row.map((cell, colIndex) => (
                <span key={colIndex}>
                  {cell.tokens.map((t, i) => tokenToReactElements(t, listDepth, `${baseKey}-r${rowIndex}-c${colIndex}-${i}`, compact))}
                  {cell.text.length < colWidths[colIndex] && (
                    <span fg={colors.text}>{' '.repeat(colWidths[colIndex] - cell.text.length)}</span>
                  )}
                  {colIndex < row.length - 1 && <span fg={colors.quote}>{' ' + box.vertical + ' '}</span>}
                </span>
              ))}
              <span fg={colors.quote}>{' ' + box.vertical}</span>
              <span fg={colors.text}>{'\n'}</span>
            </span>
          ))}
          {/* eslint-enable react/no-array-index-key */}
          <span fg={colors.quote}>{bottomBorder}</span>
          <span fg={colors.text}>{'\n'}</span>
        </span>
      );
    }

    default: {
      const rawText =
        'raw' in token ? token.raw
        : 'text' in token ? (token as Token & { text?: string }).text
        : '';
      if (rawText) {
        return <span key={baseKey} fg={colors.text}>{rawText}</span>;
      }
      return null;
    }
  }
}

type MarkdownProps = {
  content: string;
  compact?: boolean;
};

export function Markdown({ content, compact = false }: MarkdownProps): ReactNode {
  try {
    if (content === '') {
      return null;
    }

    // Preprocess to handle [~] in-progress task markers
    // marked.js only recognizes [ ] and [x] as task list syntax
    // Convert [~] to a special marker we can detect later
    const processedContent = content.replace(/^(\s*-\s*)\[~\]/gm, '$1[⟳]');

    const tokens = marked.lexer(processedContent);
    return <span>{tokens.map((token, i) => tokenToReactElements(token, 0, `root-${i}`, compact))}</span>;
  } catch (error) {
    // Fallback to plain text if parsing fails
    return <span fg={colors.text}>{content}</span>;
  }
}
