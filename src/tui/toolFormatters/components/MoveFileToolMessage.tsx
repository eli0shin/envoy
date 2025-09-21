import { fg, bold } from '@opentui/core';
import { error, success, filePath, lightGray } from '../../theme.js';
import { extractResultText } from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemMoveFileArgs } from '../../toolTypes.js';

export function MoveFileToolMessage({
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract source and destination from args
  const typedArgs = args as FilesystemMoveFileArgs;
  const source = typedArgs?.source || '';
  const destination = typedArgs?.destination || '';

  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));

  return (
    <box flexDirection="column">
      <text>
        {bold(fg(lightGray)('Move File'))}
        {fg(filePath)(`(${source} → ${destination})`)}
      </text>
      {!isError && successText ?
        <text paddingLeft={2}>{fg(success)(`└ ${successText}`)}</text>
      : null}
      {isError && errorText ?
        <text paddingLeft={2}>{fg(error)(errorText)}</text>
      : null}
    </box>
  );
}
