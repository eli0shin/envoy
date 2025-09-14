import { useState, useRef, useEffect, useMemo } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { fg } from '@opentui/core';
import type { InputRenderable } from '@opentui/core';
import { colors } from '../theme.js';
import { useKeys, parseKeys } from '../keys/index.js';
import { usePrefixState } from '../keys/prefixContext.js';
import { copyToClipboard, pasteFromClipboard } from '../clipboard.js';

type MultiLineInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onResize?: () => void;
  onTabKey?: () => boolean; // Returns true if tab was handled
  onArrowKey?: (direction: 'up' | 'down', isOnFirstLine: boolean) => boolean; // Returns true if arrow was handled
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
  onResize,
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
  // Track which line is being edited and cursor position
  const [editingLine, setEditingLine] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<InputRenderable | null>(null);

  // Separate concerns: input focus vs key handler enablement
  const isDisabled = disabled;
  const shouldDisableTextInput = disabled || !!activePrefix; // Prevent typing during prefix sequences
  const { width: terminalWidth } = useTerminalDimensions();
  const lines = useMemo(() => (value ? value.split('\n') : ['']), [value]);

  // Calculate available width for text (terminal width minus prompt area and padding)
  const availableTextWidth = terminalWidth - 6; // 3 for " > " prompt + 3 for padding/borders

  // Helper to calculate absolute cursor position in the full text
  const getAbsoluteCursorPosition = (lineIndex: number, positionInLine: number): number => {
    let position = 0;
    for (let i = 0; i < lineIndex; i++) {
      position += (lines[i] || '').length + 1; // +1 for newline character
    }
    position += positionInLine;
    return position;
  };

  // Helper to update cursor position and notify parent
  const updateCursorPosition = (newCursorPosition: number, newEditingLine?: number) => {
    setCursorPosition(newCursorPosition);
    if (onCursorChange) {
      const lineToUse = newEditingLine ?? editingLine;
      const absolutePosition = getAbsoluteCursorPosition(lineToUse, newCursorPosition);
      onCursorChange(absolutePosition);
    }
  };

  // Sync cursor position to the actual input element
  useEffect(() => {
    if (inputRef.current && !shouldDisableTextInput) {
      // Set cursor position directly on the InputRenderable instance
      // This must happen after the value is set
      inputRef.current.cursorPosition = cursorPosition;
    }
  }, [cursorPosition, shouldDisableTextInput]);

  // Handle external cursor position changes (e.g., from file autocomplete)
  useEffect(() => {
    if (externalCursorPosition === undefined || externalCursorPosition < 0) return;

    // When cursor position is set externally, update our internal tracking
    // Find which line and position the cursor should be at based on the full text position
    let position = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLength = (lines[i] || '').length;
      if (position + lineLength >= externalCursorPosition) {
        // Cursor is on this line
        const posInLine = Math.min(externalCursorPosition - position, lineLength);
        setEditingLine(i);
        setCursorPosition(posInLine);
        break;
      }
      position += lineLength + 1; // +1 for newline
    }
  }, [externalCursorPosition, lines]); // React to external cursor position changes

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

    // Update cursor position to match the new content length
    const newCursorPos = newLineContent.length;
    updateCursorPosition(newCursorPos);

    // Check if input exceeds available width
    if (newLineContent.length > availableTextWidth) {
      const splitPoint = findSplitPoint(newLineContent, availableTextWidth);

      if (splitPoint > 0) {
        // Split the line - first part becomes a completed line, second part continues as input
        const completedPart = newLineContent.slice(0, splitPoint).trim();
        const remainingPart = newLineContent.slice(splitPoint).trim();

        // Insert the completed part at current position and remaining part on next line
        const newLines = [...lines];
        newLines[editingLine] = completedPart;
        newLines.splice(editingLine + 1, 0, remainingPart);

        onChange(newLines.join('\n'));

        // Move to the next line (the remaining part)
        setEditingLine(editingLine + 1);
        updateCursorPosition(remainingPart.length, editingLine + 1);
        onResize?.();
        return;
      }
    }

    // Normal input handling - no overflow
    const newLines = [...lines];
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
            if (onArrowKey && onArrowKey('up', isOnFirstLine)) return; // let parent handle if provided
            if (editingLine > 0) {
              const newEditingLine = editingLine - 1;
              setEditingLine(newEditingLine);
              const targetLine = lines[newEditingLine] || '';
              updateCursorPosition(Math.min(cursorPosition, targetLine.length), newEditingLine);
            }
          },
          'input'
        ) ||
        parseKeys(
          key,
          'input.cursorDown',
          () => {
            if (onArrowKey && onArrowKey('down', isOnFirstLine)) return; // let parent handle if provided
            if (editingLine < lines.length - 1) {
              const newEditingLine = editingLine + 1;
              setEditingLine(newEditingLine);
              const targetLine = lines[newEditingLine] || '';
              updateCursorPosition(Math.min(cursorPosition, targetLine.length), newEditingLine);
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

          onResize?.();
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
          onResize?.();
          return true;
        }
      }

      // Newline and submit via keybindings
      if (
        parseKeys(
          key,
          'input.newline',
          () => {
            const currentLine = lines[editingLine] || '';
            const beforeCursor = currentLine.slice(0, cursorPosition);
            const afterCursor = currentLine.slice(cursorPosition);
            const newLines = [...lines];
            newLines[editingLine] = beforeCursor;
            newLines.splice(editingLine + 1, 0, afterCursor);
            onChange(newLines.join('\n'));
            setEditingLine(editingLine + 1);
            updateCursorPosition(0, editingLine + 1);
            onResize?.();
          },
          'input'
        )
      ) {
        return true;
      }

      if (
        parseKeys(
          key,
          'input.submit',
          () => {
            const currentLine = lines[editingLine] || '';
            // Backslash continuation on submit
            if (currentLine.trim().endsWith('\\')) {
              // Remove backslash and add new line
              const newLines = [...lines];
              newLines[editingLine] = currentLine.trim().slice(0, -1);
              newLines.splice(editingLine + 1, 0, '');
              onChange(newLines.join('\n'));
              setEditingLine(editingLine + 1);
              updateCursorPosition(0, editingLine + 1);
              onResize?.();
              return;
            }

            // Regular Enter - submit message
            if (value.trim()) {
              onSubmit(value);
              onChange('');
              setEditingLine(0);
              updateCursorPosition(0, 0);
              onResize?.();
            }
          },
          'input'
        )
      ) {
        return true;
      }

      // Clear input - <leader>c
      if (
        parseKeys(
          key,
          'input.clear',
          () => {
            onChange('');
            setEditingLine(0);
            updateCursorPosition(0, 0);
            onResize?.();
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
              onResize?.();
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
                const absolutePos = getAbsoluteCursorPosition(editingLine, cursorPosition);
                const beforePaste = value.slice(0, absolutePos);
                const afterPaste = value.slice(absolutePos);
                const newValue = beforePaste + clipboardText + afterPaste;

                onChange(newValue);

                // Update cursor position after paste
                const pastedLines = clipboardText.split('\n');
                if (pastedLines.length === 1) {
                  // Single line paste - move cursor to end of pasted text
                  updateCursorPosition(cursorPosition + clipboardText.length, editingLine);
                } else {
                  // Multi-line paste - move to end of last pasted line
                  const newEditingLine = editingLine + pastedLines.length - 1;
                  setEditingLine(newEditingLine);
                  updateCursorPosition(pastedLines[pastedLines.length - 1].length, newEditingLine);
                }

                onResize?.();
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
    <box height={height} backgroundColor={backgroundColor} flexDirection="row">
      <box width={3}>
        <text>{' >'} </text>
      </box>
      <box flexGrow={1} flexDirection="column">
        {lines.map((line, index) => (
          <box
            key={`line-${index}`} /* eslint-disable-line react/no-array-index-key -- Line position is semantically important for multi-line input */
            height={1}
          >
            {index === editingLine ?
              <input
                ref={inputRef}
                value={line}
                placeholder={index === 0 && !value ? placeholder : ''}
                focused={!shouldDisableTextInput}
                onInput={handleLineInput}
                backgroundColor={backgroundColor}
                textColor={textColor}
              />
            : <text>{fg(textColor)(line || ' ')}</text>}
          </box>
        ))}
      </box>
    </box>
  );
}
