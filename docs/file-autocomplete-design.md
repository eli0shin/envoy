# File Autocomplete Design

## Overview

This document describes the design for file path autocomplete using the `@` prefix in the TUI interactive mode. The system provides intelligent file suggestions that work anywhere in the input, supporting both fuzzy search across git-tracked files and direct directory browsing.

## Core Requirements

1. **@ Prefix Trigger**: File autocomplete activates when user types `@` with proper boundaries
2. **Position-Aware**: Works anywhere in input (unlike command autocomplete which only works at start)
3. **Last @ Only**: Only autocompletes the last `@` symbol to avoid confusion with multiple file tags
4. **Two Modes**: Fuzzy search for git files OR directory browsing based on presence of `/`
5. **No Caching**: Fresh results on every keystroke
6. **No File Reading**: Pure autocomplete - just suggesting paths, not reading/including file contents
7. **Simple UI**: Just file paths, no icons or descriptions

## Input Parsing

The system identifies file patterns by finding the last `@` symbol that has proper boundaries:

```typescript
function parseFilePattern(input: string, cursorPosition: number): FilePattern | null {
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
```

### Examples

- `"Check @pack"` → pattern: `"pack"`
- `"Check @src/comp"` → pattern: `"src/comp"`
- `"Compare @a.txt with @b.txt"` → pattern: `"b.txt"` (last @ only)
- `"Email@example.com"` → no pattern (no space before @)

## Two-Mode Operation

The system operates in two distinct modes based on whether the pattern contains a `/`:

### Mode 1: Fuzzy Git Search (no `/` in pattern)

When the pattern doesn't contain `/`, search across all git-tracked files:

```typescript
async function fuzzyGitSearch(pattern: string): Promise<string[]> {
  if (!pattern) {
    // Just @ alone - show files in current directory from git
    const { stdout } = await exec('git ls-files | head -10');
    return stdout.trim().split('\n').filter(Boolean);
  }

  // Direct fzf pipeline - no pre-listing
  try {
    const { stdout } = await exec(
      `git ls-files | fzf --filter="${pattern}" --exact --no-sort | head -10`
    );
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    // Fallback if fzf not available - simple grep
    const { stdout } = await exec(
      `git ls-files | grep -i "${pattern}" | head -10`
    );
    return stdout.trim().split('\n').filter(Boolean);
  }
}
```

### Mode 2: Directory Browse (contains `/`)

When the pattern contains `/`, browse the filesystem directly:

```typescript
async function browseDirectory(pattern: string): Promise<string[]> {
  const lastSlash = pattern.lastIndexOf('/');
  const dir = pattern.slice(0, lastSlash + 1) || './';
  const filePrefix = pattern.slice(lastSlash + 1);

  try {
    const entries = await fs.readdir(path.resolve(dir), { withFileTypes: true });

    return entries
      .filter(entry => entry.name.startsWith(filePrefix))
      .slice(0, 10)
      .map(entry => {
        const relativePath = path.join(dir, entry.name);
        return entry.isDirectory() ? `${relativePath}/` : relativePath;
      });
  } catch {
    return []; // Directory doesn't exist or not accessible
  }
}
```

## Component Architecture

### FileAutocomplete Component

```typescript
type FileAutocompleteProps = {
  input: string;
  cursorPosition: number;
  onSelect: (replacement: string, start: number, end: number) => void;
};

function FileAutocomplete({ input, cursorPosition, onSelect }: FileAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filePattern = parseFilePattern(input, cursorPosition);
  const visible = filePattern !== null && suggestions.length > 0;

  useEffect(() => {
    if (!filePattern) {
      setSuggestions([]);
      return;
    }

    const loadSuggestions = async () => {
      const mode = filePattern.pattern.includes('/') ? 'browse' : 'fuzzy';
      const results = mode === 'fuzzy'
        ? await fuzzyGitSearch(filePattern.pattern)
        : await browseDirectory(filePattern.pattern);
      setSuggestions(results);
    };

    loadSuggestions();
  }, [filePattern?.pattern]);

  const handleSelect = () => {
    const selected = suggestions[selectedIndex];
    if (selected && filePattern) {
      // Replace from @ to end of pattern with selected path
      onSelect(`@${selected}`, filePattern.startIndex, filePattern.endIndex);
    }
  };

  // Simple rendering - just paths
  return visible ? (
    <Box flexDirection="column" position="absolute">
      {suggestions.map((path, index) => (
        <Text
          key={path}
          color={index === selectedIndex ? 'cyan' : 'white'}
        >
          {index === selectedIndex ? '▸ ' : '  '}{path}
        </Text>
      ))}
    </Box>
  ) : null;
}
```

