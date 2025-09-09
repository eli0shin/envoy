import { useState, useEffect, useCallback } from "react";
import { fg } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { colors } from "../theme.js";
import { commandRegistry } from "../commands/registry.js";
import type { Command } from "../commands/registry.js";

type CommandAutocompleteProps = {
  inputValue: string;
  onSelect: (command: string) => void;
};

export function CommandAutocomplete({ inputValue, onSelect }: CommandAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Derive shouldShowAutocomplete from suggestions state
  const shouldShowAutocomplete = suggestions.length > 0;

  // Update suggestions when input value changes
  useEffect(() => {
    if (inputValue.startsWith("/")) {
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
  const handleArrowKey = useCallback((direction: "up" | "down") => {
    if (!shouldShowAutocomplete || suggestions.length === 0) {
      return false;
    }

    if (direction === "up") {
      setSelectedIndex(prev => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else {
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    }
    return true;
  }, [shouldShowAutocomplete, suggestions]);

  // Use keyboard hook to listen for key events directly
  useKeyboard((key) => {
    if (key.name === "tab") {
      handleTabComplete();
    } else if (key.name === "up") {
      handleArrowKey("up");
    } else if (key.name === "down") {
      handleArrowKey("down");
    }
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

  return (
    <box
      height={boxHeight}
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.primary}
      backgroundColor={colors.backgrounds.main}
      marginBottom={1} // Add spacing between autocomplete and input
    >
      {visibleSuggestions.map((cmd, index) => (
        <box
          key={cmd.name}
          height={1}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={
            index === visibleSelectedIndex
              ? colors.backgrounds.userMessage
              : undefined
          }
        >
          <text>
            {index === visibleSelectedIndex
              ? fg(colors.text)(`/${cmd.name}`)
              : fg(colors.primary)(`/${cmd.name}`)}
            {fg(colors.muted)(" - ")}
            {index === visibleSelectedIndex
              ? fg(colors.lightGray)(cmd.description)
              : fg(colors.muted)(cmd.description)}
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

