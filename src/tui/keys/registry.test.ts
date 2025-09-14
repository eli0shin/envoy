import { describe, it, expect, beforeEach } from 'vitest';
import { keybindingsRegistry } from './registry.js';
import { defaultKeybindings } from './defaults.js';
import type { TUIKeyEvent } from './types.js';

const ev = (
  name: string,
  mods: Partial<{
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  }> = {}
): TUIKeyEvent => ({
  name,
  ctrl: !!mods.ctrl,
  shift: !!mods.shift,
  option: !!mods.alt, // Map alt param to option property
  meta: !!mods.meta,
  number: false,
  sequence: '',
  raw: '',
});

describe('keybindings registry', () => {
  beforeEach(() => {
    keybindingsRegistry.set(defaultKeybindings);
  });

  it('returns descriptors for scope/action', () => {
    const desc = keybindingsRegistry.getDescriptors('global', 'app.exit');
    expect(desc).toContain('C-c');
  });

  it('matches events against configured bindings', () => {
    expect(
      keybindingsRegistry.matches('input', 'input.submit', ev('enter'))
    ).toBe(true);
    expect(
      keybindingsRegistry.matches(
        'input',
        'input.newline',
        ev('enter', { shift: true })
      )
    ).toBe(true);
    expect(
      keybindingsRegistry.matches(
        'messages',
        'messages.scrollPageUp',
        ev('pageup')
      )
    ).toBe(true);
    expect(
      keybindingsRegistry.matches(
        'messages',
        'messages.scrollPageUp',
        ev('u', { ctrl: true })
      )
    ).toBe(true);
  });
});
