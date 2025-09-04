# Multi-Line Input Key Bindings

## Overview

The CLI agent now supports multi-line input with intuitive key bindings that work reliably across different terminal emulators and operating systems.

## Key Bindings

### Universal (All Platforms)

- **Enter**: Send the message
- **Backslash continuation**: Lines ending with `\` will continue to the next line when Enter is pressed

### Navigation

- **Up/Down arrows**: Navigate between lines in multi-line mode
- **Left/Right arrows**: Navigate within the current line
- **Ctrl+A**: Move to beginning of current line
- **Ctrl+E**: Move to end of current line

### Editing

- **Backspace**: Delete character before cursor
- **Delete**: Delete character after cursor
- **Ctrl+U**: Clear from cursor to beginning of line
- **Ctrl+K**: Clear from cursor to end of line

## Why These Key Bindings?

We chose Enter to send with backslash continuation because:

1. **Universal compatibility**: Enter and backslash continuation work consistently across all terminal emulators
2. **Familiar**: This pattern is used in shell scripting and many command-line tools
3. **Reliable**: Terminal emulators reliably handle these patterns without interference
4. **Intuitive**: Enter naturally feels like "send" while backslash continuation is a well-known shell pattern

The backslash continuation feature provides a shell-like experience that works universally across all terminals.

## Visual Feedback

When in multi-line mode, the input area displays:

- A mode indicator showing "Multi-line mode • Enter to send, end line with \ for new line"
- The prompt (>) appears only on the first line
- Subsequent lines are properly aligned

## Mode Detection

The system automatically switches to multi-line mode when:

- You press Enter on a line ending with backslash (`\`)
- You paste content containing newlines
- You navigate between lines with arrow keys

## Examples

### Single-line input

```
╭─────────────────────────────────────────────────────────────────────────────╮
│ > Hello world                                                               │
╰─────────────────────────────────────────────────────────────────────────────╯
```

### Multi-line input

```
╭─────────────────────────────────────────────────────────────────────────────╮
│ > This is the first line                                                    │
│   This is the second line                                                   │
│   This is the third line                                                    │
│                                                                             │
│ Multi-line mode • Enter to send, end line with \ for new line              │
╰─────────────────────────────────────────────────────────────────────────────╯
```

## Troubleshooting

If multi-line input isn't working properly:

1. Ensure you're ending lines with backslash (`\`) followed by Enter to continue
2. Check that your terminal supports proper character handling
3. Try different terminal emulators if issues persist

### Backslash Continuation

Use backslash continuation to create multi-line input:

```
> This is the first line \
  This continues on the next line
```

When you press Enter after a line ending with `\`, it will create a new line instead of sending the message.
