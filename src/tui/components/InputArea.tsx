import { useState } from "react";
import { MultiLineInput } from "./MultiLineInput";

type InputAreaProps = {
  onSubmit: (message: string) => void;
  onResize?: () => void;
};

export function InputArea({ onSubmit, onResize }: InputAreaProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (submittedValue: string) => {
    onSubmit(submittedValue.trim());
    setValue("");
  };

  return (
    <box flexDirection="column">
      {/* Top padding line */}
      <box height={1} backgroundColor="#333333">
        <text> </text>
      </box>
      <MultiLineInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        onResize={onResize}
        placeholder="Type your message... (use \ at end of line for newlines)"
        minHeight={1}
        backgroundColor="#333333"
        textColor="white"
      />
      {/* Bottom padding line */}
      <box height={1} backgroundColor="#333333">
        <text> </text>
      </box>
    </box>
  );
}

