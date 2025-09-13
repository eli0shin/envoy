import { describe, it, expect, beforeEach } from 'vitest';
import { parseKeyDescriptor } from './parser.js';
import { setActivePrefix, clearPrefix } from './prefixContext.js';

const ev = (name: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }> = {}) => ({
  name,
  ctrl: !!mods.ctrl,
  shift: !!mods.shift,
  option: !!mods.alt, // Map alt param to option property
  meta: !!mods.meta,
  number: false,
  sequence: '',
  raw: '',
});

describe('prefixed descriptor matching', () => {
  beforeEach(() => {
    clearPrefix();
  });

  it('non-prefixed descriptors do not match while prefix is active', () => {
    const matcher = parseKeyDescriptor('enter');
    setActivePrefix('leader');
    expect(matcher(ev('enter'))).toBe(false);
  });

  it('prefixed descriptors match only with correct active prefix', () => {
    const matcher = parseKeyDescriptor('<leader>?');
    expect(matcher(ev('?'))).toBe(false);
    setActivePrefix('leader');
    expect(matcher(ev('?'))).toBe(true);
  });
});

