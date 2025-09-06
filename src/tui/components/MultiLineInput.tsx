import { useState } from "react";

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
  // Track which line is being edited
  const [editingLine, setEditingLine] = useState(0);
  const lines = value ? value.split('\n') : [''];
  
  // Handle input changes for the current line
  const handleLineInput = (newLineContent: string) => {
    const newLines = [...lines];
    newLines[editingLine] = newLineContent;
    onChange(newLines.join('\n'));
  };

  // Handle submission from any line
  const handleLineSubmit = (lineContent: string) => {
    // Check if line ends with backslash for continuation
    if (lineContent.trim().endsWith('\\')) {
      // Remove backslash and add new line
      const newLines = [...lines];
      newLines[editingLine] = lineContent.trim().slice(0, -1);
      newLines.splice(editingLine + 1, 0, '');
      onChange(newLines.join('\n'));
      setEditingLine(editingLine + 1);
      onResize?.(); // Trigger resize when height changes
    } else if (value.trim()) {
      // Submit the full multi-line content
      onSubmit(value);
      onChange('');
      setEditingLine(0);
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