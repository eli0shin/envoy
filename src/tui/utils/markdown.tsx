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

type TokenToReactElementsProps = {
  token: Token;
  listDepth?: number;
  tokenKey: string;
  compact?: boolean;
  isLast?: boolean;
  key?: string;
};

// Generate a stable key from token content
function getTokenKey(token: Token, fallback: string): string {
  const raw =
    ('raw' in token && token.raw) ||
    ('text' in token && (token as { text?: string }).text) ||
    '';
  if (raw) {
    // Use first 50 chars of content + fallback for uniqueness
    return `${fallback}-${raw.slice(0, 50).replace(/\s+/g, '-')}`;
  }
  return fallback;
}

function TokenToReactElements({
  token,
  listDepth = 0,
  tokenKey,
  compact = false,
  isLast = false,
}: TokenToReactElementsProps): ReactNode {
  const key = tokenKey;

  switch (token.type) {
    case 'text': {
      const textToken = token as Token & { tokens?: Token[] };
      if (textToken.tokens && textToken.tokens.length > 0) {
        return (
          <span key={key}>
            {textToken.tokens.map((t) => {
              const tKey = getTokenKey(t, key);
              return (
                <TokenToReactElements
                  key={tKey}
                  token={t}
                  tokenKey={tKey}
                  listDepth={listDepth}
                  compact={compact}
                />
              );
            })}
          </span>
        );
      }
      return (
        <span key={key} fg={colors.text}>
          {token.text}
        </span>
      );
    }

    case 'strong': {
      const strongToken = token as Tokens.Strong;
      return (
        <b key={key}>
          <span fg={colors.text}>
            {strongToken.tokens.map((t) => {
              const tKey = getTokenKey(t, key);
              return (
                <TokenToReactElements
                  key={tKey}
                  token={t}
                  tokenKey={tKey}
                  listDepth={listDepth}
                  compact={compact}
                />
              );
            })}
          </span>
        </b>
      );
    }

    case 'em': {
      const emToken = token as Tokens.Em;
      return (
        <i key={key}>
          {emToken.tokens.map((t) => {
            const tKey = getTokenKey(t, key);
            return (
              <TokenToReactElements
                key={tKey}
                token={t}
                tokenKey={tKey}
                listDepth={listDepth}
                compact={compact}
              />
            );
          })}
        </i>
      );
    }

    case 'del': {
      const delToken = token as Tokens.Del;
      return (
        <span key={key}>
          {delToken.tokens.map((t) => {
            const tKey = getTokenKey(t, key);
            return (
              <TokenToReactElements
                key={tKey}
                token={t}
                tokenKey={tKey}
                listDepth={listDepth}
                compact={compact}
              />
            );
          })}
        </span>
      );
    }

    case 'codespan': {
      const codespanToken = token as Tokens.Codespan;
      return (
        <span key={key} bg={colors.codeBackground} fg={colors.code}>
          {` ${codespanToken.text} `}
        </span>
      );
    }

    case 'code': {
      const codeToken = token as Tokens.Code;
      return (
        <span key={key}>
          <span bg={colors.codeBackground} fg={colors.code}>
            {codeToken.text}
          </span>
          {!isLast && <span fg={colors.text}>{'\n'}</span>}
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

      return (
        <span key={key}>
          <b>
            <span fg={headerColor}>
              {headingToken.tokens.map((t) => (
                <TokenToReactElements
                  key={getTokenKey(t, key)}
                  token={t}
                  tokenKey={getTokenKey(t, key)}
                  listDepth={listDepth}
                  compact={compact}
                />
              ))}
            </span>
          </b>
          {!isLast && <span fg={colors.text}>{'\n'}</span>}
        </span>
      );
    }

    case 'list': {
      const listToken = token as Tokens.List;
      const elements: ReactNode[] = [];

      listToken.items.forEach((item, itemIndex) => {
        const itemElements: ReactNode[] = [];
        const nestedElements: ReactNode[] = [];

        // Check if this is an in-progress task to filter out the marker
        const rawItem = (item as { raw?: string }).raw || '';
        const isInProgress = rawItem.includes('[⟳]');

        item.tokens.forEach((itemToken) => {
          if (itemToken.type === 'paragraph') {
            const paraToken = itemToken as Tokens.Paragraph;
            itemElements.push(
              ...paraToken.tokens
                .map((t) => {
                  const tKey = getTokenKey(t, key);
                  // Filter out [⟳] marker from text tokens
                  if (isInProgress && t.type === 'text') {
                    const textToken = t as Tokens.Text;
                    const cleanedText = textToken.text.replace(/\[⟳\]\s*/, '');
                    if (cleanedText) {
                      const cleanedToken = {
                        ...textToken,
                        text: cleanedText,
                        raw: cleanedText,
                      };
                      const cleanedKey = getTokenKey(cleanedToken, key);
                      return (
                        <TokenToReactElements
                          key={cleanedKey}
                          token={cleanedToken}
                          tokenKey={cleanedKey}
                          listDepth={listDepth}
                          compact={compact}
                        />
                      );
                    }
                    return null;
                  }
                  return (
                    <TokenToReactElements
                      key={tKey}
                      token={t}
                      tokenKey={tKey}
                      listDepth={listDepth}
                      compact={compact}
                    />
                  );
                })
                .filter(Boolean)
            );
          } else if (itemToken.type === 'list') {
            const nestedKey = getTokenKey(itemToken, key);
            nestedElements.push(
              <TokenToReactElements
                key={nestedKey}
                token={itemToken}
                tokenKey={nestedKey}
                listDepth={listDepth + 1}
                compact={compact}
              />
            );
          } else if (
            itemToken.type === 'text' &&
            'tokens' in itemToken &&
            itemToken.tokens
          ) {
            const textToken = itemToken as Token & { tokens?: Token[] };
            itemElements.push(
              ...(textToken.tokens || [])
                .map((t) => {
                  const tKey = getTokenKey(t, key);
                  // Filter out [⟳] marker from text tokens
                  if (isInProgress && t.type === 'text') {
                    const textToken = t as Tokens.Text;
                    const cleanedText = textToken.text.replace(/\[⟳\]\s*/, '');
                    if (cleanedText) {
                      const cleanedToken = {
                        ...textToken,
                        text: cleanedText,
                        raw: cleanedText,
                      };
                      const cleanedKey = getTokenKey(cleanedToken, key);
                      return (
                        <TokenToReactElements
                          key={cleanedKey}
                          token={cleanedToken}
                          tokenKey={cleanedKey}
                          listDepth={listDepth}
                          compact={compact}
                        />
                      );
                    }
                    return null;
                  }
                  return (
                    <TokenToReactElements
                      key={tKey}
                      token={t}
                      tokenKey={tKey}
                      listDepth={listDepth}
                      compact={compact}
                    />
                  );
                })
                .filter(Boolean)
            );
          } else {
            const itemKey = getTokenKey(itemToken, key);
            itemElements.push(
              <TokenToReactElements
                key={itemKey}
                token={itemToken}
                tokenKey={itemKey}
                listDepth={listDepth}
                compact={compact}
              />
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

        elements.push(
          // eslint-disable-next-line react/no-array-index-key, @eslint-react/no-array-index-key -- itemIndex is stable and semantically important for list items
          <span key={`${key}-item${itemIndex}`}>
            <span fg={colors.text}>{indent}</span>
            <span fg={colors.list}>{bullet}</span>
            {itemElements}
            {nestedElements.length > 0 && (
              <span fg={colors.text}>{'\n'}</span>
            )}
            {nestedElements}
          </span>
        );

        // Add newline after each item (unless it has nested elements, which add their own newlines)
        if (nestedElements.length === 0) {
          elements.push(
            // eslint-disable-next-line react/no-array-index-key, @eslint-react/no-array-index-key -- itemIndex is stable and semantically important for list items
            <span key={`${key}-item${itemIndex}-nl`} fg={colors.text}>
              {'\n'}
            </span>
          );
        }
      });

      // Remove the last newline if this is the last element in the markdown
      if (isLast && elements.length > 0) {
        elements.pop();
      }

      return <span key={key}>{elements}</span>;
    }

    case 'link': {
      const linkToken = token as Tokens.Link;
      const linkContent = linkToken.tokens.map((t) => {
        const tKey = getTokenKey(t, key);
        return (
          <TokenToReactElements
            key={tKey}
            token={t}
            tokenKey={tKey}
            listDepth={listDepth}
            compact={compact}
          />
        );
      });

      // In terminal, show both link text and URL
      const textContent = linkToken.tokens
        .map((t) => (t.type === 'text' ? (t as Tokens.Text).text : ''))
        .join('');

      if (textContent === linkToken.href) {
        return (
          <u key={key}>
            <span fg={colors.link}>{linkToken.href}</span>
          </u>
        );
      }

      return (
        <span key={key}>
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
        <span key={key}>
          {paragraphToken.tokens.map((t) => {
            const tKey = getTokenKey(t, key);
            return (
              <TokenToReactElements
                key={tKey}
                token={t}
                tokenKey={tKey}
                listDepth={listDepth}
                compact={compact}
              />
            );
          })}
          {!isLast && <span fg={colors.text}>{'\n'}</span>}
        </span>
      );
    }

    case 'hr': {
      return (
        <span key={key}>
          <span fg={colors.quote}>{'─'.repeat(60)}</span>
          {!isLast && <span fg={colors.text}>{'\n'}</span>}
        </span>
      );
    }

    case 'space': {
      // Normalize multiple blank lines to single newline
      return !isLast ?
          <span key={key} fg={colors.text}>
            {'\n'}
          </span>
        : null;
    }

    case 'br': {
      return !isLast ?
          <span key={key} fg={colors.text}>
            {'\n'}
          </span>
        : null;
    }

    case 'blockquote': {
      const blockquoteToken = token as Tokens.Blockquote;
      const content = blockquoteToken.tokens.map((t) => {
        const tKey = getTokenKey(t, key);
        return (
          <TokenToReactElements
            key={tKey}
            token={t}
            tokenKey={tKey}
            listDepth={listDepth}
            compact={compact}
          />
        );
      });

      // Get text content for admonition detection
      const getText = (tokens: Token[]): string => {
        return tokens
          .map((t) => {
            if (t.type === 'text') return (t as Tokens.Text).text;
            if (t.type === 'paragraph')
              return getText((t as Tokens.Paragraph).tokens);
            if ('tokens' in t && Array.isArray(t.tokens))
              return getText(t.tokens);
            return '';
          })
          .join('');
      };

      const quoteText = getText(blockquoteToken.tokens);
      const admonitionMatch = quoteText.match(
        /^\[!(NOTE|WARNING|ERROR|SUCCESS|INFO|TIP|CAUTION)\](.*)/is
      );

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
          <span key={key}>
            <span
              bg={admonitionColor}
              fg={themeColors.admonitionText}
            >{`${icon}${typeUpper}`}</span>
            <span fg={colors.text}>{'\n'}</span>
            {contentLines.map((line, i) => (
              <span key={i}> {/* eslint-disable-line react/no-array-index-key, @eslint-react/no-array-index-key -- Line position is semantically important */}
                <span fg={admonitionColor}>{'│ '}</span>
                <span fg={colors.text}>{line}</span>
                {i < contentLines.length - 1 && (
                  <span fg={colors.text}>{'\n'}</span>
                )}
              </span>
            ))}
            {!isLast && <span fg={colors.text}>{'\n'}</span>}
          </span>
        );
      }

      // Regular quote block
      const lines = quoteText.split('\n');

      return (
        <span key={key}>
          {lines.map((line, i) => (
            <span key={i}> {/* eslint-disable-line react/no-array-index-key, @eslint-react/no-array-index-key -- Line position is semantically important */}
              <span fg={colors.quoteBorder}>{'│ '}</span>
              <span fg={colors.quote}>{line}</span>
              {i < lines.length - 1 && <span fg={colors.text}>{'\n'}</span>}
            </span>
          ))}
          {!isLast && <span fg={colors.text}>{'\n'}</span>}
        </span>
      );
    }

    case 'table': {
      const tableToken = token as Tokens.Table;

      // Process header and rows
      const headerRow = tableToken.header.map((cell) => {
        const tokens = cell.tokens;
        return tokens
          .map((t) => {
            if (t.type === 'text') return (t as Tokens.Text).text;
            if ('tokens' in t && Array.isArray(t.tokens)) {
              return t.tokens
                .map((st) =>
                  st.type === 'text' ? (st as Tokens.Text).text : ''
                )
                .join('');
            }
            return '';
          })
          .join('');
      });

      const dataRows = tableToken.rows.map((row) =>
        row.map((cell) => {
          const tokens = cell.tokens;
          const text = tokens
            .map((t) => {
              if (t.type === 'text') return (t as Tokens.Text).text;
              if ('tokens' in t && Array.isArray(t.tokens)) {
                return t.tokens
                  .map((st) =>
                    st.type === 'text' ? (st as Tokens.Text).text : ''
                  )
                  .join('');
              }
              return '';
            })
            .join('');
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
        colWidths.map((w) => box.horizontal.repeat(w + 2)).join(box.topTee) +
        box.topRight;

      const headerSeparator =
        box.leftTee +
        colWidths.map((w) => box.horizontal.repeat(w + 2)).join(box.cross) +
        box.rightTee;

      const bottomBorder =
        box.bottomLeft +
        colWidths.map((w) => box.horizontal.repeat(w + 2)).join(box.bottomTee) +
        box.bottomRight;

      return (
        <span key={key}>
          <span fg={colors.quote}>{topBorder}</span>
          <span fg={colors.text}>{'\n'}</span>
          <span fg={colors.quote}>{box.vertical + ' '}</span>
          {headerRow.map((header, i) => (
            <span key={i}> {/* eslint-disable-line react/no-array-index-key, @eslint-react/no-array-index-key -- Column position is semantically important */}
              <b>
                <span fg={colors.header2}>{header.padEnd(colWidths[i])}</span>
              </b>
              {i < headerRow.length - 1 && (
                <span fg={colors.quote}>{' ' + box.vertical + ' '}</span>
              )}
            </span>
          ))}
          <span fg={colors.quote}>{' ' + box.vertical}</span>
          <span fg={colors.text}>{'\n'}</span>
          <span fg={colors.quote}>{headerSeparator}</span>
          <span fg={colors.text}>{'\n'}</span>
          {dataRows.map((row, rowIndex) => (
            <span key={rowIndex}> {/* eslint-disable-line react/no-array-index-key, @eslint-react/no-array-index-key -- Row position is semantically important */}
              <span fg={colors.quote}>{box.vertical + ' '}</span>
              {row.map((cell, colIndex) => (
                <span key={colIndex}> {/* eslint-disable-line react/no-array-index-key, @eslint-react/no-array-index-key -- Column position is semantically important */}
                  {cell.tokens.map((t) => {
                    const tKey = getTokenKey(t, key);
                    return (
                      <TokenToReactElements
                        key={tKey}
                        token={t}
                        tokenKey={tKey}
                        listDepth={listDepth}
                        compact={compact}
                      />
                    );
                  })}
                  {cell.text.length < colWidths[colIndex] && (
                    <span fg={colors.text}>
                      {' '.repeat(colWidths[colIndex] - cell.text.length)}
                    </span>
                  )}
                  {colIndex < row.length - 1 && (
                    <span fg={colors.quote}>{' ' + box.vertical + ' '}</span>
                  )}
                </span>
              ))}
              <span fg={colors.quote}>{' ' + box.vertical}</span>
              <span fg={colors.text}>{'\n'}</span>
            </span>
          ))}
          <span fg={colors.quote}>{bottomBorder}</span>
          {!isLast && <span fg={colors.text}>{'\n'}</span>}
        </span>
      );
    }

    default: {
      const rawText =
        'raw' in token ? token.raw
        : 'text' in token ? (token as Token & { text?: string }).text
        : '';
      if (rawText) {
        return (
          <span key={key} fg={colors.text}>
            {rawText}
          </span>
        );
      }
      return null;
    }
  }
}

type MarkdownProps = {
  content: string;
  compact?: boolean;
};

export function Markdown({
  content,
  compact = false,
}: MarkdownProps): ReactNode {
  try {
    if (content === '') {
      return null;
    }

    // Preprocess to handle [~] in-progress task markers
    // marked.js only recognizes [ ] and [x] as task list syntax
    // Convert [~] to a special marker we can detect later
    const processedContent = content.replace(/^(\s*-\s*)\[~\]/gm, '$1[⟳]');

    const tokens = marked.lexer(processedContent);
    return (
      <span>
        {tokens.map((token, i) => {
          const tokenKey = getTokenKey(token, `root-${i}`);
          return (
            <TokenToReactElements
              key={tokenKey}
              token={token}
              tokenKey={tokenKey}
              compact={compact}
              isLast={i === tokens.length - 1}
            />
          );
        })}
      </span>
    );
  } catch (error) {
    // Fallback to plain text if parsing fails
    return <span fg={colors.text}>{content}</span>;
  }
}
