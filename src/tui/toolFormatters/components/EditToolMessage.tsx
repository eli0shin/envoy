import {
  error,
  success,
  filePath as filePathColor,
  diffAddition,
  diffDeletion,
  backgrounds,
  lightGray,
} from '../../theme.js';
import {
  formatMultilineResult,
  extractResultText,
} from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemEditFileArgs } from '../../toolTypes.js';

// Helper function to parse diff change counts
function parseDiffCounts(diffText: string) {
  const lines = diffText.split('\n');
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }

  return { additions, deletions };
}

export function EditToolMessage({
  displayName,
  args,
  output,
  error: errorPayload,
  isError,
  width,
}: ToolMessageComponentProps) {
  // Extract path from args - handle both 'path' and 'file_path' keys
  const typedArgs = args as FilesystemEditFileArgs;
  const filePath = typedArgs?.path || 'unknown';

  const successText = extractResultText(output);
  const errorTextValue = extractResultText(
    errorPayload ?? (isError ? output : undefined)
  );

  const combinedForError = errorTextValue || successText || '';
  const hasErrorPrefix = combinedForError.startsWith('Error:');
  const actualError = Boolean(isError) || hasErrorPrefix;
  const cleanErrorMessage = hasErrorPrefix ?
    combinedForError.substring(6).trim()
  : combinedForError;
  const displayedErrorMessage =
    cleanErrorMessage || (actualError ? 'Tool execution failed' : '');

  // Parse the diff result if present
  const renderDiff = () => {
    if (!successText || actualError) return null;

    let diffText = successText;

    if (!diffText) return null;

    // Parse diff change counts before cleaning
    const { additions, deletions } = parseDiffCounts(diffText);

    // Convert absolute path to relative if it contains the project
    let displayPath = filePath;
    const projectMatch = filePath.match(/.*\/(src\/.+)$/);
    if (projectMatch) {
      displayPath = projectMatch[1];
    }

    // Aggressively remove all backtick-based diff wrappers
    // First, trim whitespace
    diffText = diffText.trim();

    // Remove leading backticks with 'diff' - handle any number of backticks
    // This matches ```diff, ````diff, `diff, etc.
    if (diffText.match(/^`+diff/)) {
      // Find where the first newline is after the backticks
      const firstNewline = diffText.indexOf('\n');
      if (firstNewline !== -1) {
        diffText = diffText.substring(firstNewline + 1);
      } else {
        // No newline found, just remove the backticks and 'diff'
        diffText = diffText.replace(/^`+diff\s*/, '');
      }
    }

    // Also check for just backticks at the start without 'diff'
    if (diffText.startsWith('```')) {
      const firstNewline = diffText.indexOf('\n');
      if (firstNewline !== -1 && firstNewline <= 10) {
        // Only if newline is close to start
        diffText = diffText.substring(firstNewline + 1);
      }
    }

    // Remove trailing backticks - any number of them
    // This handles ```, `, ````, etc. at the end
    diffText = diffText.replace(/`+\s*$/, '');

    // Final trim to clean up any remaining whitespace
    diffText = diffText.trim();

    // Split into lines and render with colors
    const lines = diffText.split('\n');

    return (
      <box flexDirection="column">
        {displayPath && (additions > 0 || deletions > 0) ?
          <text paddingLeft={2}>
            <span fg={success}>└ Updated {displayPath} with {additions} additions and {deletions} deletions</span>
          </text>
        : null}
        <box
          flexDirection="column"
          backgroundColor={backgrounds.diffArea}
          padding={1}
        >
          {lines.map((line, i) => {
            // Skip empty lines at the end
            if (i === lines.length - 1 && !line) return null;

            // Skip preamble lines and hunk headers
            if (
              line.startsWith('Index:') ||
              line.startsWith('===') ||
              line.startsWith('---') ||
              line.startsWith('+++') ||
              line.startsWith('@@')
            ) {
              return null;
            }

            // Create unique key using line content and position
            const lineKey = `diff-line-${i}`;

            // Determine line styling based on prefix
            if (line.startsWith('+')) {
              // Addition - green background, strip the + prefix
              const lineContent = line.substring(1);
              return (
                <text key={lineKey}><span bg={diffAddition}>{lineContent}</span></text>
              );
            } else if (line.startsWith('-')) {
              // Deletion - red background, strip the - prefix
              const lineContent = line.substring(1);
              return (
                <text key={lineKey}><span bg={diffDeletion}>{lineContent}</span></text>
              );
            } else {
              // Context line or other
              const lineContent =
                line.startsWith(' ') ? line.substring(1) : line;
              return <text key={lineKey}>{lineContent}</text>;
            }
          })}
        </box>
      </box>
    );
  };

  return (
    <box flexDirection="column">
      <text>
        <b><span fg={lightGray}>{displayName || 'Edit File'}</span></b>
        <span fg={filePathColor}>({filePath})</span>
      </text>
      {!actualError ? renderDiff() : null}
      {actualError ?
        <text paddingLeft={2}>
          <span fg={error}>{formatMultilineResult(displayedErrorMessage, '└ ')}</span>
        </text>
      : null}
    </box>
  );
}
