import { commandRegistry } from './registry.js';

// Store callbacks that can be updated
let clearCallback: (() => void) | null = null;
let exitCallback: (() => void) | null = null;
let helpCallback: (() => void) | null = null;

// Register commands immediately when module loads
commandRegistry.register({
  name: 'clear',
  description: 'Clear the conversation history',
  handler: () => {
    if (clearCallback) {
      clearCallback();
    }
    return undefined; // Don't send to agent
  },
});

commandRegistry.register({
  name: 'help',
  description: 'Show available commands',
  handler: () => {
    helpCallback!(); // Always call, will be set before use
    return undefined; // Don't send to agent
  },
});

commandRegistry.register({
  name: 'exit',
  description: 'Exit the application',
  handler: () => {
    if (exitCallback) {
      exitCallback();
    }
    return undefined; // Don't send to agent
  },
});

// Set the callbacks after registration
export function setCommandCallbacks(callbacks: {
  onClear: () => void;
  onExit: () => void;
  onHelp: () => void;
}): void {
  clearCallback = callbacks.onClear;
  exitCallback = callbacks.onExit;
  helpCallback = callbacks.onHelp;
}
