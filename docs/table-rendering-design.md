# Table Rendering Design Document

## Overview

This document outlines the design and implementation plan for adding comprehensive table rendering support to the markdown renderer for our Ink-based terminal application. The focus is on creating properly aligned, visually appealing tables that work consistently across different terminal environments.

## Current State Analysis

### Current Implementation

The current markdown renderer in `src/ui/utils/markdownRenderer.ts` has **no table support**. Tables are rendered as plain text without any formatting or alignment.

### Problems with Current Implementation

1. **No Table Detection**: Markdown table syntax is not recognized
2. **No Column Alignment**: No support for left/center/right alignment
3. **No Width Calculation**: No automatic column width adjustment
4. **No Border Rendering**: No visual separation between cells
5. **No Header/Body Distinction**: No visual hierarchy for table headers

## Markdown Table Syntax Analysis

### Basic Table Format

```markdown
| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### Alignment Specifications

```markdown
| Left | Center | Right |
| :--- | :----: | ----: |
| L1   |   C1   |    R1 |
| L2   |   C2   |    R2 |
```

### Edge Cases

1. **Uneven Columns**: Tables with different numbers of cells per row
2. **Missing Separators**: Tables without proper alignment rows
3. **Nested Content**: Tables containing inline markdown (bold, code, etc.)
4. **Wide Content**: Cells with content longer than terminal width
5. **Empty Cells**: Tables with empty cells

## Research Findings

### Terminal Table Libraries

1. **cli-table3** - Most popular, actively maintained, Unicode support
2. **ascii-table** - Lightweight, intelligent alignment
3. **tty-table** - Cross-platform, word wrap, colors, Asian character support
4. **console-table-printer** - Modern, customizable, good performance

### Ink Table Solutions

1. **ink-table** - Community component for Ink applications
2. **Custom Box-based** - Using Ink's Box component with calculated widths
3. **Text-based** - Using spaced Text components for alignment

### Recommended Approach

**Custom implementation using Ink's Box components** with:

- Calculated column widths based on content
- Flexible alignment system
- Support for nested markdown content
- Responsive width adjustment

## Design Architecture

### Component Structure

```
TableRenderer
├── TableParser
├── ColumnAnalyzer
├── AlignmentDetector
├── WidthCalculator
├── BorderRenderer
└── CellRenderer
```

### Data Structures

```typescript
type TableCell = {
  content: string;
  width: number;
  hasInlineMarkdown: boolean;
};

type TableRow = {
  cells: TableCell[];
  type: 'header' | 'separator' | 'body';
};

type TableAlignment = 'left' | 'center' | 'right';

type TableColumn = {
  alignment: TableAlignment;
  width: number;
  index: number;
};

type ParsedTable = {
  columns: TableColumn[];
  rows: TableRow[];
  totalWidth: number;
  hasHeaders: boolean;
};
```

## Implementation Plan

### Phase 1: Basic Table Detection and Parsing

**Goal**: Detect and parse markdown table syntax

**Changes**:

- Add table detection regex patterns
- Parse table rows and cells
- Handle basic cell content extraction

**Implementation**:

```typescript
function detectTable(
  lines: string[],
  startIndex: number
): {
  isTable: boolean;
  tableLines: string[];
  endIndex: number;
} {
  // Check for table pattern
  const tableRegex = /^\s*\|.*\|\s*$/;
  const separatorRegex = /^\s*\|[\s\-:]+\|\s*$/;

  // Implementation details
}

