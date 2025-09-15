import { fg, bg, bold } from '@opentui/core';
import type { ToolMessageComponentProps } from '../types.js';
import type { FilesystemEditFileArgs } from '../../toolTypes.js';

// Helper function to wrap a line into segments that fit within maxWidth
function wrapLine(line: string, maxWidth: number): string[] {
  if (maxWidth <= 0 || line.length <= maxWidth) return [line];

  const segments: string[] = [];
  const words = line.split(' ');
  let currentSegment = '';

  for (const word of words) {
    const testSegment = currentSegment ? `${currentSegment} ${word}` : word;

    if (testSegment.length <= maxWidth) {
      currentSegment = testSegment;
    } else {
      if (currentSegment) {
        segments.push(currentSegment);
        currentSegment = word;
      } else {
        // Word is longer than maxWidth, hard break it
        let remaining = word;
        while (remaining.length > maxWidth) {
          segments.push(remaining.substring(0, maxWidth));
          remaining = remaining.substring(maxWidth);
        }
        if (remaining) {
          currentSegment = remaining;
        }
      }
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

export function EditToolMessage({
  displayName,
  args,
  result,
  isError,
  width,
}: ToolMessageComponentProps) {
  // Extract path from args - handle both 'path' and 'file_path' keys
  const typedArgs = args as FilesystemEditFileArgs;
  const filePath = typedArgs?.path || 'unknown';

  // Parse the diff result if present
  const renderDiff = () => {
    if (!result || isError) return null;

    // Handle result structure - it might be { result: string } or just string
    let diffText =
      typeof result === 'object' && result !== null && 'result' in result ?
        (result as { result: string }).result
      : String(result);

    if (!diffText) return null;

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
      if (firstNewline !== -1 && firstNewline <= 10) { // Only if newline is close to start
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

    // Calculate available width for diff content
    // Subtract padding and margins from total width
    const maxLineWidth = width ? width - 10 : 80; // Default to 80 if no width provided

    return (
      <box flexDirection="column">
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
            const segments = wrapLine(lineContent, maxLineWidth);

            return segments.map((segment, segmentIdx) => {
              // Use segment content hash for uniqueness
              const segmentKey = `${lineKey}-add-${segment.substring(0, 10)}-${segmentIdx}`;
              return (
                <text key={segmentKey}>
                  {bg('#2d4a2b')(segment)}
                </text>
              );
            });
          } else if (line.startsWith('-')) {
            // Deletion - red background, strip the - prefix
            const lineContent = line.substring(1);
            const segments = wrapLine(lineContent, maxLineWidth);

            return segments.map((segment, segmentIdx) => {
              // Use segment content hash for uniqueness
              const segmentKey = `${lineKey}-del-${segment.substring(0, 10)}-${segmentIdx}`;
              return (
                <text key={segmentKey}>
                  {bg('#4a2b2d')(segment)}
                </text>
              );
            });
          } else {
            // Context line or other
            const segments = wrapLine(line, maxLineWidth);

            return segments.map((segment, segmentIdx) => {
              // Use segment content hash for uniqueness
              const segmentKey = `${lineKey}-ctx-${segment.substring(0, 10)}-${segmentIdx}`;
              return (
                <text key={segmentKey}>
                  {segment}
                </text>
              );
            });
          }
        })}
      </box>
    );
  };

  return (
    <box flexDirection="column">
      <text>
        {bold(displayName || 'Edit File')}
        {fg('#A0A0A0')(`(${filePath})`)}
      </text>
      {renderDiff()}
      {isError ?
        <text>{fg('#FF6B6B')(`Error: ${String(result)}`)}</text>
      : null}
    </box>
  );
}

