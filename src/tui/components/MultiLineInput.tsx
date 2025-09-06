import { useState } from "react";
import { useKeyboard } from "@opentui/react";

type MultiLineInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onResize?: () => void;
  placeholder?: string;
  minHeight?: number;
  backgroundColor?: string;
  textColor?: string;
};

export function MultiLineInput({
  value,
  onChange,
  onSubmit,
  onResize,
  placeholder = "Type your message...",
  minHeight = 3,
  backgroundColor = "#333333",
  textColor = "white",
}: MultiLineInputProps) {
  // Track which line is being edited and cursor position
  const [editingLine, setEditingLine] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const lines = value ? value.split('\n') : [''];
  
  // Handle input changes for the current line
  const handleLineInput = (newLineContent: string) => {
    const newLines = [...lines];
    newLines[editingLine] = newLineContent;
    onChange(newLines.join('\n'));
    setCursorPosition(newLineContent.length);
  };

  // Navigate between lines with arrow keys
  useKeyboard((key) => {
    if (key.name === "up") {
      if (editingLine > 0) {
        const newEditingLine = editingLine - 1;
        setEditingLine(newEditingLine);
        const targetLine = lines[newEditingLine] || '';
        setCursorPosition(Math.min(cursorPosition, targetLine.length));
      }
      return;
    }
    
    if (key.name === "down") {
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
      // Ctrl+Enter submits, regular Enter creates new line
      if (key.ctrl) {
        if (value.trim()) {
          onSubmit(value);
          onChange('');
          setEditingLine(0);
          setCursorPosition(0);
          onResize?.();
        }
        return;
      }
      
      // Create new line at cursor position
      const currentLine = lines[editingLine] || '';
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
  });

  // Handle submission from any line (Ctrl+Enter or backslash continuation)
  const handleLineSubmit = (lineContent: string) => {
    // Check if line ends with backslash for continuation
    if (lineContent.trim().endsWith('\\')) {
      // Remove backslash and add new line
      const newLines = [...lines];
      newLines[editingLine] = lineContent.trim().slice(0, -1);
      newLines.splice(editingLine + 1, 0, '');
      onChange(newLines.join('\n'));
      setEditingLine(editingLine + 1);
      setCursorPosition(0);
      onResize?.(); // Trigger resize when height changes
    } else if (value.trim()) {
      // Submit the full multi-line content
      onSubmit(value);
      onChange('');
      setEditingLine(0);
      setCursorPosition(0);
      onResize?.(); // Trigger resize when content is cleared
    }
  };

  // Calculate dynamic height
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
                focused={true}
                onInput={handleLineInput}
                onSubmit={handleLineSubmit}
                backgroundColor={backgroundColor}
                textColor={textColor}
              />
            ) : (
              <text>
                {line || ' '}
              </text>
            )}
          </box>
        ))}
      </box>
    </box>
  );
}