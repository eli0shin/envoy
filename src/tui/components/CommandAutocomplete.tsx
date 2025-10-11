import { useCallback } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { colors } from '../theme.js';
import { getCommandSuggestions } from '../commands/registry.js';
import type { Command } from '../commands/registry.js';
import { useAutocomplete } from '../hooks/useAutocomplete.js';

type CommandAutocompleteProps = {
  inputValue: string;
  onSelect: (command: string) => void;
  bottomOffset: number;
};

export function CommandAutocomplete({
  inputValue,
  onSelect,
  bottomOffset,
}: CommandAutocompleteProps) {
  const { height: terminalHeight } = useTerminalDimensions();

  // Handle selection callback
  const handleSelect = useCallback(
    (command: Command) => {
      onSelect(`/${command.name} `);
    },
    [onSelect]
  );

  // Use autocomplete hook
  const { suggestions, selectedIndex, shouldShowAutocomplete } =
    useAutocomplete({
      trigger: inputValue.startsWith('/') ? inputValue : null,
      loadSuggestions: getCommandSuggestions,
      onSelect: handleSelect,
      enabled: true,
    });

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
