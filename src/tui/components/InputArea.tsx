import { useState, useCallback } from "react";
import { MultiLineInput } from "./MultiLineInput";
import { CommandAutocomplete } from "./CommandAutocomplete";
import { useModalState } from "./ModalProvider.js";
import { colors } from "../theme.js";
import { commandRegistry } from "../commands/registry.js";

type InputAreaProps = {
  onSubmit: (message: string) => void;
  onCommandExecute: (commandInput: string, result?: string) => void;
  onResize?: () => void;
};

export function InputArea({
  onSubmit,
  onCommandExecute,
  onResize,
}: InputAreaProps) {
  const [value, setValue] = useState("");
  const { currentModal } = useModalState();
  const disabled = currentModal !== null;

  const handleCommandSelect = useCallback((command: string) => {
    setValue(command);
  }, []);

  const handleSubmit = (submittedValue: string) => {
    if (disabled) return;

    const trimmed = submittedValue.trim();

    // Check if it's a command
    const { isCommand, result } = commandRegistry.execute(trimmed);

    if (isCommand) {
      // Execute command and notify parent
      onCommandExecute(trimmed, result);

      // If command returns a string, also send it as a user message
      if (result) {
        onSubmit(result);
      }
    } else {
      // Regular message or invalid command - send to agent
      onSubmit(trimmed);
    }

    setValue("");
  };

  return (
    <box flexDirection="column">
      {/* Autocomplete shows above the input in normal flow */}
      <CommandAutocomplete inputValue={value} onSelect={handleCommandSelect} />

      {/* Input area with padding */}
      <box flexDirection="column" backgroundColor={colors.backgrounds.input}>
        {/* Top padding line */}
        <box height={1}>
          <text> </text>
        </box>

        <MultiLineInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          onResize={onResize}
          placeholder="Type your message... (Shift+Enter or \ for newlines, Enter to send)"
          minHeight={1}
          backgroundColor={colors.backgrounds.input}
          textColor={colors.text}
          disabled={disabled}
        />

        {/* Bottom padding line */}
        <box height={1}>
          <text> </text>
        </box>
      </box>
    </box>
  );
}

