import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { colors } from "../theme.js";
import type { ReactNode } from "react";

type ModalProps = {
  width: number;
  height: number;
  children: ReactNode;
};

export function Modal({ width, height, children }: ModalProps) {
  const { width: terminalWidth, height: terminalHeight } =
    useTerminalDimensions();

  // Add frame padding to the content dimensions
  // Border adds 2 chars width and 2 chars height
  const frameWidth = width + 2; // +2 for left and right borders
  const frameHeight = height + 2; // +2 for top and bottom borders

  // Calculate centered position using frame dimensions
  const top = Math.floor(terminalHeight / 2) - Math.floor(frameHeight / 2);
  const left = Math.floor(terminalWidth / 2) - Math.floor(frameWidth / 2);

  return (
    <box
      position="absolute"
      top={top}
      left={left}
      width={frameWidth}
      height={frameHeight}
      zIndex={1000}
      borderStyle="single"
      borderColor={colors.primary}
      backgroundColor={colors.backgrounds.main}
      flexDirection="column"
    >
      {children}
    </box>
  );
}

