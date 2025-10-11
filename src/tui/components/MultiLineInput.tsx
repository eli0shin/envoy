import { useRef, useEffect, useMemo } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import type { InputRenderable } from '@opentui/core';
import { colors } from '../theme.js';
import { useKeys, parseKeys } from '../keys/index.js';
import { usePrefixState } from '../keys/prefixContext.js';
import { copyToClipboard, pasteFromClipboard } from '../clipboard.js';
import { useCursorPosition } from '../hooks/useCursorPosition.js';

type MultiLineInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onTabKey?: () => boolean; // Returns true if tab was handled
  onArrowKey?: (direction: 'up' | 'down', shouldHandleHistory: boolean) => boolean; // Returns true if arrow was handled
  onCursorChange?: (position: number) => void; // Reports cursor position in full text
  externalCursorPosition?: number; // External cursor position to set
  placeholder?: string;
  minHeight?: number;
  backgroundColor?: string;
  textColor?: string;
  disabled?: boolean;
};

export function MultiLineInput({
  value,
  onChange,
  onSubmit,
  onTabKey,
  onArrowKey,
  onCursorChange,
  externalCursorPosition,
  placeholder = 'Type your message...',
  minHeight = 3,
  backgroundColor = colors.backgrounds.input,
  textColor = colors.text,
  disabled = false,
}: MultiLineInputProps) {
  const { activePrefix } = usePrefixState();
  const inputRef = useRef<InputRenderable | null>(null);

  // Separate concerns: input focus vs key handler enablement
  const isDisabled = disabled;
  const shouldDisableTextInput = disabled || !!activePrefix; // Prevent typing during prefix sequences
  const { width: terminalWidth } = useTerminalDimensions();
  const lines = useMemo(() => (value ? value.split('\n') : ['']), [value]);

  // Keep a ref to the current lines to avoid stale closures
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // Calculate available width for text (terminal width minus prompt area and padding)
  const availableTextWidth = terminalWidth - 6; // 3 for " > " prompt + 3 for padding/borders

  // Use cursor position hook
  const {
    editingLine,
    setEditingLine,
    cursorPosition,
    setCursorPosition,
    getAbsoluteCursorPosition,
    updateCursorPosition,
  } = useCursorPosition({
    lines,
    externalCursorPosition,
    onCursorChange,
  });

  // Sync cursor position to the actual input element
  useEffect(() => {
    if (inputRef.current && !shouldDisableTextInput) {
      // Set cursor position directly on the InputRenderable instance
      // This must happen after the value is set
      inputRef.current.cursorPosition = cursorPosition;
    }
  }, [cursorPosition, shouldDisableTextInput, editingLine]); // Added editingLine to ensure effect runs when changing lines

  // Find the best split point (last word boundary that fits)
  const findSplitPoint = (text: string, maxWidth: number): number => {
    if (text.length <= maxWidth) return -1; // No split needed

    // Find the last space before maxWidth
    let splitPoint = text.lastIndexOf(' ', maxWidth);

    // If no space found, split at maxWidth (break word)
    if (splitPoint === -1) {
      splitPoint = maxWidth;
    }

    return splitPoint;
  };

  // Handle input changes for the current line with overflow detection
  const handleLineInput = (newLineContent: string) => {
    // Don't process input when disabled (including when prefix is active)
    if (isDisabled) {
      return;
    }

    // Read the ACTUAL cursor position from the input element
    // This preserves cursor position when typing/deleting in the middle of text
    const actualCursorPos =
      inputRef.current?.cursorPosition ?? newLineContent.length;
    updateCursorPosition(actualCursorPos);

    // Check if input exceeds available width
    if (newLineContent.length > availableTextWidth) {
      const splitPoint = findSplitPoint(newLineContent, availableTextWidth);

      if (splitPoint > 0) {
        // Split the line - first part becomes a completed line, second part continues as input
        const completedPart = newLineContent.slice(0, splitPoint).trim();
        const remainingPart = newLineContent.slice(splitPoint).trim();

        // Insert the completed part at current position and remaining part on next line
        // Use linesRef.current to avoid stale closure when value prop changes
        const newLines = [...linesRef.current];
        newLines[editingLine] = completedPart;
        newLines.splice(editingLine + 1, 0, remainingPart);

        onChange(newLines.join('\n'));

        // Move to the next line (the remaining part)
        setEditingLine(editingLine + 1);
        updateCursorPosition(remainingPart.length, editingLine + 1);
        return;
      }
    }

    // Normal input handling - no overflow
    // Use linesRef.current to avoid stale closure when value prop changes
    const newLines = [...linesRef.current];
    newLines[editingLine] = newLineContent;
    onChange(newLines.join('\n'));
  };

  // Navigate and edit using keybindings
  useKeys(
    (key) => {
      if (isDisabled) return false;

      // Cursor movement
      const isOnFirstLine = editingLine === 0;

      if (
        parseKeys(
          key,
          'input.cursorUp',
          () => {
            if (onArrowKey && onArrowKey('up', isOnFirstLine)) return; // let parent handle history when on first line
            if (editingLine > 0) {
              const newEditingLine = editingLine - 1;
              setEditingLine(newEditingLine);
              const targetLine = lines[newEditingLine] || '';
              updateCursorPosition(
                Math.min(cursorPosition, targetLine.length),
                newEditingLine
              );
            }
          },
          'input'
        ) ||
        parseKeys(
          key,
          'input.cursorDown',
          () => {
            const isOnLastLine = editingLine === lines.length - 1;
            if (onArrowKey && onArrowKey('down', isOnLastLine)) return; // let parent handle history when on last line
            if (editingLine < lines.length - 1) {
              const newEditingLine = editingLine + 1;
              setEditingLine(newEditingLine);
              const targetLine = lines[newEditingLine] || '';
              updateCursorPosition(
                Math.min(cursorPosition, targetLine.length),
                newEditingLine
              );
            }
          },
          'input'
        )
      ) {
        return true;
      }

      // Allow parent to handle tab completion if needed
      if (key.name === 'tab') {
        if (onTabKey && onTabKey()) return true;
        return false;
      }

      // Backspace merging behavior (raw key)
      if (key.name === 'backspace') {
        const currentLine = lines[editingLine] || '';

        // If at start of line and line is empty, remove the line
        if (cursorPosition === 0 && currentLine === '' && lines.length > 1) {
          const newLines = [...lines];
          newLines.splice(editingLine, 1);
          onChange(newLines.join('\n'));

          // Move to previous line if we're not at the first line
          if (editingLine > 0) {
            const newEditingLine = editingLine - 1;
            setEditingLine(newEditingLine);
            const targetLine = newLines[newEditingLine] || '';
            updateCursorPosition(targetLine.length, newEditingLine);
          }

            return true;
        }

        // If at start of non-empty line, merge with previous line
        if (cursorPosition === 0 && currentLine !== '' && editingLine > 0) {
          const newLines = [...lines];
          const previousLine = newLines[editingLine - 1];
          const mergedLine = previousLine + currentLine;

          newLines[editingLine - 1] = mergedLine;
          newLines.splice(editingLine, 1);
          onChange(newLines.join('\n'));

          setEditingLine(editingLine - 1);
          updateCursorPosition(previousLine.length, editingLine - 1);
            return true;
        }
      }

      // Note: Enter key handling moved to input's onKeyDown to properly use preventDefault

      // Clear input - <leader>c
      if (
        parseKeys(
          key,
          'input.clear',
          () => {
            onChange('');
            setEditingLine(0);
            updateCursorPosition(0, 0);
              },
          'input'
        )
      ) {
        return true;
      }

      // Copy to clipboard - <leader>y
      if (
        parseKeys(
          key,
          'input.copy',
          () => {
            copyToClipboard(value);
          },
          'input'
        )
      ) {
        return true;
      }

      // Cut to clipboard - <leader>x
      if (
        parseKeys(
          key,
          'input.cut',
          () => {
            copyToClipboard(value).then(() => {
              // Clear input after successful copy
              onChange('');
              setEditingLine(0);
              updateCursorPosition(0, 0);
                  });
          },
          'input'
        )
      ) {
        return true;
      }

      // Paste from clipboard - <leader>p
      if (
        parseKeys(
          key,
          'input.paste',
          () => {
            pasteFromClipboard().then((clipboardText) => {
              if (clipboardText) {
                // Calculate absolute position for insertion
                const absolutePos = getAbsoluteCursorPosition(
                  editingLine,
                  cursorPosition
                );
                const beforePaste = value.slice(0, absolutePos);
                const afterPaste = value.slice(absolutePos);
                const newValue = beforePaste + clipboardText + afterPaste;

                onChange(newValue);

                // Update cursor position after paste
                const pastedLines = clipboardText.split('\n');
                if (pastedLines.length === 1) {
                  // Single line paste - move cursor to end of pasted text
                  updateCursorPosition(
                    cursorPosition + clipboardText.length,
                    editingLine
                  );
                } else {
                  // Multi-line paste - move to end of last pasted line
                  const newEditingLine = editingLine + pastedLines.length - 1;
                  setEditingLine(newEditingLine);
                  updateCursorPosition(
                    pastedLines[pastedLines.length - 1].length,
                    newEditingLine
                  );
                }

                      }
            });
          },
          'input'
        )
      ) {
        return true;
      }

      return false;
    },
    { scope: 'input', enabled: !isDisabled }
  );

  // Calculate total height
  const height = Math.max(minHeight, lines.length);

  return (
    <box height={height} backgroundColor={backgroundColor} flexDirection="row" flexShrink={0}>
      <box width={3} flexShrink={0}>
        <text>{' >'} </text>
      </box>
      <box flexGrow={1} flexDirection="column" flexShrink={0}>
        {lines.map((line, index) => (
          <box
            key={`line-${index}`} // eslint-disable-line react/no-array-index-key, @eslint-react/no-array-index-key -- Line position is semantically important
            height={1}
          >
            {index === editingLine ?
              <input
                ref={inputRef}
                value={line}
                placeholder={index === 0 && !value ? placeholder : ''}
                focused={!shouldDisableTextInput}
                onInput={handleLineInput}
                onKeyDown={(key) => {
                  // Handle Enter key for submission
                  if (key.name === 'return' || key.name === 'enter') {
                    const currentLine = lines[editingLine] || '';
                    // Check for Shift+Enter for newline
                    if (key.shift) {
                      const beforeCursor = currentLine.slice(0, cursorPosition);
                      const afterCursor = currentLine.slice(cursorPosition);
                      const newLines = [...lines];
                      newLines[editingLine] = beforeCursor;
                      newLines.splice(editingLine + 1, 0, afterCursor);
                      onChange(newLines.join('\n'));
                      setEditingLine(editingLine + 1);
                      updateCursorPosition(0, editingLine + 1);
                                    return;
                    }

                    // Backslash continuation on submit
                    if (currentLine.trim().endsWith('\\')) {
                      const newLines = [...lines];
                      newLines[editingLine] = currentLine.trim().slice(0, -1);
                      newLines.splice(editingLine + 1, 0, '');
                      onChange(newLines.join('\n'));
                      setEditingLine(editingLine + 1);
                      updateCursorPosition(0, editingLine + 1);
                                    return;
                    }

                    // Regular Enter - submit message
                    if (value.trim()) {
                      onSubmit(value);
                      onChange('');
                      setEditingLine(0);
                      updateCursorPosition(0, 0);
                                  }
                  }
                }}
                backgroundColor={backgroundColor}
                textColor={textColor}
              />
            : <text><span fg={textColor}>{line || ' '}</span></text>}
          </box>
        ))}
      </box>
    </box>
  );
}
