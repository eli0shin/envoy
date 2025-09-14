import { describe, it, expect } from 'vitest';
import {
  compileDescriptor,
  matchCompiled,
  normalizeKeyName,
  parseKeyDescriptor,
} from './parser.js';

const ev = (
  name: string,
  mods: Partial<{
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  }> = {}
) => ({
  name,
  ctrl: !!mods.ctrl,
  shift: !!mods.shift,
  option: !!mods.alt, // Map alt param to option property
  meta: !!mods.meta,
  number: false,
  sequence: '',
  raw: '',
});

describe('key descriptor parser', () => {
  it('normalizes key names and aliases', () => {
    expect(normalizeKeyName('RETURN')).toBe('enter');
    expect(normalizeKeyName('Esc')).toBe('escape');
    expect(normalizeKeyName('PgUp')).toBe('pageup');
  });

  it('compiles and matches simple keys', () => {
    const cd = compileDescriptor('tab');
    expect(matchCompiled(ev('tab'), cd)).toBe(true);
    expect(matchCompiled(ev('enter'), cd)).toBe(false);
  });

  it('handles modifiers correctly', () => {
    const cd = compileDescriptor('C-u');
    expect(matchCompiled(ev('u', { ctrl: true }), cd)).toBe(true);
    expect(matchCompiled(ev('u'), cd)).toBe(false);
    expect(matchCompiled(ev('u', { ctrl: true, shift: true }), cd)).toBe(false);
  });

  it('supports shift modifier names', () => {
    const matcher = parseKeyDescriptor('S-enter');
    expect(matcher(ev('enter', { shift: true }))).toBe(true);
    expect(matcher(ev('enter'))).toBe(false);
  });

  it('supports alt/meta via M- and Cmd-', () => {
    const mAlt = parseKeyDescriptor('M-.');
    expect(mAlt(ev('.', { alt: true }))).toBe(true);
    const mCmd = parseKeyDescriptor('Cmd-k');
    expect(mCmd(ev('k', { meta: true }))).toBe(true);
  });
});
