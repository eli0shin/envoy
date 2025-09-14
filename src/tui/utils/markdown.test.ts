import { describe, it, expect, vi } from 'vitest';

// Mock OpenTUI imports since they use Bun FFI which doesn't work in Node.js tests
vi.mock('@opentui/core', () => {
  type MockTextChunk = {
    __isChunk: true;
    text: Uint8Array;
    plainText: string;
    fg?: string;
    bg?: string;
    attributes?: number;
  };

  class MockStyledText {
    chunks: MockTextChunk[];

    constructor(chunks: MockTextChunk[]) {
      this.chunks = chunks;
    }
  }

  const createMockChunk = (
    text: string,
    attributes?: number,
    fg?: string,
    bg?: string
  ): MockTextChunk => ({
    __isChunk: true as const,
    text: new TextEncoder().encode(text),
    plainText: text,
    attributes,
    fg,
    bg,
  });

  return {
    StyledText: MockStyledText,
    stringToStyledText: (content: string) =>
      new MockStyledText([createMockChunk(content)]),
    bold: (text: string | MockTextChunk) => {
      if (typeof text === 'string') {
        return createMockChunk(text, 1);
      }
      return { ...text, attributes: (text.attributes || 0) | 1 };
    },
    italic: (text: string | MockTextChunk) => {
      if (typeof text === 'string') {
        return createMockChunk(text, 2);
      }
      return { ...text, attributes: (text.attributes || 0) | 2 };
    },
    underline: (text: string | MockTextChunk) => {
      if (typeof text === 'string') {
        return createMockChunk(text, 4);
      }
      return { ...text, attributes: (text.attributes || 0) | 4 };
    },
    strikethrough: (text: string | MockTextChunk) => {
      if (typeof text === 'string') {
        return createMockChunk(text, 8);
      }
      return { ...text, attributes: (text.attributes || 0) | 8 };
    },
    fg: (color: string) => (text: string | MockTextChunk) => {
      if (typeof text === 'string') {
        return createMockChunk(text, undefined, color);
      }
      return { ...text, fg: color };
    },
    bg: (color: string) => (text: string | MockTextChunk) => {
      if (typeof text === 'string') {
        return createMockChunk(text, undefined, undefined, color);
      }
      return { ...text, bg: color };
    },
  };
});

