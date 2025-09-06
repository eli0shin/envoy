import { bold, fg } from "@opentui/core";

export function Header() {
  return (
    <box height={3} justifyContent="center">
      <text>{bold(fg("cyan")(" Envoy"))}</text>
    </box>
  );
}

