import { useState } from "react";
import { MultiLineInput } from "./MultiLineInput";

type InputAreaProps = {
  onSubmit: (message: string) => void;
};

export function InputArea({ onSubmit }: InputAreaProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (submittedValue: string) => {
    onSubmit(submittedValue.trim());
    setValue("");
  };

  return (
    <box borderStyle="single">
      <MultiLineInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder="Type your message... (use \ at end of line for newlines)"
        minHeight={1}
        backgroundColor="#333333"
        textColor="white"
      />
    </box>
  );
}

