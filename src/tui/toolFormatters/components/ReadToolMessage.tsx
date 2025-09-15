import { fg, bold } from '@opentui/core';
import type { ToolMessageComponentProps } from '../types.js';

export function ReadToolMessage({
  args,
  result,
  isError
}: ToolMessageComponentProps) {
  // Extract the path argument (filesystem_read_text_file uses 'path')
  const { path } = args as { path: string };
  const filePath = path || 'Unknown file';

  // Count lines in the result (filesystem_read_text_file returns {result: "content"})
  const lineCount = result && !isError && typeof result === 'object' && 'result' in result
    ? String(result.result).split('\n').length
    : 0;

  return (
    <box flexDirection="column">
      <text>
        {bold('Read File')}
        {fg('#A0A0A0')(`(${filePath})`)}
      </text>
      {!isError && result ? (
        <text paddingLeft={2}>
          {fg('#4ECDC4')(`└ Result: Read ${lineCount} lines from ${filePath}`)}
        </text>
      ) : null}
      {isError ? (
        <text paddingLeft={2}>
          {fg('#FF6B6B')(`Error: ${String(result)}`)}
        </text>
      ) : null}
    </box>
  );
}