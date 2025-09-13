import type { KeyDescriptor, TUIKeyEvent } from './types.js';
import { getActivePrefix } from './prefixContext.js';
import { logger } from '../../logger.js';

const NAME_ALIASES: Record<string, string> = {
  return: 'enter',
  esc: 'escape',
  pgup: 'pageup',
  pgdown: 'pagedown',
};

type CompiledDescriptor = {
  name: string;
  ctrl: boolean;
  shift: boolean;
  option: boolean; // Maps to 'alt'/'M-' in descriptors but 'option' in events
  meta: boolean;
};

export function normalizeKeyName(name: string | undefined): string {
  if (typeof name !== 'string' || name.length === 0) return '';
  const lower = name.toLowerCase();
  return NAME_ALIASES[lower] || lower;
}

function parsePrefixed(descriptor: string): { requiredPrefix: string | null; rest: string } {
  const trimmed = descriptor.trim();
  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>');
    if (end > 1) {
      const name = trimmed.slice(1, end);
      const rest = trimmed.slice(end + 1);
      return { requiredPrefix: name, rest: rest.length ? rest : '' };
    }
  }
  return { requiredPrefix: null, rest: trimmed };
}

export function compileDescriptor(descriptor: KeyDescriptor): CompiledDescriptor {
  const { rest } = parsePrefixed(descriptor);
  const base = rest || '';
  let ctrl = false,
    shift = false,
    option = false,
    meta = false;
  const target = base || descriptor;
  const keyParts = target.split('-');
  const namePart = keyParts[keyParts.length - 1];

  for (let i = 0; i < keyParts.length - 1; i++) {
    const p = keyParts[i].toLowerCase();
    if (p === 'c' || p === 'ctrl' || p === 'control') ctrl = true;
    else if (p === 's' || p === 'shift') shift = true;
    else if (p === 'm' || p === 'alt' || p === 'meta') option = true; // treat M-/alt as option
    else if (p === 'cmd' || p === 'command') meta = true;
  }

  const name = normalizeKeyName(namePart);
  const compiled = { name, ctrl, shift, option, meta };
  return compiled;
}

export function matchCompiled(ev: TUIKeyEvent, cd: CompiledDescriptor): boolean {
  const evName = normalizeKeyName(ev?.name);
  const nameMatch = evName === cd.name;
  const ctrlMatch = !!ev.ctrl === cd.ctrl;
  const shiftMatch = !!ev.shift === cd.shift;
  const optionMatch = !!ev.option === cd.option;
  const metaMatch = !!ev.meta === cd.meta;

  const result = nameMatch && ctrlMatch && shiftMatch && optionMatch && metaMatch;

  return result;
}

export function parseKeyDescriptor(descriptor: KeyDescriptor): (ev: TUIKeyEvent) => boolean {
  const { requiredPrefix } = parsePrefixed(descriptor);
  const compiled = compileDescriptor(descriptor);
  return (ev: TUIKeyEvent) => {
    const active = getActivePrefix();
    if (requiredPrefix) {
      if (active !== requiredPrefix) return false;
      return matchCompiled(ev, compiled);
    }
    // Non-prefixed descriptors do not match while a prefix is active
    if (active) return false;
    return matchCompiled(ev, compiled);
  };
}
