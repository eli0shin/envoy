import {
  error,
  success,
  filePath as filePathColor,
  lightGray,
} from '../../theme.js';
import { extractResultText, stripCwd } from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';

export function WriteToolMessage({
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract the path and content from args (filesystem_write_file uses both)
  const { path, content } = args as { path: string; content: string };
  const filePath = stripCwd(path || 'Unknown file');

  // Count lines in the content that was written
  const lineCount = content ? content.split('\n').length : 0;

  return (
    <box flexDirection="column">
      <text>
        <b><span fg={lightGray}>Write File</span></b>
        <span fg={filePathColor}>({filePath})</span>
      </text>
      {!isError ?
        <text paddingLeft={2}>
          <span fg={success}>└ Wrote {lineCount} lines to {filePath}</span>
        </text>
      : null}
      {isError ?
        <text paddingLeft={2}>
          <span fg={error}>{extractResultText(errorPayload ?? output) ||
              'Tool execution failed'}</span>
        </text>
      : null}
    </box>
  );
}
