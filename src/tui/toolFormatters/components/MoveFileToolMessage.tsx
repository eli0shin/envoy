import { error, success, filePath, lightGray } from '../../theme.js';
import { extractResultText, stripCwd } from '../../utils/toolFormatting.js';
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
  const source = stripCwd(typedArgs?.source || '');
  const destination = stripCwd(typedArgs?.destination || '');

  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));

  return (
    <box flexDirection="column">
      <text>
        <b><span fg={lightGray}>Move File</span></b>
        <span fg={filePath}>({source} → {destination})</span>
      </text>
      {!isError && successText ?
        <text paddingLeft={2}><span fg={success}>└ {successText}</span></text>
      : null}
      {isError && errorText ?
        <text paddingLeft={2}><span fg={error}>{errorText}</span></text>
      : null}
    </box>
  );
}
