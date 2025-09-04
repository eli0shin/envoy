# Codeblock Syntax Highlighting Design Document

## Overview

This document outlines the design and implementation plan for adding comprehensive syntax highlighting support to codeblocks in the markdown renderer for our Ink-based terminal application.

## Current State Analysis

### Current Implementation

The current codeblock handling in `src/ui/utils/markdownRenderer.ts:21-26` is extremely basic:

````typescript
// Code blocks (backticks)
if (line.startsWith('```')) {
  elements.push(
    createElement(Text, { key, color: '#888888', wrap: 'wrap' }, line)
  );
  return;
}
````

### Problems with Current Implementation

1. **No Multi-line Support**: Only handles the opening/closing backticks, not the code content
2. **No Language Detection**: Ignores language tags (e.g., ````typescript`)
3. **No Syntax Highlighting**: All code appears as plain gray text
4. **No Code Block Boundaries**: Cannot distinguish between opening and closing markers
5. **No State Management**: No tracking of whether we're inside a code block

## Research Findings

### Terminal Syntax Highlighting Libraries

1. **highlight.js** - Most popular, supports 190+ languages, zero dependencies
2. **PrismJS** - Lightweight, extensible, 2KB core
3. **prism-cli** - Terminal-specific version of PrismJS with ANSI color support
4. **cli-highlight** - Purpose-built for terminal syntax highlighting

### Terminal Color Libraries

1. **chalk** - Most popular for ANSI colors, supports 256 colors + Truecolor
2. **colors.js** - Alternative color library
3. **ansi-colors** - Lightweight alternative

### Recommended Stack

- **highlight.js** for syntax parsing (language detection + tokenization)
- **chalk** for terminal color output
- Custom mapping between highlight.js tokens and chalk color functions

## Design Architecture

### Component Structure

```
CodeBlockRenderer
├── LanguageDetector
├── SyntaxHighlighter
├── ColorMapper
└── CodeBlockContainer
```

### State Management

The renderer needs to track:

- Current parsing state (`normal`, `in_code_block`)
- Current language (detected from opening fence)
- Accumulated code lines
- Code block boundaries

### Processing Pipeline

1. **Fence Detection**: Identify opening/closing code fences
2. **Language Detection**: Parse language from opening fence
3. **Code Accumulation**: Collect code lines while in code block
4. **Syntax Highlighting**: Apply highlighting when closing fence is reached
5. **Rendering**: Convert highlighted tokens to Ink components

## Implementation Plan

### Phase 1: Basic Multi-line Code Block Support

**Goal**: Handle multi-line code blocks without syntax highlighting

**Changes**:

- Add state tracking for code block parsing
- Collect code lines between fences
- Render code blocks as single components

**Implementation**:

```typescript
type CodeBlockState = {
  inCodeBlock: boolean;
  language: string | null;
  codeLines: string[];
  startIndex: number;
};

function parseCodeBlock(
  lines: string[],
  state: CodeBlockState
): {
  elements: React.ReactElement[];
  newState: CodeBlockState;
} {
  // Implementation details
}
```

### Phase 2: Language Detection

**Goal**: Parse and store language information from code fences

**Changes**:

- Extract language from opening fence (e.g., ````typescript` → `typescript`)
- Validate against supported languages
- Store language for highlighting phase

**Implementation**:

