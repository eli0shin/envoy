import { error, success, filePath, lightGray } from '../../theme.js';
import { extractResultText, stripCwd } from '../../utils/toolFormatting.js';
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
  const path = stripCwd(typedArgs?.path || '');

  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));

  return (
    <box flexDirection="column">
      <text>
        <b><span fg={lightGray}>Create Directory</span></b>
        <span fg={filePath}>({path})</span>
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
