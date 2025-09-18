import { fg, bold } from '@opentui/core';
import { error, success, filePath as filePathColor, lightGray } from '../../theme.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { ShellRunCommandArgs } from '../../toolTypes.js';

export function BashToolMessage({
  args,
  result,
  isError,
}: ToolMessageComponentProps) {
  // Extract command from args
  const typedArgs = args as ShellRunCommandArgs;
  const command = typedArgs?.command || '';

  // Process result to show last 20 lines
  const getResultDisplay = () => {
    if (
      !result ||
      isError ||
      typeof result !== 'object' ||
      result === null ||
      !('result' in result)
    ) {
      return null;
    }

    const resultText = (result as { result: string }).result;
    const lines = resultText.split('\n');
    const lineCount = lines.length;

    if (lineCount > 20) {
      return `Last 20 of ${lineCount} lines`;
    }

    return `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`;
  };

  return (
    <box flexDirection="column">
      <text>
        {bold(fg(lightGray)('Bash'))}
        {fg(filePathColor)(`(${command})`)}
      </text>
      {!isError && result ?
        <text paddingLeft={2}>{fg(success)(`└ ${getResultDisplay()}`)}</text>
      : null}
      {isError ?
        <text paddingLeft={2}>{fg(error)(`${String(result)}`)}</text>
      : null}
    </box>
  );
}
