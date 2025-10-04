import { useState, useEffect, useCallback } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { useKeys, parseKeys } from '../keys/index.js';
import { colors } from '../theme.js';
import { commandRegistry } from '../commands/registry.js';
import type { Command } from '../commands/registry.js';

type CommandAutocompleteProps = {
  inputValue: string;
  onSelect: (command: string) => void;
};

export function CommandAutocomplete({
  inputValue,
  onSelect,
}: CommandAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { height: terminalHeight } = useTerminalDimensions();

  // Derive shouldShowAutocomplete from suggestions state
  const shouldShowAutocomplete = suggestions.length > 0;

  // Update suggestions when input value changes
  useEffect(() => {
    if (inputValue.startsWith('/')) {
      const newSuggestions = commandRegistry.getSuggestions(inputValue);
      setSuggestions(newSuggestions);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
    }
  }, [inputValue]);

  // Handle tab completion
  const handleTabComplete = useCallback(() => {
    if (shouldShowAutocomplete && suggestions.length > 0) {
      const selected = suggestions[selectedIndex];
      onSelect(`/${selected.name} `);
      return true;
    }
    return false;
  }, [shouldShowAutocomplete, suggestions, selectedIndex, onSelect]);

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

  // Calculate max items to show (limit to prevent overflow)
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
      {visibleSuggestions.map((cmd, index) => (
        <box
          key={cmd.name}
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
              <span fg={colors.text}>/{cmd.name}</span>
            : <span fg={colors.primary}>/{cmd.name}</span>}
            <span fg={colors.muted}> - </span>
            {index === visibleSelectedIndex ?
              <span fg={colors.lightGray}>{cmd.description}</span>
            : <span fg={colors.muted}>{cmd.description}</span>}
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
