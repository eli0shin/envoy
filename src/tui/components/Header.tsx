import { colors } from '../theme.js';

export function Header() {
  return (
    <box height={3} justifyContent="center" flexShrink={0}>
      <text><b><span fg={colors.primary}> Envoy</span></b></text>
    </box>
  );
}
