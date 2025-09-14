import { useEffect, useRef, useMemo } from 'react';
import { keybindingsRegistry } from './registry.js';
import { keyEventBus, defaultPriorityForScope } from './bus.js';
import type { KeyAction, KeyScope, KeyHandler, TUIKeyEvent } from './types.js';

export type UseKeysOptions = {
  scope: KeyScope;
  enabled?: boolean | (() => boolean);
  priority?: number;
};

export function useKeys(handler: KeyHandler, opts: UseKeysOptions) {
  const idRef = useRef<number | null>(null);
  const priority = opts.priority ?? defaultPriorityForScope(opts.scope);

  useEffect(() => {
    const enabled =
      typeof opts.enabled === 'function' ?
        opts.enabled
      : () => (opts.enabled ?? true) as boolean;

    idRef.current = keyEventBus.register({
      scope: opts.scope,
      enabled,
      priority,
      handle: (ev) => handler(ev as TUIKeyEvent),
    });
    return () => {
      if (idRef.current !== null) {
        keyEventBus.unregister(idRef.current);
        idRef.current = null;
      }
    };
  }, [opts.scope, priority, opts.enabled, handler]);
}

export function parseKeys(
  ev: TUIKeyEvent,
  action: KeyAction,
  onMatch: () => void,
  scope: KeyScope
): boolean {
  if (keybindingsRegistry.matches(scope, action, ev)) {
    onMatch();
    return true;
  }
  return false;
}
