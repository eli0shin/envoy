import { keybindingsRegistry } from './registry.js';
import { getKeySettings } from './settings.js';
import type { KeyAction, KeyScope } from './types.js';

type KeyShortcut = {
  keys: string;
  action: KeyAction;
  description: string;
  scope: KeyScope;
};

// Human-readable descriptions for key actions
const ACTION_DESCRIPTIONS: Record<string, string> = {
  // Global actions
  'help.toggle': 'Toggle this help',
  'app.exit': 'Exit application',
  'global.cancel': 'Cancel operation',

  // Input actions
  'input.submit': 'Submit input',
  'input.newline': 'New line',
  'input.cancel': 'Cancel input',
  'input.clear': 'Clear input',
  'input.historyUp': 'Previous in history',
  'input.historyDown': 'Next in history',
  'input.cursorLeft': 'Move cursor left',
  'input.cursorRight': 'Move cursor right',
  'input.cursorUp': 'Move cursor up',
  'input.cursorDown': 'Move cursor down',
  'input.cursorHome': 'Move to start',
  'input.cursorEnd': 'Move to end',
  'input.deleteLeft': 'Delete character left',
  'input.deleteRight': 'Delete character right',
  'input.deleteWord': 'Delete word',
  'input.deleteLine': 'Delete line',

  // Messages actions
  'messages.scrollUp': 'Scroll up',
  'messages.scrollDown': 'Scroll down',
  'messages.scrollPageUp': 'Scroll page up',
  'messages.scrollPageDown': 'Scroll page down',
  'messages.scrollTop': 'Scroll to top',
  'messages.scrollBottom': 'Scroll to bottom',

  // Modal actions
  'modal.close': 'Close modal',

  // Autocomplete actions
  'autocomplete.up': 'Move up in list',
  'autocomplete.down': 'Move down in list',
  'autocomplete.accept': 'Accept selection',
  'autocomplete.cancel': 'Cancel autocomplete',
  'command.accept': 'Accept command',
  'command.prev': 'Previous command',
  'command.next': 'Next command',
  'command.close': 'Close command list',
};

/**
 * Format a key descriptor for display in help
 * Converts internal format to user-friendly display format
 */
export function formatKeyForDisplay(descriptor: string): string {
  const settings = getKeySettings();

  // Handle prefixed keys like <leader>?
  const prefixMatch = descriptor.match(/^<(\w+)>(.+)$/);
  if (prefixMatch) {
    const [, prefixName, keyPart] = prefixMatch;
    const prefixKey = settings.prefixes[prefixName];
    if (prefixKey) {
      // Use the first prefix if it's an array
      const primaryPrefix = Array.isArray(prefixKey) ? prefixKey[0] : prefixKey;
      const formattedPrefix = formatKeyDescriptor(primaryPrefix);
      const formattedKey = formatKeyDescriptor(keyPart);
      return `${formattedPrefix} ${formattedKey}`;
    }
  }

  return formatKeyDescriptor(descriptor);
}

/**
 * Format a single key descriptor (non-prefixed)
 */
function formatKeyDescriptor(descriptor: string): string {
  // Handle modifier combinations
  const parts = descriptor.split('-');
  if (parts.length > 1) {
    const modifiers = parts.slice(0, -1);
    const key = parts[parts.length - 1];

    const formattedModifiers = modifiers.map((mod) => {
      switch (mod.toLowerCase()) {
        case 'c':
        case 'ctrl':
        case 'control':
          return 'Ctrl';
        case 's':
        case 'shift':
          return 'Shift';
        case 'm':
        case 'alt':
        case 'meta':
          return 'Alt';
        case 'cmd':
        case 'command':
          return 'Cmd';
        default:
          return mod;
      }
    });

    return `${formattedModifiers.join('+')}+${capitalizeKey(key)}`;
  }

  return capitalizeKey(descriptor);
}

/**
 * Capitalize key names for display
 */
function capitalizeKey(key: string): string {
  // Special cases
  const specialKeys: Record<string, string> = {
    enter: 'Enter',
    return: 'Enter',
    tab: 'Tab',
    escape: 'Escape',
    esc: 'Escape',
    space: 'Space',
    backspace: 'Backspace',
    delete: 'Delete',
    home: 'Home',
    end: 'End',
    pageup: 'Page Up',
    pagedown: 'Page Down',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  };

  return specialKeys[key.toLowerCase()] || key.toUpperCase();
}

/**
 * Get all keyboard shortcuts suitable for help display
 */
export function getKeyboardShortcuts(): KeyShortcut[] {
  const shortcuts: KeyShortcut[] = [];
  const bindings = keybindingsRegistry.getAllBindings();

  // Priority order for scopes to show most important first
  const scopeOrder: KeyScope[] = [
    'global',
    'input',
    'messages',
    'modal',
    'autocomplete',
  ];

  for (const scope of scopeOrder) {
    const scopeBindings = bindings[scope];
    if (!scopeBindings) continue;

    for (const [action, descriptors] of Object.entries(scopeBindings)) {
      const description = ACTION_DESCRIPTIONS[action];
      if (!description) continue; // Skip actions without descriptions

      // Handle both single descriptors and arrays
      const descriptorArray =
        Array.isArray(descriptors) ? descriptors : [descriptors];

      // Use the first descriptor for display (primary binding)
      const primaryDescriptor = descriptorArray[0];
      if (typeof primaryDescriptor === 'string' && primaryDescriptor.trim()) {
        shortcuts.push({
          keys: formatKeyForDisplay(primaryDescriptor),
          action: action as KeyAction,
          description,
          scope,
        });
      }
    }
  }

  return shortcuts;
}

/**
 * Group shortcuts by scope for organized display
 */
export function getGroupedKeyboardShortcuts(): Record<KeyScope, KeyShortcut[]> {
  const shortcuts = getKeyboardShortcuts();
  const grouped: Record<string, KeyShortcut[]> = {};

  for (const shortcut of shortcuts) {
    if (!grouped[shortcut.scope]) {
      grouped[shortcut.scope] = [];
    }
    grouped[shortcut.scope].push(shortcut);
  }

  return grouped as Record<KeyScope, KeyShortcut[]>;
}
