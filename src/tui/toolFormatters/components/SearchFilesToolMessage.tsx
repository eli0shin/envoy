import { error, success, filePath as filePathColor, lightGray } from '../../theme.js';
import { extractResultText, stripCwd } from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemSearchFilesArgs } from '../../toolTypes.js';

export function SearchFilesToolMessage({
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract path and pattern from args
  const typedArgs = args as FilesystemSearchFilesArgs;
  const path = stripCwd(typedArgs?.path || '.');
  const pattern = typedArgs?.pattern || '';

  // Count the number of results
  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));

  const getResultCount = () => {
    if (!successText || isError) {
      return 0;
    }

    const resultText = successText;
    const lines = resultText.split('\n').filter((line) => line.trim());
    return lines.length;
  };

  const resultCount = getResultCount();

  return (
    <box flexDirection="column">
      <text>
        <b><span fg={lightGray}>Search Files</span></b>
        <span fg={filePathColor}>({path} {pattern})</span>
      </text>
      {!isError && successText ?
        <text paddingLeft={2}>
          <span fg={success}>└ Found {resultCount} results</span>
        </text>
      : null}
      {isError && errorText ?
        <text paddingLeft={2}><span fg={error}>{errorText}</span></text>
      : null}
    </box>
  );
}
