import { fg, bold } from '@opentui/core';
import { error, success, filePath, lightGray } from '../../theme.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemMoveFileArgs } from '../../toolTypes.js';

export function MoveFileToolMessage({
  args,
  result,
  isError,
}: ToolMessageComponentProps) {
  // Extract source and destination from args
  const typedArgs = args as FilesystemMoveFileArgs;
  const source = typedArgs?.source || '';
  const destination = typedArgs?.destination || '';

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
        {bold(fg(lightGray)('Move File'))}
        {fg(filePath)(`(${source} → ${destination})`)}
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
