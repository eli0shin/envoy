export type FilePattern = {
  fullMatch: string;
  pattern: string;
  startIndex: number;
  endIndex: number;
};

export function parseFilePattern(
  input: string,
  cursorPosition: number
): FilePattern | null {
  // Find all @ symbols preceded by space/newline or at start
  const regex = /(^|[\s\n])@([^\s]*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    const matchStart = match.index! + match[1].length; // Start of @ symbol
    const matchEnd = match.index! + match[0].length; // End of the pattern

    // Check if cursor is within the @ pattern (not before or after it)
    if (matchStart <= cursorPosition && cursorPosition <= matchEnd) {
      return {
        fullMatch: match[0],
        pattern: match[2], // everything after @ until space
        startIndex: matchStart,
        endIndex: matchEnd,
      };
    }
  }

  return null;
}
