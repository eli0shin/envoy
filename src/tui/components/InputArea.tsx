import { useState } from "react";

type InputAreaProps = {
  onSubmit: (message: string) => void;
};

export function InputArea({ onSubmit }: InputAreaProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSubmit(trimmedValue);
      setValue("");
    }
  };

  return (
    <box height={3} borderStyle="single">
      <input
        placeholder="Type your message..."
        value={value}
        focused
        onInput={setValue}
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          backgroundColor: "#333333",
        }}
      />
    </box>
  );
}