### Integration with InputArea

The key difference from command autocomplete is position awareness:

```typescript
function InputArea() {
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  // Command autocomplete: only at start
  const showCommandAutocomplete = input.startsWith('/');

  // File autocomplete: check for last @ with proper boundary
  const filePattern = parseFilePattern(input, cursorPosition);
  const showFileAutocomplete = filePattern !== null;

  const handleFileSelect = (replacement: string, start: number, end: number) => {
    const newInput =
      input.slice(0, start) +
      replacement +
      input.slice(end);
    setInput(newInput);
    setCursorPosition(start + replacement.length);
  };

  return (
    <>
      {showCommandAutocomplete && !showFileAutocomplete && (
        <CommandAutocomplete
          input={input}
          onSelect={setInput}
        />
      )}
      {showFileAutocomplete && (
        <FileAutocomplete
          input={input}
          cursorPosition={cursorPosition}
          onSelect={handleFileSelect}
        />
      )}
      <MultiLineInput
        value={input}
        onChange={setInput}
        onCursorChange={setCursorPosition}
      />
    </>
  );
}
```

## User Experience

### Basic Examples

```
Input: "Check the @"
Shows:
  src/
  package.json
  README.md
  (first 10 git-tracked files)

Input: "Check the @pack"
Shows:
  package.json
  package-lock.json
  (fuzzy matches via fzf)

Input: "Check the @src/"
Shows:
  src/tui/
  src/utils/
  src/index.ts
  (directory contents of src/)
```

### Multiple @ Symbols

Only the last @ is active for autocomplete:

```
Input: "Compare @package.json with @src/"
                               ^^^^^^
                          (only this triggers autocomplete)
Shows:
  src/tui/
  src/utils/
  src/index.ts
```

### Path Types Supported

- Relative paths: `@src/`, `@./config/`
- Parent navigation: `@../`
- Absolute paths: `@/etc/`
- Git-ignored directories work in browse mode: `@./node_modules/`

## Implementation Plan

### Phase 1: Core Functions
1. Create `fileSearch.ts` with `fuzzyGitSearch` and `browseDirectory`
2. Create `inputParser.ts` with `parseFilePattern` function
3. Test with command line scripts before UI integration

### Phase 2: FileAutocomplete Component
1. Create `FileAutocomplete.tsx` component
2. Implement keyboard navigation (reuse existing keybinding patterns)
3. Position autocomplete box relative to cursor position

### Phase 3: Integration
1. Update `InputArea.tsx` to track cursor position
2. Add `FileAutocomplete` rendering logic
3. Handle selection and text replacement

### Phase 4: Testing
1. Test multiple @ symbols in input
2. Test fuzzy search with/without fzf
3. Test directory browsing including `../` and absolute paths
4. Test edge cases (empty directories, permission errors)

## Key Design Decisions

1. **No Caching**: Every keystroke queries fresh data for simplicity
2. **No Icons/Descriptions**: Just display file paths for minimal UI
3. **No File Content Processing**: Pure autocomplete, no reading files
4. **Direct fzf Integration**: Pipe `git ls-files` directly to fzf for performance
5. **No Security Restrictions**: User can traverse anywhere they have permissions
6. **Position-Aware**: Works anywhere in input with proper boundaries
7. **Last @ Only**: Prevents confusion with multiple file tags
8. **Mode Detection**: Presence of `/` determines fuzzy vs browse mode

## Differences from Command Autocomplete

| Feature | Command Autocomplete | File Autocomplete |
|---------|---------------------|-------------------|
| Trigger | `/` at start only | `@` anywhere with boundary |
| Position | Start of input | Anywhere in input |
| Selection | Replaces entire input | Replaces partial text |
| Data Source | Registered commands | Git files or filesystem |
| Caching | Commands are static | No caching, fresh each time |

## Performance Considerations

- Limit results to 10 items maximum
- Use `head -10` in shell pipelines for efficiency
- No timeout restrictions - filesystem operations are generally fast
- No pre-indexing or caching to keep memory usage minimal

## Future Enhancements (Not in Initial Implementation)

- Smart sorting (recently accessed files first)
- File type filtering (e.g., `@*.tsx` for TypeScript files only)
- Integration with project-specific ignore patterns
- Preview of file contents on hover