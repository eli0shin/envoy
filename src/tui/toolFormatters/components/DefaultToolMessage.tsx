import {
  formatToolName,
  formatToolArgs,
  truncateValue,
  formatMultilineResult,
  extractResultText,
} from '../../utils/toolFormatting.js';
import { fg, bold } from '@opentui/core';
import { error, info, filePath, lightGray } from '../../theme.js';
import type { ToolMessageComponentProps } from '../types.js';

export function DefaultToolMessage({
  toolName,
  displayName,
  args,
  output,
  error: errorPayload,
  isError,
  width,
}: ToolMessageComponentProps) {
  const formattedArgs = formatToolArgs(args);
  const toolDisplayName = displayName || formatToolName(toolName);

  const successText = extractResultText(output);
  const errorTextValue = extractResultText(
    errorPayload ?? (isError ? output : undefined)
  );
  const displayText = isError ? errorTextValue || successText : successText || errorTextValue;

  return (
    <box flexDirection="column" width={width - 4}>
      <text>
        {bold(fg(lightGray)(toolDisplayName))}
        {formattedArgs ? fg(filePath)(`(${formattedArgs})`) : ''}
      </text>
      {displayText ?
        <text paddingLeft={2}>
          {fg(isError ? error : info)(
            formatMultilineResult(truncateValue(displayText), '└ ')
          )}
        </text>
      : null}
    </box>
  );
}
