export type FilePattern = {
  fullMatch: string;
  pattern: string;
  startIndex: number;
  endIndex: number;
};

export function parseFilePattern(input: string, cursorPosition: number): FilePattern | null {
  // Find all @ symbols preceded by space/newline or at start
  const regex = /(^|[\s\n])@([^\s]*)/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index! + match[0].length <= cursorPosition) {
      lastMatch = match;
    }
  }

  if (!lastMatch) return null;

  return {
    fullMatch: lastMatch[0],
    pattern: lastMatch[2], // everything after @ until space
    startIndex: lastMatch.index! + lastMatch[1].length,
    endIndex: lastMatch.index! + lastMatch[0].length
  };
}