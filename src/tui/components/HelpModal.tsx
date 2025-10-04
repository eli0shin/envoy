import { useTerminalDimensions } from '@opentui/react';
import { Modal } from './Modal.js';
import { colors } from '../theme.js';
import { commandRegistry } from '../commands/registry.js';
import { getKeyboardShortcuts } from '../keys/display.js';

export function HelpModal() {
  const { width } = useTerminalDimensions();
  const commands = commandRegistry.getAll();
  const shortcuts = getKeyboardShortcuts();

  // Calculate content height: commands + shortcuts + headers + footer + min scrollbox space
  // Include space for both sections: "Available Commands:" + commands + empty line + "Keyboard Shortcuts:" + shortcuts
  // Ensure scrollbox has at least 8 lines visible, max total content height of 25 (so modal stays reasonable)
  const minScrollboxHeight = 8;
  const headerFooterHeight = 3; // 1 for main header, 2 for footer (spacer + text)
  const sectionsOverhead = 2; // 1 for shortcuts header + 1 for spacing between sections
  const totalContentLines =
    commands.length + shortcuts.length + sectionsOverhead;
  const contentHeight = Math.min(
    25,
    Math.max(
      minScrollboxHeight + headerFooterHeight,
      totalContentLines + headerFooterHeight
    )
  );

  // Calculate the longest line across all content
  const longestLine = Math.max(
    'Available Commands:'.length,
    'Keyboard Shortcuts:'.length,
    'Press ESC to close'.length,
    ...commands.map((cmd) => `  /${cmd.name} - ${cmd.description}`.length),
    ...shortcuts.map(
      (shortcut) => `  ${shortcut.keys} - ${shortcut.description}`.length
    )
  );

  // Content width needs to account for:
  // - Scrollbar (1 char)
  // - ScrollBox padding (2 chars)
  // - Extra margin (5 chars)
  // Total: 8 extra chars for content (Modal will add border separately)
  const contentWidth = Math.min(longestLine + 8, Math.floor(width * 0.9 - 2));

  return (
    <Modal width={contentWidth} height={contentHeight}>
      <scrollbox
        focused={true}
        style={{
          rootOptions: {
            flexGrow: 1,
            paddingLeft: 1,
            paddingRight: 1,
          },
          contentOptions: {
            flexDirection: 'column',
          },
          scrollbarOptions: {
            showArrows: false,
          },
        }}
      >
        <box height={1} paddingLeft={1}>
          <text><span fg={colors.primary}>Available Commands:</span></text>
        </box>
        {commands.map((cmd) => (
          <box key={cmd.name} height={1}>
            <text>
              {' '}
              <span fg={colors.accent}>/{cmd.name}</span> - {cmd.description}
            </text>
          </box>
        ))}

        <box height={1}>
          <text> </text>
        </box>

        <box height={1}>
          <text><span fg={colors.primary}>Keyboard Shortcuts:</span></text>
        </box>

        {shortcuts.map((shortcut) => (
          <box key={shortcut.action} height={1}>
            <text>
              {' '}
              <span fg={colors.accent}>{shortcut.keys}</span> - {shortcut.description}
            </text>
          </box>
        ))}
      </scrollbox>

      <box height={1}>
        <text> </text>
      </box>
      <box height={1} paddingLeft={1}>
        <text><span fg={colors.muted}>Press ESC to close</span></text>
      </box>
    </Modal>
  );
}
