import { parseKeyDescriptor } from './parser.js';
import type { KeyDescriptor, TUIKeyEvent } from './types.js';
import { logger } from '../../logger.js';

type PrefixSettings = {
  prefixes: Record<string, KeyDescriptor | KeyDescriptor[]>;
  prefixCancel: KeyDescriptor | KeyDescriptor[];
};

let settings: PrefixSettings = {
  prefixes: { leader: 'C-e' },
  prefixCancel: 'escape',
};

let prefixMatchers: Record<string, ((ev: TUIKeyEvent) => boolean)[]> = {};
let cancelMatchers: ((ev: TUIKeyEvent) => boolean)[] = [];

// Initialize default matchers
function initializeMatchers() {
  prefixMatchers = {};
  Object.entries(settings.prefixes).forEach(([name, desc]) => {
    const arr = Array.isArray(desc) ? desc : [desc];
    prefixMatchers[name] = arr.map((d) => parseKeyDescriptor(d));
  });
  const cancels =
    Array.isArray(settings.prefixCancel) ?
      settings.prefixCancel
    : [settings.prefixCancel];
  cancelMatchers = cancels.map((d) => parseKeyDescriptor(d));
}

// Initialize on module load
initializeMatchers();

export function getKeySettings(): PrefixSettings {
  return settings;
}

export function setKeySettings(newSettings: Partial<PrefixSettings>) {
  settings = { ...settings, ...newSettings };
  initializeMatchers();
}

export function getPrefixNames(): string[] {
  return Object.keys(prefixMatchers);
}

export function matchesAnyPrefix(ev: TUIKeyEvent): string | null {
  for (const [name, matchers] of Object.entries(prefixMatchers)) {
    if (matchers.some((m) => m(ev))) return name;
  }
  return null;
}

export function matchesCancel(ev: TUIKeyEvent): boolean {
  return cancelMatchers.some((m) => m(ev));
}
