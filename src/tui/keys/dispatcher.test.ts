import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyDispatcher } from './dispatcher.js';
import { keybindingsRegistry } from './registry.js';
import { defaultKeybindings } from './defaults.js';
import { setKeySettings } from './settings.js';
import { clearPrefix, getActivePrefix } from './prefixContext.js';
import { keyEventBus } from './bus.js';
import type { TUIKeyEvent } from './types.js';

// Mock useKeyboard from @opentui/react
vi.mock('@opentui/react', () => {
  return {
    useKeyboard: (cb: (key: TUIKeyEvent) => void) => {
      // expose callback for test usage
      (globalThis as typeof globalThis & { __kb_cb__: (key: TUIKeyEvent) => void }).__kb_cb__ = cb;
    },
  };
});

// Mock usePrefixState hook to properly sync with module state
vi.mock('./prefixContext.js', async () => {
  const actual = await vi.importActual('./prefixContext.js') as {
    setActivePrefix: (name: string) => void;
    clearPrefix: () => void;
    getActivePrefix: () => string | null;
  };

  const mockSetActivePrefixState = vi.fn((name: string | null) => {
    // Update the actual module state when mock is called
    if (name === null) {
      actual.clearPrefix();
    } else {
      actual.setActivePrefix(name);
    }
  });

  return {
    ...actual,
    usePrefixState: () => ({
      activePrefix: null, // This doesn't matter as tests use getActivePrefix()
      setActivePrefixState: mockSetActivePrefixState,
    }),
  };
});

const send = (name: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }> = {}) => {
  const cb = (globalThis as typeof globalThis & { __kb_cb__: (key: TUIKeyEvent) => void }).__kb_cb__;
  cb({ name, ctrl: !!mods.ctrl, shift: !!mods.shift, option: !!mods.alt, meta: !!mods.meta, number: false, sequence: '', raw: '' });
};

describe('KeyDispatcher with prefix', () => {
  beforeEach(() => {
    keybindingsRegistry.set(defaultKeybindings);
    setKeySettings({ prefixes: { leader: 'C-e' }, prefixCancel: 'escape' });
    clearPrefix();
    // render dispatcher to register keyboard callback
    KeyDispatcher();
  });

  it('activates and completes a prefixed combo, then clears prefix', () => {
    const spy = vi.fn();
    keybindingsRegistry.set({
      global: { 'help.toggle': '<leader>?' },
    });

    keyEventBus.register({ scope: 'global', priority: 20, enabled: () => true, handle: (key) => {
      return (key.name === '?' && (spy(), true)) || false;
    }});

    // Activate prefix
    send('e', { ctrl: true });
    expect(getActivePrefix()).toBe('leader');

    // Complete with ?
    send('?');
    expect(spy).toHaveBeenCalled();
    expect(getActivePrefix()).toBeNull();
  });

  it('cancels prefix on unmatched key and consumes it (no dispatch)', () => {
    const calls: TUIKeyEvent[] = [];
    keyEventBus.register({ scope: 'global', priority: 20, enabled: () => true, handle: (key) => { calls.push(key); return false; }});

    send('e', { ctrl: true });
    expect(getActivePrefix()).toBe('leader');

    send('x'); // unmatched
    expect(getActivePrefix()).toBeNull();
    // Should not have dispatched to handlers on unmatched
    expect(calls.length).toBe(0);
  });

  it('cancels prefix on malformed event (no name) without dispatching', () => {
    const calls: TUIKeyEvent[] = [];
    keyEventBus.register({ scope: 'global', priority: 20, enabled: () => true, handle: (key) => { calls.push(key); return false; }});

    send('e', { ctrl: true });
    expect(getActivePrefix()).toBe('leader');

    const cb = (globalThis as typeof globalThis & { __kb_cb__: (key: TUIKeyEvent) => void }).__kb_cb__;
    cb({} as TUIKeyEvent); // malformed event

    expect(getActivePrefix()).toBeNull();
    expect(calls.length).toBe(0);
  });

  it('cancels prefix on escape and consumes it', () => {
    send('e', { ctrl: true });
    expect(getActivePrefix()).toBe('leader');
    send('escape');
    expect(getActivePrefix()).toBeNull();
  });
});
