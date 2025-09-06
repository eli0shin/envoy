import { bold, fg } from "@opentui/core";

type HeaderProps = {
  sessionId?: string;
};

export function Header({ sessionId }: HeaderProps) {
  return (
    <box height={3} borderStyle="single" justifyContent="space-between">
      <text>{bold(fg("cyan")("Language Learner"))}</text>
      {sessionId && <text>{fg("gray")(`Session: ${sessionId}`)}</text>}
    </box>
  );
}

