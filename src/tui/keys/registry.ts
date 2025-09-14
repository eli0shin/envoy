import { parseKeyDescriptor } from './parser.js';
import type {
  KeybindingsConfig,
  KeyScope,
  KeyAction,
  KeyDescriptor,
  TUIKeyEvent,
} from './types.js';

export class KeybindingsRegistry {
  private bindings: KeybindingsConfig = {};
  private matchers: Partial<
    Record<KeyScope, Record<string, ((ev: TUIKeyEvent) => boolean)[]>>
  > = {};

  set(bindings: KeybindingsConfig) {
    this.bindings = bindings || {};
    // Rebuild matchers cache
    const cache: typeof this.matchers = {};
    (Object.keys(this.bindings) as KeyScope[]).forEach((scope) => {
      const scopeMap = this.bindings[scope] || {};
      const compiled: Record<string, ((ev: TUIKeyEvent) => boolean)[]> = {};
      Object.entries(scopeMap).forEach(([action, descriptors]) => {
        const arr = Array.isArray(descriptors) ? descriptors : [descriptors];
        compiled[action] = arr
          .filter(Boolean)
          .map((d) => parseKeyDescriptor(d as KeyDescriptor));
      });
      cache[scope] = compiled;
    });
    this.matchers = cache;
  }

  getDescriptors(scope: KeyScope, action: KeyAction): KeyDescriptor[] {
    const scopeMap = this.bindings[scope] || {};
    const val = scopeMap[action];
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  matches(scope: KeyScope, action: KeyAction, ev: TUIKeyEvent): boolean {
    const scopeMatchers = this.matchers[scope] || {};
    const arr = scopeMatchers[action] || [];
    return arr.some((m) => m(ev));
  }

  matchesAny(ev: TUIKeyEvent): boolean {
    for (const scope of Object.keys(this.matchers) as KeyScope[]) {
      const scopeMap = this.matchers[scope] || {};
      for (const arr of Object.values(scopeMap)) {
        if (arr.some((m) => m(ev))) return true;
      }
    }
    return false;
  }

  getAllBindings(): KeybindingsConfig {
    return this.bindings;
  }
}

export const keybindingsRegistry = new KeybindingsRegistry();
