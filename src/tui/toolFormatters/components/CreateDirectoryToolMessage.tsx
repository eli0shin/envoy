import { fg, bold } from '@opentui/core';
import { error, success, filePath, lightGray } from '../../theme.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemCreateDirectoryArgs } from '../../toolTypes.js';

export function CreateDirectoryToolMessage({
  args,
  result,
  isError,
}: ToolMessageComponentProps) {
  // Extract path from args
  const typedArgs = args as FilesystemCreateDirectoryArgs;
  const path = typedArgs?.path || '';

  // Get result message
  const getResultMessage = () => {
    if (
      !result ||
      isError ||
      typeof result !== 'object' ||
      result === null ||
      !('result' in result)
    ) {
      return null;
    }

    return (result as { result: string }).result;
  };

  const resultMessage = getResultMessage();

  return (
    <box flexDirection="column">
      <text>
        {bold(fg(lightGray)('Create Directory'))}
        {fg(filePath)(`(${path})`)}
      </text>
      {!isError && resultMessage ?
        <text paddingLeft={2}>{fg(success)(`└ ${resultMessage}`)}</text>
      : null}
      {isError ?
        <text paddingLeft={2}>{fg(error)(`${String(result)}`)}</text>
      : null}
    </box>
  );
}
