import type { RegisteredHandler, KeyScope, TUIKeyEvent } from './types.js';

let nextId = 1;

export class KeyEventBus {
  private handlers: RegisteredHandler[] = [];

  register(h: Omit<RegisteredHandler, 'id'>): number {
    const id = nextId++;
    const rec: RegisteredHandler = { ...h, id };
    this.handlers.push(rec);
    // Keep sorted by priority (desc)
    this.handlers.sort((a, b) => b.priority - a.priority);
    return id;
  }

  unregister(id: number) {
    this.handlers = this.handlers.filter((h) => h.id !== id);
  }

  dispatch(ev: TUIKeyEvent) {
    for (const h of this.handlers) {
      if (!h.enabled()) continue;
      const handled = !!h.handle(ev);
      if (handled) return true;
    }
    return false;
  }
}

export const keyEventBus = new KeyEventBus();

export function defaultPriorityForScope(scope: KeyScope): number {
  switch (scope) {
    case 'modal':
      return 100;
    case 'autocomplete':
      return 80;
    case 'input':
      return 60;
    case 'messages':
      return 40;
    case 'global':
    default:
      return 20;
  }
}
