import { useState, useCallback, useEffect, useRef } from 'react';
import { useRenderer } from '@opentui/react';
import { MultiLineInput } from './MultiLineInput';
import { useModalState } from './ModalProvider.js';
import { colors } from '../theme.js';
import { executeCommand } from '../commands/registry.js';
import { parseFilePattern } from '../utils/inputParser.js';
import type { ModelMessage } from 'ai';
import { useMessageHistory } from '../hooks/useMessageHistory.js';
import type { PasteEvent } from '@opentui/core';

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
  queuedMessages,
  onQueuePop,
  onAutocompleteChange,
}: InputAreaProps) {
  const [cursorPosition, setCursorPosition] = useState(0);
  const { currentModal } = useModalState();
  const disabled = currentModal !== null;
  const renderer = useRenderer();

  // Use message history hook
  const history = useMessageHistory({
    currentValue: value,
    onChange,
    onQueuePop,
    queuedMessagesCount: queuedMessages.length,
  });

  // Use refs to avoid recreating listener on every cursor/value change
  const cursorPositionRef = useRef(cursorPosition);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);

  // Keep refs in sync
  useEffect(() => {
    cursorPositionRef.current = cursorPosition;
    valueRef.current = value;
    onChangeRef.current = onChange;
    disabledRef.current = disabled;
  });

  // Listen for paste events from the terminal
  useEffect(() => {
    const handlePaste = (event: PasteEvent) => {
      if (disabledRef.current) return;

      const pastedText = event.text;

      // Insert pasted text at cursor position
      const currentCursor = cursorPositionRef.current;
      const currentValue = valueRef.current;
      const before = currentValue.slice(0, currentCursor);
      const after = currentValue.slice(currentCursor);
      const newValue = before + pastedText + after;
      onChangeRef.current(newValue);

      // Move cursor to end of pasted text
      setCursorPosition(currentCursor + pastedText.length);
    };

    renderer.keyInput.on('paste', handlePaste);

    return () => {
      renderer.keyInput.removeListener('paste', handlePaste);
    };
  }, [renderer]);

  const handleCommandSelect = useCallback(
    (command: string) => {
      onChange(command);
      setCursorPosition(command.length);
    },
    [onChange]
  );

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
  }, [
    showCommandAutocomplete,
    showFileAutocomplete,
    value,
    cursorPosition,
    handleCommandSelect,
    handleFileSelect,
    onAutocompleteChange,
  ]);

  const handleInputArrowKey = useCallback(
    (direction: 'up' | 'down', shouldHandleHistory: boolean): boolean => {
      return history.navigate(direction, userHistory, shouldHandleHistory);
    },
    [history, userHistory]
  );

  const handleInputChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      // Do NOT reset history on input change - only on submit
    },
    [onChange]
  );

  const handleSubmit = useCallback(
    (submittedValue: string) => {
      if (disabled) return;

      const trimmed = submittedValue.trim();

      // Check if it's a command
      const { isCommand, result } = executeCommand(trimmed);

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
      history.reset(); // Reset history navigation state
    },
    [disabled, onCommandExecute, onSubmit, onChange, history]
  );

  return (
    <box flexDirection="column" flexShrink={0} minHeight={3}>
      <box
        flexDirection="column"
        backgroundColor={colors.backgrounds.input}
        flexShrink={0}
      >
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
