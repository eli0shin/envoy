import { useState } from "react";
import { MultiLineInput } from "./MultiLineInput";
import { colors } from "../theme.js";

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
      <box height={1} backgroundColor={colors.backgrounds.input}>
        <text> </text>
      </box>
      <MultiLineInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        onResize={onResize}
        placeholder="Type your message... (Shift+Enter or \ for newlines, Enter to send)"
        minHeight={1}
        backgroundColor={colors.backgrounds.input}
        textColor={colors.text}
      />
      {/* Bottom padding line */}
      <box height={1} backgroundColor={colors.backgrounds.input}>
        <text> </text>
      </box>
    </box>
  );
}
