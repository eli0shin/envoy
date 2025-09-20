import { useState, useCallback } from 'react';
import { MultiLineInput } from './MultiLineInput';
import { CommandAutocomplete } from './CommandAutocomplete';
import { FileAutocomplete } from './FileAutocomplete';
import { useModalState } from './ModalProvider.js';
import { colors } from '../theme.js';
import { commandRegistry } from '../commands/registry.js';
import { parseFilePattern } from '../utils/inputParser.js';
import type { ModelMessage } from 'ai';

type InputAreaProps = {
  onSubmit: (message: string) => void;
  onCommandExecute: (commandInput: string, result?: string) => void;
  onResize?: () => void;
  userHistory: string[];
  historyIndex: number;
  setHistoryIndex: (index: number) => void;
  originalInput: string;
  setOriginalInput: (input: string) => void;
  queuedMessages: (ModelMessage & { id: string })[];
  onQueuePop: () => string | null;
};

export function InputArea({
  onSubmit,
  onCommandExecute,
  onResize,
  userHistory,
  historyIndex,
  setHistoryIndex,
  originalInput,
  setOriginalInput,
  queuedMessages,
  onQueuePop,
}: InputAreaProps) {
  const [value, setValue] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const { currentModal } = useModalState();
  const disabled = currentModal !== null;

  const handleCommandSelect = useCallback((command: string) => {
    setValue(command);
  }, []);

  const handleFileSelect = useCallback(
    (replacement: string, start: number, end: number) => {
      const newValue = value.slice(0, start) + replacement + value.slice(end);
      setValue(newValue);
      // Use setTimeout to ensure the value update completes before setting cursor
      setTimeout(() => {
        setCursorPosition(start + replacement.length);
      }, 0);
    },
    [value]
  );

  const handleCursorChange = useCallback((position: number) => {
    setCursorPosition(position);
  }, []);

  // Determine which autocomplete to show
  const showCommandAutocomplete = value.startsWith('/');
  const filePattern = parseFilePattern(value, cursorPosition);
  const showFileAutocomplete = filePattern !== null;

  const handleInputArrowKey = useCallback(
    (direction: 'up' | 'down', shouldHandleHistory: boolean): boolean => {
      if (direction === 'up' && (historyIndex === -1 ? shouldHandleHistory : true)) {
        // Check for queued messages first when on first line
        if (historyIndex === -1 && shouldHandleHistory && queuedMessages.length > 0) {
          const queuedContent = onQueuePop();
          if (queuedContent) {
            setValue(queuedContent);
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
          setValue(messageToLoad);
          setHistoryIndex(newIndex);
          return true;
        }
      } else if (direction === 'down' && historyIndex >= 0 && shouldHandleHistory) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);

        if (newIndex >= 0) {
          setValue(userHistory[userHistory.length - 1 - newIndex]);
        } else {
          setValue(originalInput);
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
    ]
  );

  const handleInputChange = useCallback((newValue: string) => {
    setValue(newValue);
    // Do NOT reset history on input change - only on submit
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

    setValue('');
  };

  return (
    <box flexDirection="column">
      {/* Autocomplete positioned absolutely relative to viewport */}
      {showCommandAutocomplete && !showFileAutocomplete && (
        <CommandAutocomplete
          inputValue={value}
          onSelect={handleCommandSelect}
        />
      )}
      {showFileAutocomplete && (
        <FileAutocomplete
          inputValue={value}
          cursorPosition={cursorPosition}
          onSelect={handleFileSelect}
        />
      )}

      {/* Input area with padding */}
      <box flexDirection="column" backgroundColor={colors.backgrounds.input}>
        {/* Top padding line */}
        <box height={1}>
          <text> </text>
        </box>

        <MultiLineInput
          value={value}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          onResize={onResize}
          onArrowKey={handleInputArrowKey}
          onCursorChange={handleCursorChange}
          externalCursorPosition={cursorPosition}
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
