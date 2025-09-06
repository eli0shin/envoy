export function parseMarkdown(content: string): string {
  // For now, return content as-is
  // OpenTUI formatting functions return TextChunk objects, not strings
  // so we can't use string replace with them directly
  return content;
}