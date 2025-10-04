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
        <b><span fg={lightGray}>Bash</span></b>
        <span fg={filePathColor}>({command})</span>
      </text>
      {!isError && successText ?
        <text paddingLeft={2}><span fg={success}>└ {getResultDisplay()}</span></text>
      : null}
      {isError && errorText ?
        <text paddingLeft={2}><span fg={error}>{errorText}</span></text>
      : null}
    </box>
  );
}
