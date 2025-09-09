import { commandRegistry } from "./registry.js";

// Store callbacks that can be updated
let clearCallback: (() => void) | null = null;
let exitCallback: (() => void) | null = null;

// Register commands immediately when module loads
commandRegistry.register({
  name: "clear",
  description: "Clear the conversation history",
  handler: () => {
    if (clearCallback) {
      clearCallback();
    }
    return undefined; // Don't send to agent
  }
});

commandRegistry.register({
  name: "help",
  description: "Show available commands",
  handler: () => {
    const commands = commandRegistry.getAll();
    const helpText = [
      "Available commands:",
      ...commands.map(cmd => `  /${cmd.name} - ${cmd.description}`)
    ].join("\n");
    return helpText; // Send help text as user message
  }
});

commandRegistry.register({
  name: "exit",
  description: "Exit the application",
  handler: () => {
    if (exitCallback) {
      exitCallback();
    }
    return undefined; // Don't send to agent
  }
});

// Set the callbacks after registration
export function setCommandCallbacks(
  callbacks: {
    onClear: () => void;
    onExit: () => void;
  }
): void {
  clearCallback = callbacks.onClear;
  exitCallback = callbacks.onExit;
}