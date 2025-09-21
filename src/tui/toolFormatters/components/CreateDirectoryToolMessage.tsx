import { fg, bold } from '@opentui/core';
import { error, success, filePath, lightGray } from '../../theme.js';
import { extractResultText } from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemCreateDirectoryArgs } from '../../toolTypes.js';

export function CreateDirectoryToolMessage({
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract path from args
  const typedArgs = args as FilesystemCreateDirectoryArgs;
  const path = typedArgs?.path || '';

  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));

  return (
    <box flexDirection="column">
      <text>
        {bold(fg(lightGray)('Create Directory'))}
        {fg(filePath)(`(${path})`)}
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
