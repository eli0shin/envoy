import { useState } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { fg } from "@opentui/core";
import { colors } from "../theme.js";

type MultiLineInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onResize?: () => void;
  onTabKey?: () => boolean; // Returns true if tab was handled
  onArrowKey?: (direction: "up" | "down") => boolean; // Returns true if arrow was handled
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
  placeholder = "Type your message...",
  minHeight = 3,
  backgroundColor = colors.backgrounds.input,
  textColor = colors.text,
  disabled = false,
}: MultiLineInputProps) {
  // Track which line is being edited and cursor position
  const [editingLine, setEditingLine] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const { width: terminalWidth } = useTerminalDimensions();
  const lines = value ? value.split('\n') : [''];
  
  // Calculate available width for text (terminal width minus prompt area and padding)
  const availableTextWidth = terminalWidth - 6; // 3 for " > " prompt + 3 for padding/borders
  
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
        setCursorPosition(remainingPart.length);
        onResize?.();
        return;
      }
    }
    
    // Normal input handling - no overflow
    const newLines = [...lines];
    newLines[editingLine] = newLineContent;
    onChange(newLines.join('\n'));
    setCursorPosition(newLineContent.length);
  };

  // Navigate between lines with arrow keys
  useKeyboard((key) => {
    // Don't process any keyboard input when disabled
    if (disabled) return;
    
    if (key.name === "tab") {
      // Allow parent to handle tab for autocomplete
      if (onTabKey && onTabKey()) {
        return; // Tab was handled by parent
      }
      // Otherwise, let default tab behavior occur
      return;
    }

    if (key.name === "up") {
      // Allow parent to handle up arrow for autocomplete navigation
      if (onArrowKey && onArrowKey("up")) {
        return; // Arrow was handled by parent
      }
      
      // Default up arrow behavior
      if (editingLine > 0) {
        const newEditingLine = editingLine - 1;
        setEditingLine(newEditingLine);
        const targetLine = lines[newEditingLine] || '';
        setCursorPosition(Math.min(cursorPosition, targetLine.length));
      }
      return;
    }
    
    if (key.name === "down") {
      // Allow parent to handle down arrow for autocomplete navigation
      if (onArrowKey && onArrowKey("down")) {
        return; // Arrow was handled by parent
      }
      
      // Default down arrow behavior
      if (editingLine < lines.length - 1) {
        const newEditingLine = editingLine + 1;
        setEditingLine(newEditingLine);
        const targetLine = lines[newEditingLine] || '';
        setCursorPosition(Math.min(cursorPosition, targetLine.length));
      }
      return;
    }

    if (key.name === "backspace") {
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
          setCursorPosition(targetLine.length);
        }
        
        onResize?.();
        return;
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
        setCursorPosition(previousLine.length);
        onResize?.();
        return;
      }
    }

    if (key.name === "return") {
      const currentLine = lines[editingLine] || '';
      
      // Shift+Enter always creates new line
      if (key.shift) {
        const beforeCursor = currentLine.slice(0, cursorPosition);
        const afterCursor = currentLine.slice(cursorPosition);
        
        const newLines = [...lines];
        newLines[editingLine] = beforeCursor;
        newLines.splice(editingLine + 1, 0, afterCursor);
        onChange(newLines.join('\n'));
        
        setEditingLine(editingLine + 1);
        setCursorPosition(0);
        onResize?.();
        return;
      }
      
      // Check for backslash continuation on Enter
      if (currentLine.trim().endsWith('\\')) {
        // Remove backslash and add new line
        const newLines = [...lines];
        newLines[editingLine] = currentLine.trim().slice(0, -1);
        newLines.splice(editingLine + 1, 0, '');
        onChange(newLines.join('\n'));
        setEditingLine(editingLine + 1);
        setCursorPosition(0);
        onResize?.();
        return;
      }
      
      // Regular Enter - submit message
      if (value.trim()) {
        onSubmit(value);
        onChange('');
        setEditingLine(0);
        setCursorPosition(0);
        onResize?.();
      }
      return;
    }
  });

  // Calculate total height
  const height = Math.max(minHeight, lines.length);

  return (
    <box height={height} backgroundColor={backgroundColor} flexDirection="row">
      <box width={3}>
        <text>{" >"} </text>
      </box>
      <box flexGrow={1} flexDirection="column">
        {lines.map((line, index) => (
          <box key={index} height={1}>
            {index === editingLine ? (
              <input
                value={line}
                placeholder={index === 0 && !value ? placeholder : ""}
                focused={!disabled}
                onInput={handleLineInput}
                backgroundColor={backgroundColor}
                textColor={textColor}
              />
            ) : (
              <text>
                {fg(textColor)(line || ' ')}
              </text>
            )}
          </box>
        ))}
      </box>
    </box>
  );
}