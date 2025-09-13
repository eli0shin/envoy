import { fg } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { Modal } from "./Modal.js";
import { colors } from "../theme.js";
import { commandRegistry } from "../commands/registry.js";

export function HelpModal() {
  const { width } = useTerminalDimensions();
  const commands = commandRegistry.getAll();

  // Calculate content height: commands + header (1) + footer (2: text + spacer) + min scrollbox space
  // Ensure scrollbox has at least 5 lines visible, max total content height of 18 (so modal stays under 20)
  const minScrollboxHeight = 5;
  const headerFooterHeight = 3; // 1 for header, 2 for footer (spacer + text)
  const contentHeight = Math.min(
    18,
    Math.max(
      minScrollboxHeight + headerFooterHeight,
      commands.length + headerFooterHeight
    )
  );

  // Calculate the longest command line (includes "  /" + name + " - " + description)
  const longestLine = Math.max(
    "Available Commands:".length,
    "Press ESC to close".length,
    ...commands.map((cmd) => `  /${cmd.name} - ${cmd.description}`.length)
  );

  // Content width needs to account for:
  // - Scrollbar (1 char)
  // - ScrollBox padding (2 chars)
  // - Extra margin (5 chars)
  // Total: 8 extra chars for content (Modal will add border separately)
  const contentWidth = Math.min(longestLine + 8, Math.floor((width * 0.9) - 2));

  return (
    <Modal width={contentWidth} height={contentHeight}>
      <box height={1} paddingLeft={1}>
        <text>{fg(colors.primary)("Available Commands:")}</text>
      </box>

      <scrollbox
        focused={true}
        style={{
          rootOptions: {
            flexGrow: 1,
            paddingLeft: 1,
            paddingRight: 1,
          },
          contentOptions: {
            flexDirection: "column",
          },
          scrollbarOptions: {
            showArrows: false,
          },
        }}
      >
        {commands.map((cmd, index) => (
          <box key={index} height={1}>
            <text>
              {" "}
              {fg(colors.accent)(`/${cmd.name}`)} - {cmd.description}
            </text>
          </box>
        ))}
      </scrollbox>

      <box height={1}>
        <text> </text>
      </box>
      <box height={1} paddingLeft={1}>
        <text>{fg(colors.muted)("Press ESC to close")}</text>
      </box>
    </Modal>
  );
}