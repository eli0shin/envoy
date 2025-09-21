import { fg, bold } from '@opentui/core';
import { error, success, filePath as filePathColor, lightGray } from '../../theme.js';
import { extractResultText } from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { ShellRunCommandArgs } from '../../toolTypes.js';

export function BashToolMessage({
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract command from args
  const typedArgs = args as ShellRunCommandArgs;
  const command = typedArgs?.command || '';

  // Process result to show last 20 lines
  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));

  const getResultDisplay = () => {
    if (!successText || isError) {
      return null;
    }

    const resultText = successText;
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
      {!isError && successText ?
        <text paddingLeft={2}>{fg(success)(`└ ${getResultDisplay()}`)}</text>
      : null}
      {isError && errorText ?
        <text paddingLeft={2}>{fg(error)(errorText)}</text>
      : null}
    </box>
  );
}
