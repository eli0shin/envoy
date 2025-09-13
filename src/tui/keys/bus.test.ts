import { describe, it, expect, vi, beforeEach } from 'vitest';
import { keyEventBus } from './bus.js';
import type { TUIKeyEvent } from './types.js';
import { keybindingsRegistry } from './registry.js';
import { defaultKeybindings } from './defaults.js';
import { parseKeys } from './useKeys.js';

const ev = (name: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }> = {}): TUIKeyEvent => ({
  name,
  ctrl: !!mods.ctrl,
  shift: !!mods.shift,
  option: !!mods.alt, // Map alt param to option property
  meta: !!mods.meta,
  number: false,
  sequence: '',
  raw: '',
});

describe('key event bus', () => {
  beforeEach(() => {
    // No explicit reset method; rely on new registration for each test
    // Also init registry for parseKeys test
    keybindingsRegistry.set(defaultKeybindings);
  });

  it('dispatches to highest priority enabled handler first', () => {
    const calls: string[] = [];
    keyEventBus.register({ scope: 'messages', priority: 40, enabled: () => true, handle: () => { calls.push('messages'); return false; } });
    keyEventBus.register({ scope: 'global', priority: 20, enabled: () => true, handle: () => { calls.push('global'); return true; } });
    keyEventBus.register({ scope: 'input', priority: 60, enabled: () => true, handle: () => { calls.push('input'); return true; } });

    keyEventBus.dispatch(ev('x'));

    expect(calls[0]).toBe('input');
    // After first true, others not called
    expect(calls).toEqual(['input']);
  });

  it('parseKeys triggers action handler when matched', () => {
    const key = ev('c', { ctrl: true });
    const spy = vi.fn();
    const handled = parseKeys(key, 'app.exit', spy, 'global');
    expect(handled).toBe(true);
    expect(spy).toHaveBeenCalled();
  });
});