function parseTableRow(line: string): TableCell[] {
  // Split by | and clean up cells
  const cells = line
    .split('|')
    .slice(1, -1) // Remove empty first/last elements
    .map(cell => ({
      content: cell.trim(),
      width: 0,
      hasInlineMarkdown: containsInlineMarkdown(cell.trim()),
    }));

  return cells;
}
```

### Phase 2: Alignment Detection

**Goal**: Parse column alignment specifications from separator rows

**Changes**:

- Detect alignment markers (`:---`, `:---:`, `---:`)
- Apply alignment to column definitions
- Handle tables without explicit alignment

**Implementation**:

```typescript
function detectColumnAlignment(separatorLine: string): TableAlignment[] {
  const cells = separatorLine.split('|').slice(1, -1);

  return cells.map(cell => {
    const trimmed = cell.trim();
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) {
      return 'center';
    } else if (trimmed.endsWith(':')) {
      return 'right';
    } else {
      return 'left';
    }
  });
}
```

### Phase 3: Width Calculation and Layout

**Goal**: Calculate optimal column widths and table layout

**Changes**:

- Analyze content to determine minimum/maximum column widths
- Implement responsive width distribution
- Handle terminal width constraints

**Implementation**:

```typescript
function calculateColumnWidths(
  table: ParsedTable,
  availableWidth: number
): TableColumn[] {
  // Calculate content-based widths
  const contentWidths = table.columns.map((col, index) => {
    const cellWidths = table.rows.map(
      row => row.cells[index]?.content.length || 0
    );
    return {
      min: Math.min(...cellWidths),
      max: Math.max(...cellWidths),
      content: Math.max(...cellWidths),
      index,
    };
  });

  // Distribute available width
  const totalContentWidth = contentWidths.reduce(
    (sum, col) => sum + col.content,
    0
  );
  const borders = table.columns.length + 1; // | borders
  const padding = table.columns.length * 2; // spaces around content
  const availableContentWidth = availableWidth - borders - padding;

  // Implementation of width distribution algorithm
}
```

### Phase 4: Rendering System

**Goal**: Render tables using Ink components with proper alignment

**Changes**:

- Create table border system
- Implement cell content rendering with alignment
- Handle nested markdown content within cells

**Implementation**:

```typescript
function renderTable(table: ParsedTable): React.ReactElement {
  const tableElements: React.ReactElement[] = [];

  // Render header
  if (table.hasHeaders) {
    tableElements.push(renderTableRow(table.rows[0], table.columns, 'header'));
    tableElements.push(renderTableSeparator(table.columns));
  }

  // Render body rows
  const bodyRows = table.hasHeaders ? table.rows.slice(2) : table.rows;
  bodyRows.forEach((row, index) => {
    tableElements.push(renderTableRow(row, table.columns, 'body'));
  });

  return createElement(Box, { flexDirection: 'column' }, tableElements);
}

