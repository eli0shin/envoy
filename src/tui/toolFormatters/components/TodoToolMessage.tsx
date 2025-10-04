import { lightGray } from '../../theme.js';
import { extractResultText } from '../../utils/toolFormatting.js';
import { Markdown } from '../../utils/markdown.js';
import type { ToolMessageComponentProps } from '../types.js';

export function TodoToolMessage({
  displayName,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract the result text
  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));
  
  // Use error text if error, otherwise use success text
  const todoListMarkdown = isError ? errorText : successText;

  return (
    <box flexDirection="column">
      <text>
        <b><span fg={lightGray}>{displayName || 'Todo'}</span></b>
      </text>
      {todoListMarkdown && !isError ? (
        <box flexDirection="column">
          <text>
            <Markdown content={todoListMarkdown} compact />
          </text>
        </box>
      ) : null}
      {isError && errorText ? (
        <text paddingLeft={2}>
          <span fg="red">{errorText}</span>
        </text>
      ) : null}
    </box>
  );
}
