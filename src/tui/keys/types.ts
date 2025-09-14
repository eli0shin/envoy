export type KeyScope =
  | 'global'
  | 'modal'
  | 'autocomplete'
  | 'input'
  | 'messages';

// Keep actions as string literals for flexibility and config friendliness
export type KeyAction =
  | 'app.exit'
  | 'help.toggle'
  | 'modal.close'
  | 'input.submit'
  | 'input.newline'
  | 'input.cursorUp'
  | 'input.cursorDown'
  | 'input.clear'
  | 'input.copy'
  | 'input.paste'
  | 'input.cut'
  | 'command.accept'
  | 'command.next'
  | 'command.prev'
  | 'command.close'
  | 'messages.scrollUp'
  | 'messages.scrollDown'
  | 'messages.scrollPageUp'
  | 'messages.scrollPageDown'
  | 'messages.scrollTop'
  | 'messages.scrollBottom'
  | 'global.cancel';

export type KeyDescriptor = string; // e.g., "C-u", "S-enter", "tab"

export type KeybindingsConfig = Partial<
  Record<KeyScope, Partial<Record<KeyAction, KeyDescriptor | KeyDescriptor[]>>>
>;

// Actual shape of key events from @opentui/react
export type TUIKeyEvent = {
  name: string;
  ctrl: boolean;
  shift: boolean;
  option: boolean; // OpenTUI uses 'option' not 'alt'
  meta: boolean;
  number: boolean;
  sequence: string;
  raw: string;
};

export type KeyHandler = (ev: TUIKeyEvent) => boolean | void;

export type RegisteredHandler = {
  id: number;
  scope: KeyScope;
  priority: number;
  enabled: () => boolean;
  handle: KeyHandler;
};
