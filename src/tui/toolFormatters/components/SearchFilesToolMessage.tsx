import { fg, bold } from '@opentui/core';
import { error, success, filePath as filePathColor, lightGray } from '../../theme.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemSearchFilesArgs } from '../../toolTypes.js';

export function SearchFilesToolMessage({
  args,
  result,
  isError,
}: ToolMessageComponentProps) {
  // Extract path and pattern from args
  const typedArgs = args as FilesystemSearchFilesArgs;
  const path = typedArgs?.path || '.';
  const pattern = typedArgs?.pattern || '';

  // Count the number of results
  const getResultCount = () => {
    if (
      !result ||
      isError ||
      typeof result !== 'object' ||
      result === null ||
      !('result' in result)
    ) {
      return 0;
    }

    const resultText = (result as { result: string }).result;
    const lines = resultText.split('\n').filter((line) => line.trim());
    return lines.length;
  };

  const resultCount = getResultCount();

  return (
    <box flexDirection="column">
      <text>
        {bold(fg(lightGray)('Search Files'))}
        {fg(filePathColor)(`(${path} ${pattern})`)}
      </text>
      {!isError && result ?
        <text paddingLeft={2}>
          {fg(success)(`└ Found ${resultCount} results`)}
        </text>
      : null}
      {isError ?
        <text paddingLeft={2}>{fg(error)(`${String(result)}`)}</text>
      : null}
    </box>
  );
}
