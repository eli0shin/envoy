import { fg, bold } from '@opentui/core';
import {
  error,
  success,
  filePath as filePathColor,
  lightGray,
} from '../../theme.js';
import { extractResultText } from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';

export function WriteToolMessage({
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract the path and content from args (filesystem_write_file uses both)
  const { path, content } = args as { path: string; content: string };
  const filePath = path || 'Unknown file';

  // Count lines in the content that was written
  const lineCount = content ? content.split('\n').length : 0;

  return (
    <box flexDirection="column">
      <text>
        {bold(fg(lightGray)('Write File'))}
        {fg(filePathColor)(`(${filePath})`)}
      </text>
      {!isError ?
        <text paddingLeft={2}>
          {fg(success)(`└ Wrote ${lineCount} lines to ${filePath}`)}
        </text>
      : null}
      {isError ?
        <text paddingLeft={2}>
          {fg(error)(
            extractResultText(errorPayload ?? output) ||
              'Tool execution failed'
          )}
        </text>
      : null}
    </box>
  );
}
