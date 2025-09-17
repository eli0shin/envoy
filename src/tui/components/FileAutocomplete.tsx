import { useState, useEffect, useCallback } from 'react';
import { fg } from '@opentui/core';
import { useTerminalDimensions } from '@opentui/react';
import { useKeys, parseKeys } from '../keys/index.js';
import { colors } from '../theme.js';
import { parseFilePattern } from '../utils/inputParser.js';
import { fuzzyGitSearch, browseDirectory } from '../utils/fileSearch.js';

type FileAutocompleteProps = {
  inputValue: string;
  cursorPosition: number;
  onSelect: (replacement: string, start: number, end: number) => void;
};

export function FileAutocomplete({
  inputValue,
  cursorPosition,
  onSelect,
}: FileAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { height: terminalHeight } = useTerminalDimensions();

  const filePattern = parseFilePattern(inputValue, cursorPosition);
  const shouldShowAutocomplete = filePattern !== null && suggestions.length > 0;

  // Update suggestions when file pattern changes
  useEffect(() => {
    if (!filePattern) {
      setSuggestions([]);
      return;
    }

    // Reset selection immediately when pattern changes
    setSelectedIndex(0);

    const loadSuggestions = async () => {
      try {
        const mode = filePattern.pattern.includes('/') ? 'browse' : 'fuzzy';
        const results =
          mode === 'fuzzy' ?
            await fuzzyGitSearch(filePattern.pattern)
          : await browseDirectory(filePattern.pattern);
        setSuggestions(results);
      } catch (error) {
        setSuggestions([]);
      }
    };

    loadSuggestions();
    // Only re-run when the actual pattern string changes, not the object reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePattern?.pattern]);

  // Handle tab completion
  const handleTabComplete = useCallback(() => {
    if (shouldShowAutocomplete && suggestions.length > 0 && filePattern) {
      const selected = suggestions[selectedIndex];
      // Add space after completion if path doesn't end with / (i.e., it's a file)
      const completion =
        selected.endsWith('/') ? `@${selected}` : `@${selected} `;
      onSelect(completion, filePattern.startIndex, filePattern.endIndex);
      return true;
    }
    return false;
  }, [
    shouldShowAutocomplete,
    suggestions,
    selectedIndex,
    filePattern,
    onSelect,
  ]);

  // Handle arrow key navigation
  const handleArrowKey = useCallback(
    (direction: 'up' | 'down') => {
      if (!shouldShowAutocomplete || suggestions.length === 0) {
        return false;
      }

      if (direction === 'up') {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else {
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      }
      return true;
    },
    [shouldShowAutocomplete, suggestions]
  );

  // Keybindings for autocomplete
  useKeys(
    (key) => {
      if (!shouldShowAutocomplete) return false;
      return (
        parseKeys(
          key,
          'command.accept',
          () => {
            handleTabComplete();
          },
          'autocomplete'
        ) ||
        parseKeys(
          key,
          'command.prev',
          () => {
            handleArrowKey('up');
          },
          'autocomplete'
        ) ||
        parseKeys(
          key,
          'command.next',
          () => {
            handleArrowKey('down');
          },
          'autocomplete'
        ) ||
        parseKeys(
          key,
          'command.close',
          () => {
            setSuggestions([]);
          },
          'autocomplete'
        )
      );
    },
    { scope: 'autocomplete', enabled: () => shouldShowAutocomplete }
  );

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
  const autocompleteTop = terminalHeight - 5 - boxHeight; // 5 lines for input area

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
              fg(colors.text)(path)
            : fg(colors.primary)(path)}
          </text>
        </box>
      ))}
      {suggestions.length > maxItems && (
        <box height={1} paddingLeft={1}>
          <text>
            {fg(colors.muted)(`... and ${suggestions.length - maxItems} more`)}
          </text>
        </box>
      )}
    </box>
  );
}