import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('should handle plain text', () => {
    const result = parseMarkdown('Hello world');
    expect(result).toBeDefined();
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].plainText).toBe('Hello world');
  });

  it('should handle bold text', () => {
    const result = parseMarkdown('This is **bold** text');
    expect(result).toBeDefined();

    // The text should be transformed: markdown syntax removed, content preserved
    const actualText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(actualText).toBe('This is bold text');

    // Should have exactly 3 chunks: "This is ", "bold", " text"
    expect(result.chunks).toHaveLength(3);
    expect(result.chunks[0].plainText).toBe('This is ');
    expect(result.chunks[1].plainText).toBe('bold');
    expect(result.chunks[1].attributes).toBe(1); // Bold attribute
    expect(result.chunks[2].plainText).toBe(' text');
  });

  it('should handle italic text', () => {
    const result = parseMarkdown('This is *italic* text');
    expect(result).toBeDefined();

    // Text should be transformed: *italic* -> italic with styling
    const actualText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(actualText).toBe('This is italic text');

    expect(result.chunks).toHaveLength(3);
    expect(result.chunks[0].plainText).toBe('This is ');
    expect(result.chunks[1].plainText).toBe('italic');
    expect(result.chunks[1].attributes).toBe(2); // Italic attribute
    expect(result.chunks[2].plainText).toBe(' text');
  });

  it('should handle strikethrough text', () => {
    const result = parseMarkdown('This is ~~strikethrough~~ text');
    expect(result).toBeDefined();

    // Text should be transformed: ~~strikethrough~~ -> strikethrough with styling
    const actualText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(actualText).toBe('This is strikethrough text');

    expect(result.chunks).toHaveLength(3);
    expect(result.chunks[0].plainText).toBe('This is ');
    expect(result.chunks[1].plainText).toBe('strikethrough');
    expect(result.chunks[1].attributes).toBe(8); // Strikethrough attribute
    expect(result.chunks[2].plainText).toBe(' text');
  });

  it('should handle inline code', () => {
    const result = parseMarkdown('This is `code` text');
    expect(result).toBeDefined();

    // Text should be transformed: `code` -> code with padding and background styling
    const actualText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(actualText).toBe('This is  code  text');

    expect(result.chunks).toHaveLength(3);
    expect(result.chunks[0].plainText).toBe('This is ');
    expect(result.chunks[1].plainText).toBe(' code '); // Code gets padding spaces
    expect(result.chunks[1].bg).toBeDefined(); // Should have background color
    expect(result.chunks[2].plainText).toBe(' text');
  });

  it('should handle code blocks', () => {
    const codeBlock =
      '```\nfunction hello() {\n  console.log("Hello");\n}\n```';
    const result = parseMarkdown(codeBlock);
    expect(result).toBeDefined();

    // Code block should be transformed: ``` markers removed, content preserved with padding
    const actualText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(actualText).toBe(
      '\nfunction hello() {\n  console.log("Hello");\n}\n'
    );

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].plainText).toBe(
      '\nfunction hello() {\n  console.log("Hello");\n}\n'
    );
    expect(result.chunks[0].bg).toBeDefined(); // Should have background color
  });

  it('should handle headers', () => {
    const result = parseMarkdown('# Header 1\n## Header 2\n### Header 3');
    expect(result).toBeDefined();

    // Find the header chunks (they should have foreground colors)
    const headerChunks = result.chunks.filter((chunk) => chunk.fg);
    expect(headerChunks.length).toBeGreaterThanOrEqual(3); // At least 3 header chunks

    // Check that we have the header content somewhere
    const allText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(allText).toContain('Header 1');
    expect(allText).toContain('Header 2');
    expect(allText).toContain('Header 3');
  });

  it('should handle lists', () => {
    const result = parseMarkdown('- Item 1\n- Item 2\n1. Numbered item');
    expect(result).toBeDefined();

    // Find chunks with bullet points
    const listChunks = result.chunks.filter((chunk) =>
      chunk.plainText.includes('•')
    );
    expect(listChunks.length).toBeGreaterThan(0);

    // Check that list content is present
    const allText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(allText).toContain('• Item 1');
    expect(allText).toContain('• Item 2');
  });

  it('should handle links with URL display', () => {
    const result = parseMarkdown(
      'Visit [OpenTUI](https://example.com) for more info'
    );
    expect(result).toBeDefined();

    // Should show both link text and URL
    const allText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(allText).toBe('Visit OpenTUI (https://example.com) for more info');

    expect(result.chunks).toHaveLength(4);
    expect(result.chunks[0].plainText).toBe('Visit ');
    expect(result.chunks[1].plainText).toBe('OpenTUI');
    expect(result.chunks[1].attributes).toBe(4); // Underline attribute
    expect(result.chunks[2].plainText).toBe(' (https://example.com)');
    expect(result.chunks[3].plainText).toBe(' for more info');
  });

  it('should handle links where text equals URL', () => {
    const result = parseMarkdown('Visit https://example.com for more info');
    expect(result).toBeDefined();

    // When link text equals URL, show URL only once
    const allText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(allText).toBe('Visit https://example.com for more info');

    expect(result.chunks).toHaveLength(3);
    expect(result.chunks[0].plainText).toBe('Visit ');
    expect(result.chunks[1].plainText).toBe('https://example.com');
    expect(result.chunks[1].attributes).toBe(4); // Underline attribute
    expect(result.chunks[2].plainText).toBe(' for more info');
  });

  it('should handle mixed formatting', () => {
    const result = parseMarkdown('This has **bold** and *italic* and `code`');
    expect(result).toBeDefined();

    // Should transform all markdown: **bold** -> bold, *italic* -> italic, `code` -> code with padding
    const actualText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(actualText).toBe('This has bold and italic and  code ');

    // Should have 6 chunks (no final empty chunk since input ends with code)
    expect(result.chunks).toHaveLength(6);
    expect(result.chunks[0].plainText).toBe('This has ');
    expect(result.chunks[1].plainText).toBe('bold');
    expect(result.chunks[1].attributes).toBe(1); // Bold
    expect(result.chunks[2].plainText).toBe(' and ');
    expect(result.chunks[3].plainText).toBe('italic');
    expect(result.chunks[3].attributes).toBe(2); // Italic
    expect(result.chunks[4].plainText).toBe(' and ');
    expect(result.chunks[5].plainText).toBe(' code '); // Code with padding
    expect(result.chunks[5].bg).toBeDefined(); // Code background
  });

  it('should handle nested formatting gracefully', () => {
    // Test potentially problematic cases - nested formatting may not work perfectly
    // but should not crash and should handle the outer formatting
    const result = parseMarkdown('**bold with `code` inside**');
    expect(result).toBeDefined();
    expect(result.chunks).toBeDefined();

    // Should not crash and should produce some reasonable output
    // Note: Perfect nested formatting is complex with regex-based parsing
    const allText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(allText).toContain('bold with');
    expect(allText).toContain('inside');
  });

  it('should handle empty input', () => {
    const result = parseMarkdown('');
    expect(result).toBeDefined();

    // Empty input should produce empty output
    const actualText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(actualText).toBe('');

    expect(result.chunks).toHaveLength(0);
  });

  it('should handle malformed markdown gracefully', () => {
    const result = parseMarkdown('**unclosed bold and `unclosed code');
    expect(result).toBeDefined();
    // Should fall back to plain text or handle gracefully
    expect(result.chunks.length).toBeGreaterThan(0);

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(allText).toContain('unclosed bold');
    expect(allText).toContain('unclosed code');
  });

  it('should preserve line breaks in text', () => {
    const result = parseMarkdown('Line 1\nLine 2\nLine 3');
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(allText).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should preserve newlines after headers and lists', () => {
    const input = '# Header 1\n\nSome text\n\n- Item 1\n- Item 2\n\nMore text';
    const result = parseMarkdown(input);
    expect(result).toBeDefined();

    const actualText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Just check that the content is mostly correct with proper line structure
    expect(actualText).toContain('Header 1');
    expect(actualText).toContain('Some text');
    expect(actualText).toContain('• Item 1');
    expect(actualText).toContain('• Item 2');
    expect(actualText).toContain('More text');

    // Verify that styling is applied
    const headerChunks = result.chunks.filter(
      (chunk) => chunk.attributes === 1
    ); // Bold attribute
    expect(headerChunks.length).toBeGreaterThan(0);

    const listChunks = result.chunks.filter((chunk) =>
      chunk.plainText.includes('•')
    );
    expect(listChunks).toHaveLength(2);
  });

  it('should handle multiple code blocks', () => {
    const input =
      '```\nfirst block\n```\n\nSome text\n\n```\nsecond block\n```';
    const result = parseMarkdown(input);
    expect(result).toBeDefined();

    // Should transform: remove ``` markers, preserve all content
    const actualText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(actualText).toBe('\nfirst block\n\n\nSome text\n\n\nsecond block\n');

    // The AST parser may create more granular chunks (e.g., separate space tokens)
    // What matters is that the text is preserved and code blocks have styling
    expect(result.chunks.length).toBeGreaterThan(3);

    // Find code chunks (they should have background styling)
    const codeChunks = result.chunks.filter((chunk) => chunk.bg);
    expect(codeChunks).toHaveLength(2);

    // Verify code content is preserved
    expect(codeChunks[0].plainText).toContain('first block');
    expect(codeChunks[1].plainText).toContain('second block');

    // Verify normal text is preserved somewhere
    expect(actualText).toContain('Some text');
  });

  it('should handle simple tables', () => {
    const tableMarkdown = `
| Name | Age | City |
|------|-----|------|
| John | 25  | NYC  |
| Jane | 30  | LA   |
    `.trim();

    const result = parseMarkdown(tableMarkdown);
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should contain table content
    expect(allText).toContain('Name');
    expect(allText).toContain('Age');
    expect(allText).toContain('City');
    expect(allText).toContain('John');
    expect(allText).toContain('Jane');
    expect(allText).toContain('25');
    expect(allText).toContain('30');
    expect(allText).toContain('NYC');
    expect(allText).toContain('LA');

    // Should contain box drawing characters for table formatting
    expect(allText).toContain('┌'); // Top left corner
    expect(allText).toContain('┐'); // Top right corner
    expect(allText).toContain('└'); // Bottom left corner
    expect(allText).toContain('┘'); // Bottom right corner
    expect(allText).toContain('│'); // Vertical lines
    expect(allText).toContain('─'); // Horizontal lines
    expect(allText).toContain('┬'); // Top tee
    expect(allText).toContain('├'); // Left tee
    expect(allText).toContain('┤'); // Right tee
    expect(allText).toContain('┴'); // Bottom tee
    expect(allText).toContain('┼'); // Cross

    // Should have proper line structure (top border, header, separator, 2 data rows, bottom border)
    const lines = allText.split('\n').filter((line) => line.trim() !== '');
    expect(lines.length).toBeGreaterThanOrEqual(6);
  });

  it('should handle tables with different column widths', () => {
    const tableMarkdown = `
| Short | Very Long Header Name | X |
|-------|----------------------|---|
| A     | This is a long cell  | 1 |
| B     | Short                | 2 |
    `.trim();

    const result = parseMarkdown(tableMarkdown);
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should contain all content
    expect(allText).toContain('Short');
    expect(allText).toContain('Very Long Header Name');
    expect(allText).toContain('This is a long cell');

    // Should be properly formatted as table with box drawing characters
    expect(allText).toContain('┌');
    expect(allText).toContain('│');
    expect(allText).toContain('─');

    const lines = allText.split('\n').filter((line) => line.trim() !== '');
    expect(lines.length).toBeGreaterThanOrEqual(6); // Top, header, separator, 2 data rows, bottom
  });

  it('should handle nested formatting in lists', () => {
    const result = parseMarkdown(
      '- Item with **bold** text\n- Item with *italic* text\n- Item with `code`'
    );
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should contain bullet points and formatted text
    expect(allText).toContain('• Item with bold text');
    expect(allText).toContain('• Item with italic text');
    expect(allText).toContain('• Item with  code '); // Code gets padding

    // Should have formatting applied
    const boldChunks = result.chunks.filter((chunk) => chunk.attributes === 1); // Bold
    const italicChunks = result.chunks.filter(
      (chunk) => chunk.attributes === 2
    ); // Italic
    const codeChunks = result.chunks.filter((chunk) => chunk.bg); // Code background

    expect(boldChunks.length).toBeGreaterThan(0);
    expect(italicChunks.length).toBeGreaterThan(0);
    expect(codeChunks.length).toBeGreaterThan(0);

    // Verify specific formatted content
    expect(boldChunks.some((chunk) => chunk.plainText === 'bold')).toBe(true);
    expect(italicChunks.some((chunk) => chunk.plainText === 'italic')).toBe(
      true
    );
  });

  it('should handle nested formatting in table cells', () => {
    const tableMarkdown = `
| Name | Status | Notes |
|------|--------|-------|
| **John** | *Active* | Has \`admin\` rights |
| Jane | **Inactive** | Regular user |
    `.trim();

    const result = parseMarkdown(tableMarkdown);
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should contain table content with formatting removed from plain text
    expect(allText).toContain('John');
    expect(allText).toContain('Active');
    expect(allText).toContain('admin');
    expect(allText).toContain('Jane');
    expect(allText).toContain('Inactive');

    // Should have proper table structure with box drawing characters
    expect(allText).toContain('┌');
    expect(allText).toContain('│');

    // Should have formatting applied
    const boldChunks = result.chunks.filter((chunk) => chunk.attributes === 1); // Bold
    const italicChunks = result.chunks.filter(
      (chunk) => chunk.attributes === 2
    ); // Italic
    const codeChunks = result.chunks.filter((chunk) => chunk.bg); // Code background

    expect(boldChunks.length).toBeGreaterThan(0);
    expect(italicChunks.length).toBeGreaterThan(0);
    expect(codeChunks.length).toBeGreaterThan(0);

    // Verify specific formatted content
    expect(boldChunks.some((chunk) => chunk.plainText === 'John')).toBe(true);
    expect(boldChunks.some((chunk) => chunk.plainText === 'Inactive')).toBe(
      true
    );
    expect(italicChunks.some((chunk) => chunk.plainText === 'Active')).toBe(
      true
    );
  });

  it('should handle complex nested formatting', () => {
    const result = parseMarkdown(
      '- List item with **bold *italic* text** and `code`'
    );
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');
    expect(allText).toContain('• List item with bold italic text and  code ');

    // Should have various formatting applied
    const boldChunks = result.chunks.filter((chunk) => chunk.attributes === 1);
    const codeChunks = result.chunks.filter((chunk) => chunk.bg);

    expect(boldChunks.length).toBeGreaterThan(0);
    expect(codeChunks.length).toBeGreaterThan(0);

    // Note: Complex nested bold+italic may not preserve both formats simultaneously
    // but the text content should be correct and some formatting should be applied
  });

  it('should handle horizontal rules', () => {
    const result = parseMarkdown('Before\n\n---\n\nAfter');
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should contain text before and after
    expect(allText).toContain('Before');
    expect(allText).toContain('After');

    // Should contain horizontal line characters
    expect(allText).toContain('─'); // Horizontal line character

    // Should have proper structure with newlines
    expect(allText).toContain('Before');
    expect(allText).toContain('After');
  });

  it('should handle nested lists with proper indentation', () => {
    const nestedListMarkdown = `
- Item 1
  - Nested item 1
  - Nested item 2
- Item 2
    `.trim();

    const result = parseMarkdown(nestedListMarkdown);
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should contain different bullet styles for different levels
    expect(allText).toContain('• Item 1');
    expect(allText).toContain('◦ Nested item 1'); // Different bullet for nested
    expect(allText).toContain('◦ Nested item 2');
    expect(allText).toContain('• Item 2');

    // Should have proper indentation (nested items should be indented)
    const lines = allText.split('\n');
    const nestedLine1 = lines.find((line) => line.includes('Nested item 1'));
    const nestedLine2 = lines.find((line) => line.includes('Nested item 2'));

    expect(nestedLine1).toBeDefined();
    expect(nestedLine2).toBeDefined();
    expect(nestedLine1?.includes('◦')).toBe(true); // Should have nested bullet
    expect(nestedLine2?.includes('◦')).toBe(true); // Should have nested bullet
  });

  it('should ensure nested lists start on new lines', () => {
    const complexNestedMarkdown = `
- Parent item
  - First nested
  - Second nested
- Another parent
    `.trim();

    const result = parseMarkdown(complexNestedMarkdown);
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Check that nested items are properly separated
    expect(allText).toContain('• Parent item');
    expect(allText).toContain('◦ First nested');
    expect(allText).toContain('◦ Second nested');

    // Split into lines and verify structure
    const lines = allText.split('\n');
    const parentItemLine = lines.find((line) =>
      line.trim().startsWith('• Parent item')
    );
    const firstNestedLine = lines.find((line) => line.includes('First nested'));

    expect(parentItemLine).toBeDefined();
    expect(firstNestedLine).toBeDefined();

    // Parent item line should ONLY contain "• Parent item" (no nested content)
    expect(parentItemLine?.trim()).toBe('• Parent item');

    // Nested line should be properly indented and have nested bullet
    expect(firstNestedLine?.includes('◦ First nested')).toBe(true);
    expect(firstNestedLine?.startsWith('  ')).toBe(true);
  });

  it('should handle task lists with checkboxes', () => {
    const taskListMarkdown = `
- [ ] Incomplete task
- [x] Completed task
- [ ] Another incomplete task
    `.trim();

    const result = parseMarkdown(taskListMarkdown);
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should contain checkbox characters instead of bullets
    expect(allText).toContain('☐ Incomplete task'); // Empty checkbox
    expect(allText).toContain('☑ Completed task'); // Checked checkbox
    expect(allText).toContain('☐ Another incomplete task');

    // Should NOT contain regular bullet points for task items
    expect(allText).not.toContain('• Incomplete task');
    expect(allText).not.toContain('• Completed task');

    // Should have proper line structure
    const lines = allText.split('\n').filter((line) => line.trim() !== '');
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('☐ Incomplete task');
    expect(lines[1]).toContain('☑ Completed task');
    expect(lines[2]).toContain('☐ Another incomplete task');
  });

  it('should handle mixed regular and task list items', () => {
    const mixedListMarkdown = `
- Regular item
- [ ] Task item
- Another regular item
- [x] Completed task
    `.trim();

    const result = parseMarkdown(mixedListMarkdown);
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should have mix of bullets and checkboxes
    expect(allText).toContain('• Regular item');
    expect(allText).toContain('☐ Task item');
    expect(allText).toContain('• Another regular item');
    expect(allText).toContain('☑ Completed task');
  });

  it('should handle nested task lists', () => {
    const nestedTaskListMarkdown = `
- [ ] Main task
  - [x] Subtask 1
  - [ ] Subtask 2
- [x] Another main task
    `.trim();

    const result = parseMarkdown(nestedTaskListMarkdown);
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should have checkboxes at different indentation levels
    expect(allText).toContain('☐ Main task');
    expect(allText).toContain('☑ Subtask 1');
    expect(allText).toContain('☐ Subtask 2');
    expect(allText).toContain('☑ Another main task');

    // Verify proper indentation structure
    const lines = allText.split('\n').filter((line) => line.trim() !== '');
    const subtask1Line = lines.find((line) => line.includes('Subtask 1'));
    const subtask2Line = lines.find((line) => line.includes('Subtask 2'));

    expect(subtask1Line?.startsWith('  ')).toBe(true); // Should be indented
    expect(subtask2Line?.startsWith('  ')).toBe(true); // Should be indented
  });

  it('should handle quote blocks', () => {
    const result = parseMarkdown('> This is a quote\n> with multiple lines');
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should contain quote content with border characters
    expect(allText).toContain('│ This is a quote');
    expect(allText).toContain('│ with multiple lines');

    // Should have proper line structure with newlines
    expect(
      allText.split('\n').filter((line) => line.trim() !== '')
    ).toHaveLength(2);
  });

  it('should handle nested quotes', () => {
    const result = parseMarkdown('> Level 1\n>> Level 2 nested quote');
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should contain quote border characters
    expect(allText).toContain('│');
    expect(allText).toContain('Level 1');
    expect(allText).toContain('Level 2 nested quote');
  });

  it('should handle admonition notes', () => {
    const result = parseMarkdown('> [!NOTE]\n> This is an important note');
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    // Should contain the admonition type and content
    expect(allText).toContain('NOTE');
    expect(allText).toContain('This is an important note');
    expect(allText).toContain('│ '); // Should have border character

    // Should have background styling for the header
    const backgroundChunks = result.chunks.filter((chunk) => chunk.bg);
    expect(backgroundChunks.length).toBeGreaterThan(0);
  });

  it('should handle admonition warnings', () => {
    const result = parseMarkdown('> [!WARNING]\n> This is a warning message');
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    expect(allText).toContain('WARNING');
    expect(allText).toContain('This is a warning message');
    expect(allText).toContain('│ ');

    // Should have background styling
    const backgroundChunks = result.chunks.filter((chunk) => chunk.bg);
    expect(backgroundChunks.length).toBeGreaterThan(0);
  });

  it('should handle admonition errors', () => {
    const result = parseMarkdown('> [!ERROR]\n> This is an error message');
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    expect(allText).toContain('ERROR');
    expect(allText).toContain('This is an error message');
    expect(allText).toContain('│ ');
  });

  it('should handle admonition success', () => {
    const result = parseMarkdown('> [!SUCCESS]\n> This completed successfully');
    expect(result).toBeDefined();

    const allText = result.chunks.map((chunk) => chunk.plainText).join('');

    expect(allText).toContain('SUCCESS');
    expect(allText).toContain('This completed successfully');
    expect(allText).toContain('│ ');
  });

  it('should differentiate between regular quotes and admonitions', () => {
    const regularQuote = parseMarkdown('> Just a regular quote');
    const admonition = parseMarkdown('> [!NOTE]\n> This is a note');

    const regularText = regularQuote.chunks
      .map((chunk) => chunk.plainText)
      .join('');
    const admonitionText = admonition.chunks
      .map((chunk) => chunk.plainText)
      .join('');

    // Regular quote should not contain admonition formatting
    expect(regularText).not.toContain('NOTE');
    expect(regularText).toContain('Just a regular quote');

    // Admonition should contain the type
    expect(admonitionText).toContain('NOTE');
    expect(admonitionText).toContain('This is a note');

    // Both should have border characters but admonitions should have background styling
    expect(regularText).toContain('│ ');
    expect(admonitionText).toContain('│ ');

    const regularBgChunks = regularQuote.chunks.filter((chunk) => chunk.bg);
    const admonitionBgChunks = admonition.chunks.filter((chunk) => chunk.bg);

    expect(regularBgChunks.length).toBe(0); // Regular quotes shouldn't have background
    expect(admonitionBgChunks.length).toBeGreaterThan(0); // Admonitions should have background
  });
});
