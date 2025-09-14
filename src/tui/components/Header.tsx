import { bold, fg } from '@opentui/core';
import { colors } from '../theme.js';

export function Header() {
  return (
    <box height={3} justifyContent="center">
      <text>{bold(fg(colors.primary)(' Envoy'))}</text>
    </box>
  );
}
