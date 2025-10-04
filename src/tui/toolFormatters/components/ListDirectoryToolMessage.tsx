import { error, success, filePath, lightGray } from '../../theme.js';
import { extractResultText } from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemListDirectoryArgs } from '../../toolTypes.js';

export function ListDirectoryToolMessage({
  displayName,
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract path from args
  const typedArgs = args as FilesystemListDirectoryArgs;
  const path = typedArgs?.path || '.';

  // Parse the result to count entries
  let entryCount = 0;
  let dirCount = 0;
  let fileCount = 0;

  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));

  if (successText && !isError) {
    const resultText = successText;
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
        <b><span fg={lightGray}>{displayName || 'List Directory'}</span></b>
        <span fg={filePath}>({path})</span>
      </text>
      {!isError && successText ?
        <text paddingLeft={2}><span fg={success}>└ {getCountMessage()}</span></text>
      : null}
      {isError && errorText ?
        <text paddingLeft={2}><span fg={error}>{errorText}</span></text>
      : null}
    </box>
  );
}
