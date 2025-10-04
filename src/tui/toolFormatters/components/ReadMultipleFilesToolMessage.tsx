import {
  error,
  success,
  filePath as filePathColor,
  lightGray,
} from '../../theme.js';
import {
  formatMultilineResult,
  extractResultText,
} from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemReadMultipleFilesArgs } from '../../toolTypes.js';

export function ReadMultipleFilesToolMessage({
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract the paths argument
  const { paths } = args as FilesystemReadMultipleFilesArgs;

  const successText = extractResultText(output);
  const errorText = extractResultText(errorPayload ?? (isError ? output : undefined));

  // Parse the result to extract individual file contents
  const parseResult = (resultText: string | null): Map<string, number> | null => {
    if (!resultText || isError) return null;

    const fileLineCounts = new Map<string, number>();

    // Split by the separator pattern "filename:\n"
    const sections = resultText.split(/\n---\n/);

    for (const section of sections) {
      // Extract filename from the first line (format: "filename.ext:")
      const lines = section.split('\n');
      if (lines.length > 0) {
        const firstLine = lines[0];
        const match = firstLine.match(/^(.+):$/);
        if (match) {
          const fileName = match[1];
          // Count lines excluding the filename header
          const contentLines = lines.slice(1);
          fileLineCounts.set(fileName, contentLines.length);
        }
      }
    }

    // If parsing didn't work, fall back to counting lines for each path
    if (fileLineCounts.size === 0 && paths) {
      // Assume equal distribution of lines if we can't parse
      const totalLines = resultText.split('\n').length;
      const linesPerFile = Math.floor(totalLines / paths.length);
      paths.forEach((path) => {
        fileLineCounts.set(path, linesPerFile);
      });
    }

    return fileLineCounts;
  };

  const fileLineCounts = parseResult(successText ?? null);
  const formattedPaths =
    paths && paths.length > 0 ?
      paths.map((p) => p.split('/').pop() || p).join(', ')
    : 'Unknown files';

  return (
    <box flexDirection="column">
      <text>
        <b><span fg={lightGray}>Read Files</span></b>
        <span fg={filePathColor}>({formattedPaths})</span>
      </text>
      {!isError && fileLineCounts && fileLineCounts.size > 0 ?
        Array.from(fileLineCounts.entries()).map(([fileName, lineCount]) => (
          <text key={fileName} paddingLeft={2}>
            <span fg={success}>└ Read {lineCount} lines from {fileName}</span>
          </text>
        ))
      : null}
      {isError && errorText ?
        <text paddingLeft={2}>
          <span fg={error}>{formatMultilineResult(errorText, '└ ')}</span>
        </text>
      : null}
      {!isError && successText && (!fileLineCounts || fileLineCounts.size === 0) ?
        <text paddingLeft={2}>
          <span fg={success}>└ Read {paths?.length || 0} files</span>
        </text>
      : null}
    </box>
  );
}
