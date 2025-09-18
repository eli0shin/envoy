import {
  formatToolName,
  formatToolArgs,
  truncateValue,
  formatMultilineResult,
} from '../../utils/toolFormatting.js';
import { fg, bold } from '@opentui/core';
import { error, info, filePath, lightGray } from '../../theme.js';
import type { ToolMessageComponentProps } from '../types.js';

export function DefaultToolMessage({
  toolName,
  displayName,
  args,
  result,
  isError,
  width,
}: ToolMessageComponentProps) {
  const formattedArgs = formatToolArgs(args);
  const toolDisplayName = displayName || formatToolName(toolName);

  // Extract the actual result string from { result: string } structure
  const resultText =
    result ?
      typeof result === 'object' && result !== null && 'result' in result ?
        (result as { result: string }).result
      : String(result)
    : '';

  return (
    <box flexDirection="column" width={width - 4}>
      <text>
        {bold(fg(lightGray)(toolDisplayName))}
        {formattedArgs ? fg(filePath)(`(${formattedArgs})`) : ''}
      </text>
      {resultText ?
        <text paddingLeft={2}>
          {fg(isError ? error : info)(
            formatMultilineResult(truncateValue(resultText), '└ ')
          )}
        </text>
      : null}
    </box>
  );
}
