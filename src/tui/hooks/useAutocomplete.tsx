import { useState, useEffect, useCallback } from 'react';
import { useKeys, parseKeys } from '../keys/index.js';

type UseAutocompleteOptions<T> = {
  trigger: string | null;
  loadSuggestions: (trigger: string) => Promise<T[]> | T[];
  onSelect: (suggestion: T, index: number) => void;
  enabled?: boolean;
};

export function useAutocomplete<T>({
  trigger,
  loadSuggestions,
  onSelect,
  enabled = true,
}: UseAutocompleteOptions<T>) {
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const shouldShowAutocomplete = enabled && suggestions.length > 0;

  // Update suggestions when trigger changes
  useEffect(() => {
    if (!trigger) {
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect -- Clearing suggestions when trigger is null is a legitimate side effect
      setSuggestions([]);
      return;
    }

    // Reset selection immediately when trigger changes
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect -- Resetting selectedIndex when search trigger changes is correct behavior
    setSelectedIndex(0);

    const loadAndSetSuggestions = async () => {
      try {
        const results = await loadSuggestions(trigger);
        setSuggestions(results);
      } catch (error) {
        setSuggestions([]);
      }
    };

    loadAndSetSuggestions();
  }, [trigger, loadSuggestions]);

  // Handle tab completion
  const handleTabComplete = useCallback(() => {
    if (shouldShowAutocomplete && suggestions.length > 0) {
      const selected = suggestions[selectedIndex];
      onSelect(selected, selectedIndex);
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

  // Handle close
  const handleClose = useCallback(() => {
    setSuggestions([]);
  }, []);

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
            handleClose();
          },
          'autocomplete'
        )
      );
    },
    { scope: 'autocomplete', enabled: () => shouldShowAutocomplete }
  );

  return {
    suggestions,
    selectedIndex,
    shouldShowAutocomplete,
    handleTabComplete,
    handleArrowKey,
    handleClose,
  };
}