function renderTableRow(
  row: TableRow,
  columns: TableColumn[],
  type: 'header' | 'body'
): React.ReactElement {
  const cellElements = row.cells.map((cell, index) => {
    const column = columns[index];
    return renderTableCell(cell, column, type);
  });

  return createElement(Box, { flexDirection: 'row' }, [
    createElement(Text, {}, '│'),
    ...cellElements,
    createElement(Text, {}, '│'),
  ]);
}
```

## Technical Specifications

### Table Detection Pattern

```regex
/^\s*\|.*\|\s*$/  // Basic table row
/^\s*\|[\s\-:]+\|\s*$/  // Separator row
```

### Border Characters

**Unicode Box Drawing Characters**:

- `│` - Vertical line
- `─` - Horizontal line
- `┌` - Top-left corner
- `┐` - Top-right corner
- `└` - Bottom-left corner
- `┘` - Bottom-right corner
- `├` - Left T-junction
- `┤` - Right T-junction
- `┬` - Top T-junction
- `┴` - Bottom T-junction
- `┼` - Cross junction

**ASCII Fallback**:

- `|` - Vertical line
- `-` - Horizontal line
- `+` - Junctions

### Column Width Algorithm

1. **Content Analysis**: Measure all cell content widths
2. **Minimum Widths**: Calculate minimum required width per column
3. **Available Space**: Determine total available terminal width
4. **Proportional Distribution**: Distribute extra space proportionally
5. **Constraint Handling**: Handle overflow and minimum width constraints

### Alignment Implementation

```typescript
function alignCellContent(
  content: string,
  width: number,
  alignment: TableAlignment
): string {
  const contentWidth = content.length;
  const padding = width - contentWidth;

  switch (alignment) {
    case 'left':
      return content + ' '.repeat(padding);
    case 'right':
      return ' '.repeat(padding) + content;
    case 'center':
      const leftPadding = Math.floor(padding / 2);
      const rightPadding = padding - leftPadding;
      return ' '.repeat(leftPadding) + content + ' '.repeat(rightPadding);
    default:
      return content;
  }
}
```

## Advanced Features

### Responsive Table Handling

1. **Terminal Width Detection**: Automatically adjust to terminal size
2. **Column Prioritization**: Hide less important columns when space is limited
3. **Word Wrapping**: Wrap long content within cells
4. **Horizontal Scrolling**: Allow scrolling for very wide tables

### Content Features

1. **Nested Markdown**: Support for bold, italic, code within cells
2. **Cell Alignment**: Per-cell alignment overrides
3. **Cell Spanning**: Future support for colspan/rowspan
4. **Empty Cell Handling**: Graceful handling of missing cells

### Visual Enhancements

1. **Header Styling**: Different colors/styles for headers
2. **Alternating Rows**: Zebra striping for better readability
3. **Custom Themes**: User-configurable table themes
4. **Accessibility**: High contrast modes, screen reader support

## Error Handling

### Malformed Tables

1. **Inconsistent Columns**: Handle rows with different cell counts
2. **Missing Separators**: Gracefully handle tables without alignment rows
3. **Invalid Alignment**: Default to left alignment for invalid specifications
4. **Empty Tables**: Handle tables with no content rows

### Performance Considerations

1. **Large Tables**: Implement virtual scrolling for very large tables
2. **Complex Content**: Optimize rendering for tables with complex nested content
3. **Memory Management**: Efficient handling of table data structures

## Testing Strategy

### Unit Tests

1. **Table Detection**:

   - Test various table formats and edge cases
   - Test malformed table detection
   - Test non-table content that might look like tables

2. **Column Width Calculation**:

   - Test width distribution algorithms
   - Test edge cases (very wide/narrow terminals)
   - Test content with special characters

3. **Alignment**:
   - Test all alignment types (left, center, right)
   - Test mixed alignment tables
   - Test alignment with different content types

### Integration Tests

1. **End-to-End Rendering**:

   - Test complete markdown documents with tables
   - Test tables mixed with other markdown elements
   - Test performance with large tables

2. **Visual Regression**:
   - Screenshot-based testing for different terminal sizes
   - Test rendering consistency across different platforms

### Performance Tests

1. **Large Table Handling**:
   - Test tables with 100+ rows
   - Test tables with very wide content
   - Test memory usage with complex tables

## Migration Plan

### Backward Compatibility

- Maintain existing API for `renderMarkdown` function
- Ensure no breaking changes to non-table markdown rendering
- Add feature flags for gradual rollout

### Rollout Strategy

1. **Phase 1**: Basic table detection and parsing (no visual changes)
2. **Phase 2**: Simple table rendering with basic alignment
3. **Phase 3**: Advanced alignment and width calculation
4. **Phase 4**: Full feature set with responsive handling

## Configuration Options

```typescript
type TableConfig = {
  enableTables: boolean;
  borderStyle: 'unicode' | 'ascii';
  maxTableWidth: number;
  enableWordWrap: boolean;
  headerStyle: {
    bold: boolean;
    color: string;
  };
  alternatingRows: boolean;
  cellPadding: number;
};
```

## Dependencies

### No Additional Dependencies

The implementation will use only existing dependencies:

- React (for createElement)
- Ink (for Box and Text components)

### Bundle Size Impact

Minimal impact as the implementation uses existing libraries and patterns.

## Success Metrics

### Functional Requirements

- [ ] Basic table detection and parsing works for all valid markdown tables
- [ ] Column alignment (left, center, right) renders correctly
- [ ] Width calculation distributes space appropriately
- [ ] Tables render consistently across different terminal sizes
- [ ] Nested markdown content within cells works correctly

### Quality Requirements

- [ ] Code coverage > 90% for new table functionality
- [ ] Performance remains acceptable for tables up to 100 rows
- [ ] Memory usage stays within reasonable bounds
- [ ] Visual consistency across different terminal applications

## Future Enhancements

### Advanced Table Features

1. **Cell Spanning**: Support for colspan and rowspan
2. **Nested Tables**: Tables within table cells
3. **Sortable Headers**: Interactive table sorting
4. **Filtering**: Table content filtering capabilities
5. **Export**: Export table data to CSV/JSON

### Integration Features

1. **Theme Integration**: Full integration with application theme system
2. **Accessibility**: Screen reader support and high contrast modes
3. **Internationalization**: Support for RTL languages and wide characters
4. **Performance Monitoring**: Metrics for table rendering performance

## Conclusion

This design provides a comprehensive approach to adding table rendering support to the markdown renderer. The implementation focuses on correctness, performance, and visual appeal while maintaining backward compatibility.

The solution uses only existing dependencies and provides a solid foundation for future enhancements. The phased approach allows for gradual implementation and testing at each stage.

Key benefits:

- Proper column alignment and width calculation
- Responsive design that adapts to terminal width
- Support for nested markdown content
- Graceful handling of malformed tables
- Performance optimization for large tables
