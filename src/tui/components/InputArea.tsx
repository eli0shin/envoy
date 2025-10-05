import { useState, useCallback, useEffect } from 'react';
import { MultiLineInput } from './MultiLineInput';
import { useModalState } from './ModalProvider.js';
import { colors } from '../theme.js';
import { commandRegistry } from '../commands/registry.js';
import { parseFilePattern } from '../utils/inputParser.js';
import type { ModelMessage } from 'ai';

export type AutocompleteState = {
  showCommand: boolean;
  showFile: boolean;
  inputValue: string;
  cursorPosition: number;
  onCommandSelect: (command: string) => void;
  onFileSelect: (replacement: string, start: number, end: number) => void;
} | null;

type InputAreaProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  onCommandExecute: (commandInput: string, result?: string) => void;
  userHistory: string[];
  historyIndex: number;
  setHistoryIndex: (index: number) => void;
  originalInput: string;
  setOriginalInput: (input: string) => void;
  queuedMessages: (ModelMessage & { id: string })[];
  onQueuePop: () => string | null;
  onAutocompleteChange: (state: AutocompleteState) => void;
};

export function InputArea({
  value,
  onChange,
  onSubmit,
  onCommandExecute,
  userHistory,
  historyIndex,
  setHistoryIndex,
  originalInput,
  setOriginalInput,
  queuedMessages,
  onQueuePop,
  onAutocompleteChange,
}: InputAreaProps) {
  const [cursorPosition, setCursorPosition] = useState(0);
  const { currentModal } = useModalState();
  const disabled = currentModal !== null;

  const handleCommandSelect = useCallback((command: string) => {
    onChange(command);
    setCursorPosition(command.length);
  }, [onChange]);

  const handleFileSelect = useCallback(
    (replacement: string, start: number, end: number) => {
      const newValue = value.slice(0, start) + replacement + value.slice(end);
      onChange(newValue);
      // Use setTimeout to ensure the value update completes before setting cursor
      setTimeout(() => {
        setCursorPosition(start + replacement.length);
      }, 0);
    },
    [value, onChange]
  );

  const handleCursorChange = useCallback((position: number) => {
    setCursorPosition(position);
  }, []);

  // Determine which autocomplete to show
  const showCommandAutocomplete = value.startsWith('/');
  const filePattern = parseFilePattern(value, cursorPosition);
  const showFileAutocomplete = filePattern !== null;

  // Notify parent of autocomplete state changes
  useEffect(() => {
    if (showCommandAutocomplete && !showFileAutocomplete) {
      onAutocompleteChange({
        showCommand: true,
        showFile: false,
        inputValue: value,
        cursorPosition,
        onCommandSelect: handleCommandSelect,
        onFileSelect: handleFileSelect,
      });
    } else if (showFileAutocomplete) {
      onAutocompleteChange({
        showCommand: false,
        showFile: true,
        inputValue: value,
        cursorPosition,
        onCommandSelect: handleCommandSelect,
        onFileSelect: handleFileSelect,
      });
    } else {
      onAutocompleteChange(null);
    }
  }, [showCommandAutocomplete, showFileAutocomplete, value, cursorPosition, handleCommandSelect, handleFileSelect, onAutocompleteChange]);

  const handleInputArrowKey = useCallback(
    (direction: 'up' | 'down', shouldHandleHistory: boolean): boolean => {
      if (direction === 'up' && (historyIndex === -1 ? shouldHandleHistory : true)) {
        // Check for queued messages first when on first line
        if (historyIndex === -1 && shouldHandleHistory && queuedMessages.length > 0) {
          const queuedContent = onQueuePop();
          if (queuedContent) {
            onChange(queuedContent);
            return true;
          }
        }

        // Save original input when first entering history mode
        if (historyIndex === -1) {
          setOriginalInput(value);
        }

        const newIndex = historyIndex + 1;
        if (newIndex < userHistory.length) {
          const messageToLoad = userHistory[userHistory.length - 1 - newIndex];
          onChange(messageToLoad);
          setHistoryIndex(newIndex);
          return true;
        }
      } else if (direction === 'down' && historyIndex >= 0 && shouldHandleHistory) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);

        if (newIndex >= 0) {
          onChange(userHistory[userHistory.length - 1 - newIndex]);
        } else {
          onChange(originalInput);
        }
        return true;
      }

      return false;
    },
    [
      userHistory,
      historyIndex,
      setHistoryIndex,
      value,
      originalInput,
      setOriginalInput,
      queuedMessages.length,
      onQueuePop,
      onChange,
    ]
  );

  const handleInputChange = useCallback((newValue: string) => {
    onChange(newValue);
    // Do NOT reset history on input change - only on submit
  }, [onChange]);

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

    onChange('');
  };

  return (
    <box flexDirection="column" flexShrink={0} minHeight={3}>
      <box flexDirection="column" backgroundColor={colors.backgrounds.input} flexShrink={0}>
        <box height={1}>
          <text> </text>
        </box>

        <MultiLineInput
          value={value}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          onArrowKey={handleInputArrowKey}
          onCursorChange={handleCursorChange}
          externalCursorPosition={cursorPosition}
          placeholder="Type your message... (Shift+Enter or \ for newlines, Enter to send)"
          minHeight={1}
          backgroundColor={colors.backgrounds.input}
          textColor={colors.text}
          disabled={disabled}
        />

        <box height={1}>
          <text> </text>
        </box>
      </box>
    </box>
  );
}
