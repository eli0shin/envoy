import { useState, useEffect, useCallback } from 'react';

type UseCursorPositionOptions = {
  lines: string[];
  externalCursorPosition?: number;
  onCursorChange?: (absolutePosition: number) => void;
};

export function useCursorPosition({
  lines,
  externalCursorPosition,
  onCursorChange,
}: UseCursorPositionOptions) {
  const [editingLine, setEditingLine] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Helper to calculate absolute cursor position in the full text
  const getAbsoluteCursorPosition = useCallback(
    (lineIndex: number, positionInLine: number): number => {
      let position = 0;
      for (let i = 0; i < lineIndex; i++) {
        position += (lines[i] || '').length + 1; // +1 for newline character
      }
      position += positionInLine;
      return position;
    },
    [lines]
  );

  // Helper to update cursor position and notify parent
  const updateCursorPosition = useCallback(
    (newCursorPosition: number, newEditingLine?: number) => {
      setCursorPosition(newCursorPosition);
      if (onCursorChange) {
        const lineToUse = newEditingLine ?? editingLine;
        const absolutePosition = getAbsoluteCursorPosition(
          lineToUse,
          newCursorPosition
        );
        onCursorChange(absolutePosition);
      }
    },
    [editingLine, getAbsoluteCursorPosition, onCursorChange]
  );

  // Handle external cursor position changes (e.g., from file autocomplete)
  useEffect(() => {
    if (externalCursorPosition === undefined || externalCursorPosition < 0)
      return;

    // When cursor position is set externally, update our internal tracking
    // Find which line and position the cursor should be at based on the full text position
    let position = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLength = (lines[i] || '').length;
      if (position + lineLength >= externalCursorPosition) {
        // Cursor is on this line
        const posInLine = Math.min(
          externalCursorPosition - position,
          lineLength
        );
        // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect -- Syncing external absolute cursor position to internal line/position state
        setEditingLine(i);
        // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect -- Syncing external absolute cursor position to internal line/position state
        setCursorPosition(posInLine);
        break;
      }
      position += lineLength + 1; // +1 for newline
    }
  }, [externalCursorPosition, lines]);

  return {
    editingLine,
    setEditingLine,
    cursorPosition,
    setCursorPosition,
    getAbsoluteCursorPosition,
    updateCursorPosition,
  };
}
