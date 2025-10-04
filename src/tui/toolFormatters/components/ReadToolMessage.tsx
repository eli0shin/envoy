import {
  error,
  success,
  filePath as filePathColor,
  lightGray,
} from '../../theme.js';
import { extractResultText } from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';

export function ReadToolMessage({
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract the path argument (filesystem_read_text_file uses 'path')
  const { path } = args as { path: string };
  const filePath = path || 'Unknown file';

  // Count lines in the result (filesystem_read_text_file returns {result: "content"})
  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));
  const lineCount = !isError && successText ? successText.split('\n').length : 0;

  return (
    <box flexDirection="column">
      <text>
        <b><span fg={lightGray}>Read File</span></b>
        <span fg={filePathColor}>({filePath})</span>
      </text>
      {!isError && successText ?
        <text paddingLeft={2}>
          <span fg={success}>└ Read {lineCount} lines from {filePath}</span>
        </text>
      : null}
      {isError && errorText ?
        <text paddingLeft={2}><span fg={error}>{errorText}</span></text>
      : null}
    </box>
  );
}
