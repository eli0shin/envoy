import { useKeyboard } from '@opentui/react';
import { keyEventBus } from './bus.js';
import { matchesAnyPrefix, matchesCancel } from './settings.js';
import { getActivePrefix } from './prefixContext.js';
import { keybindingsRegistry } from './registry.js';
import { usePrefixState } from './prefixContext.js';
import { logger } from '../../logger.js';

export function KeyDispatcher() {
  const { setActivePrefixState } = usePrefixState();
  useKeyboard((key, ev?: Event) => {
    // Try to prevent library default handlers (e.g., Escape-to-exit)
    try {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
      // eslint-disable-next-line no-empty
    } catch {}
    const active = getActivePrefix();

    // Guard against malformed/empty events
    const hasName = key && typeof key.name === 'string' && key.name;
    if (!hasName) {
      if (active) {
        setActivePrefixState(null);
      }
      return;
    }

    if (!active) {
      const which = matchesAnyPrefix(key);
      if (which) {
        setActivePrefixState(which);
        return;
      }
      keyEventBus.dispatch(key);
      return;
    }

    // Prefix active
    if (matchesCancel(key)) {
      setActivePrefixState(null);
      return;
    }

    // Does this key complete any prefixed combo?
    if (keybindingsRegistry.matchesAny(key)) {
      keyEventBus.dispatch(key);
      setActivePrefixState(null);
      return;
    }

    // Unmatched while prefix active: cancel and consume without dispatch
    setActivePrefixState(null);
    return;
  });
  return null;
}
