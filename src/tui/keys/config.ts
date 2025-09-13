import type { KeybindingsConfig, KeyScope, KeyAction, KeyDescriptor } from './types.js';

export function ensureArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function mergeKeybindings(
  defaults: KeybindingsConfig,
  overrides: KeybindingsConfig = {}
): KeybindingsConfig {
  const result: KeybindingsConfig = {};
  const scopes = new Set<KeyScope>([
    'global',
    'modal',
    'autocomplete',
    'input',
    'messages',
  ]);

  scopes.forEach((scope) => {
    const dScope = (defaults[scope] || {}) as Partial<Record<KeyAction, KeyDescriptor | KeyDescriptor[]>>;
    const oScope = (overrides[scope] || {}) as Partial<Record<KeyAction, KeyDescriptor | KeyDescriptor[]>>;
    const actions = new Set<KeyAction>([
      ...Object.keys(dScope),
      ...Object.keys(oScope),
    ] as KeyAction[]);
    const scopeResult: Partial<Record<KeyAction, KeyDescriptor | KeyDescriptor[]>> = {};
    actions.forEach((action) => {
      const d = ensureArray(dScope[action]);
      const o = ensureArray(oScope[action]);
      const picked = o.length > 0 ? o : d;
      if (picked.length > 0) scopeResult[action] = picked;
    });
    if (Object.keys(scopeResult).length > 0) result[scope] = scopeResult;
  });

  return result;
}
