import { fg, bold } from '@opentui/core';
import { error, info, filePath, lightGray } from '../../theme.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemListDirectoryArgs } from '../../toolTypes.js';

export function ListDirectoryToolMessage({
  displayName,
  args,
  result,
  isError,
}: ToolMessageComponentProps) {
  // Extract path from args
  const typedArgs = args as FilesystemListDirectoryArgs;
  const path = typedArgs?.path || '.';

  // Parse the result to count entries
  let entryCount = 0;
  let dirCount = 0;
  let fileCount = 0;

  if (
    result &&
    !isError &&
    typeof result === 'object' &&
    result !== null &&
    'result' in result
  ) {
    const resultText = (result as { result: string }).result;
    const lines = resultText.split('\n').filter((line) => line.trim());

    // Count directories and files
    for (const line of lines) {
      if (line.includes('[DIR]')) {
        dirCount++;
      } else if (line.includes('[FILE]')) {
        fileCount++;
      }
    }
    entryCount = lines.length;
  }

  // Format the count message
  const getCountMessage = () => {
    if (entryCount === 0) return 'Empty directory';

    const parts = [];
    if (dirCount > 0) {
      parts.push(`${dirCount} ${dirCount === 1 ? 'directory' : 'directories'}`);
    }
    if (fileCount > 0) {
      parts.push(`${fileCount} ${fileCount === 1 ? 'file' : 'files'}`);
    }

    // If we couldn't parse the format, just show total count
    if (parts.length === 0) {
      return `${entryCount} ${entryCount === 1 ? 'item' : 'items'}`;
    }

    return `Listed ${parts.join(', ')}`;
  };

  return (
    <box flexDirection="column">
      <text>
        {bold(fg(lightGray)(displayName || 'List Directory'))}
        {fg(filePath)(`(${path})`)}
      </text>
      {!isError && result ?
        <text paddingLeft={2}>{fg(info)(`└ ${getCountMessage()}`)}</text>
      : null}
      {isError ?
        <text paddingLeft={2}>{fg(error)(`${String(result)}`)}</text>
      : null}
    </box>
  );
}
