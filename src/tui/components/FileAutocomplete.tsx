import { useCallback, useMemo } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { colors } from '../theme.js';
import { parseFilePattern } from '../utils/inputParser.js';
import { fuzzyGitSearch, browseDirectory } from '../utils/fileSearch.js';
import { useAutocomplete } from '../hooks/useAutocomplete.js';

async function loadFileSuggestions(pattern: string) {
  const mode = pattern.includes('/') ? 'browse' : 'fuzzy';
  const results =
    mode === 'fuzzy' ?
      await fuzzyGitSearch(pattern)
    : await browseDirectory(pattern);
  return results;
}

type FileAutocompleteProps = {
  inputValue: string;
  cursorPosition: number;
  onSelect: (replacement: string, start: number, end: number) => void;
  bottomOffset: number;
};

export function FileAutocomplete({
  inputValue,
  cursorPosition,
  onSelect,
  bottomOffset,
}: FileAutocompleteProps) {
  const { height: terminalHeight } = useTerminalDimensions();

  // Parse file pattern from input
  const filePattern = useMemo(
    () => parseFilePattern(inputValue, cursorPosition),
    [inputValue, cursorPosition]
  );

  // Handle selection callback
  const handleSelect = useCallback(
    (selected: string) => {
      if (!filePattern) return;
      // Add space after completion if path doesn't end with / (i.e., it's a file)
      const completion =
        selected.endsWith('/') ? `@${selected}` : `@${selected} `;
      onSelect(completion, filePattern.startIndex, filePattern.endIndex);
    },
    [filePattern, onSelect]
  );

  // Use autocomplete hook
  const { suggestions, selectedIndex, shouldShowAutocomplete } =
    useAutocomplete({
      trigger: filePattern?.pattern ?? null,
      loadSuggestions: loadFileSuggestions,
      onSelect: handleSelect,
      enabled: true,
    });

  if (!shouldShowAutocomplete) {
    return null;
  }

  // Calculate max items to show (limit to 10)
  const maxItems = Math.min(suggestions.length, 10);
  const visibleSuggestions = suggestions.slice(0, maxItems);

  // Adjust selected index if it's beyond visible items
  const visibleSelectedIndex =
    selectedIndex >= maxItems ? maxItems - 1 : selectedIndex;

  // Calculate height including borders
  const boxHeight = visibleSuggestions.length + 2;

  // Position above the input area at bottom of screen
  const autocompleteTop = terminalHeight - bottomOffset - boxHeight;

  return (
    <box
      position="absolute"
      top={autocompleteTop}
      left={0}
      right={0}
      height={boxHeight}
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.primary}
      backgroundColor={colors.backgrounds.main}
      zIndex={100}
    >
      {visibleSuggestions.map((path, index) => (
        <box
          key={path}
          height={1}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={
            index === visibleSelectedIndex ?
              colors.backgrounds.userMessage
            : undefined
          }
        >
          <text>
            {index === visibleSelectedIndex ?
              <span fg={colors.text}>{path}</span>
            : <span fg={colors.primary}>{path}</span>}
          </text>
        </box>
      ))}
      {suggestions.length > maxItems && (
        <box height={1} paddingLeft={1}>
          <text>
            <span fg={colors.muted}>... and {suggestions.length - maxItems} more</span>
          </text>
        </box>
      )}
    </box>
  );
}
