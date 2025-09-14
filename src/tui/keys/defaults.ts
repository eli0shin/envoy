import type { KeybindingsConfig } from './types.js';

export const defaultKeybindings: KeybindingsConfig = {
  global: {
    'app.exit': 'C-c',
    'help.toggle': ['<leader>?', 'f1'],
    'global.cancel': 'escape',
  },
  modal: {
    'modal.close': 'escape',
  },
  input: {
    'input.submit': 'enter',
    'input.newline': 'S-enter',
    'input.cursorUp': 'up',
    'input.cursorDown': 'down',
    'input.clear': '<leader>c',
    'input.copy': '<leader>y',
    'input.paste': '<leader>p',
    'input.cut': '<leader>x',
  },
  autocomplete: {
    'command.accept': 'tab',
    'command.prev': 'up',
    'command.next': 'down',
    'command.close': 'escape',
  },
  messages: {
    'messages.scrollPageUp': ['C-u', 'pageup'],
    'messages.scrollPageDown': ['C-d', 'pagedown'],
    'messages.scrollTop': 'home',
    'messages.scrollBottom': 'end',
  },
};