````typescript
function detectLanguage(fenceLine: string): string | null {
  const match = fenceLine.match(/^```(\w+)?/);
  return match?.[1]?.toLowerCase() || null;
}
````

### Phase 3: Syntax Highlighting Integration

**Goal**: Add syntax highlighting using highlight.js + chalk

**Dependencies**:

```json
{
  "highlight.js": "^11.9.0",
  "chalk": "^5.3.0"
}
```

**Changes**:

- Integrate highlight.js for tokenization
- Create token-to-chalk color mapping
- Apply highlighting to code content

**Implementation**:

```typescript
import hljs from 'highlight.js';
import chalk from 'chalk';

const TOKEN_COLOR_MAP = {
  'hljs-keyword': chalk.blue,
  'hljs-string': chalk.green,
  'hljs-comment': chalk.gray,
  'hljs-number': chalk.yellow,
  'hljs-function': chalk.cyan,
  'hljs-variable': chalk.magenta,
  // ... more mappings
};

function highlightCode(code: string, language: string): React.ReactElement[] {
  const highlighted = hljs.highlight(code, { language });
  return parseHighlightedHTML(highlighted.value);
}
```

### Phase 4: Advanced Features

**Goal**: Add advanced syntax highlighting features

**Features**:

- Line numbers (optional)
- Language label display
- Error handling for unsupported languages
- Fallback to plain text for unknown languages
- Custom color themes

## Technical Specifications

### Supported Languages

Initial support for commonly used languages:

- JavaScript/TypeScript
- Python
- Java
- C/C++
- Go
- Rust
- Shell/Bash
- JSON
- YAML
- Markdown
- HTML/CSS

### Color Scheme

**Default Theme** (based on common terminal themes):

- Keywords: Blue (`chalk.blue`)
- Strings: Green (`chalk.green`)
- Comments: Gray (`chalk.gray`)
- Numbers: Yellow (`chalk.yellow`)
- Functions: Cyan (`chalk.cyan`)
- Variables: Magenta (`chalk.magenta`)
- Operators: White (`chalk.white`)
- Punctuation: White (`chalk.white`)

### Performance Considerations

1. **Lazy Loading**: Only load highlight.js when first code block is encountered
2. **Language Registration**: Only register languages as needed
3. **Caching**: Cache highlighted results for repeated code blocks
4. **Memory Management**: Dispose of large highlighting results

### Error Handling

1. **Unknown Languages**: Fallback to plain text with monospace styling
2. **Parsing Errors**: Gracefully handle malformed code blocks
3. **Library Failures**: Fallback to basic formatting if highlight.js fails

## Testing Strategy

### Unit Tests

1. **Language Detection**:

   - Test various language tags (`js`, `javascript`, `typescript`, etc.)
   - Test edge cases (empty language, invalid language)
   - Test case sensitivity

2. **Code Block Parsing**:

   - Test single-line vs multi-line code blocks
   - Test nested backticks within code blocks
   - Test malformed code blocks (missing closing fence)

3. **Syntax Highlighting**:
   - Test highlighting accuracy for each supported language
   - Test color mapping correctness
   - Test fallback behavior for unknown languages

### Integration Tests

1. **End-to-End Rendering**:

   - Test complete markdown documents with multiple code blocks
   - Test mixed content (code blocks + other markdown elements)
   - Test performance with large code blocks

2. **Error Recovery**:
   - Test behavior with malformed input
   - Test library initialization failures
   - Test memory constraints

### Visual Testing

1. **Terminal Output**:
   - Manual testing in various terminals (iTerm, Terminal.app, etc.)
   - Test color accuracy across different terminal configurations
   - Test readability and visual hierarchy

## Migration Plan

### Backward Compatibility

- Maintain existing API for `renderMarkdown` function
- Ensure no breaking changes to existing markdown rendering
- Add feature flags for gradual rollout

### Rollout Strategy

1. **Phase 1**: Deploy basic multi-line support
2. **Phase 2**: Add language detection (no visual changes)
3. **Phase 3**: Enable syntax highlighting for JavaScript/TypeScript only
4. **Phase 4**: Roll out to all supported languages

### Configuration Options

```typescript
type CodeBlockConfig = {
  enableSyntaxHighlighting: boolean;
  supportedLanguages: string[];
  colorTheme: 'default' | 'dark' | 'light';
  showLineNumbers: boolean;
  showLanguageLabel: boolean;
};
```

## Dependencies

### New Dependencies

```json
{
  "highlight.js": "^11.9.0",
  "chalk": "^5.3.0"
}
```

### Bundle Size Impact

- highlight.js core: ~47KB
- Language definitions: ~2-5KB each
- chalk: ~14KB
- Total estimated impact: ~70-100KB

## Success Metrics

### Functional Requirements

- [ ] Multi-line code blocks render correctly
- [ ] Language detection works for all supported languages
- [ ] Syntax highlighting applies appropriate colors
- [ ] Error handling gracefully manages edge cases
- [ ] Performance remains acceptable for large documents

### Quality Requirements

- [ ] Code coverage > 90% for new code
- [ ] No memory leaks in rendering pipeline
- [ ] Startup time impact < 100ms
- [ ] Rendering time < 50ms for typical code blocks

## Future Enhancements

### Potential Features

1. **Interactive Code Blocks**: Allow copying code to clipboard
2. **Code Folding**: Collapse/expand large code blocks
3. **Diff Highlighting**: Support for diff/patch syntax
4. **Custom Themes**: User-configurable color schemes
5. **Language Plugins**: Support for custom language definitions

### Integration Points

1. **Settings System**: Allow users to configure highlighting preferences
2. **Theme System**: Integration with overall application theming
3. **Performance Monitoring**: Track rendering performance metrics
4. **Accessibility**: Ensure colors work for colorblind users

## Conclusion

This design provides a comprehensive approach to adding syntax highlighting to code blocks while maintaining backward compatibility and ensuring good performance. The phased implementation allows for gradual rollout and testing at each stage.

The solution leverages industry-standard libraries (highlight.js + chalk) while providing a clean abstraction layer that can be extended with additional features in the future.
