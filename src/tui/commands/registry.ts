import type { ModelMessage } from 'ai';

export type Command = {
  name: string;
  description: string;
  handler: (args: string[]) => string | void;
};

// Module state
const commands = new Map<string, Command>();

export function registerCommand(command: Command): void {
  commands.set(command.name, command);
}

export function getCommand(name: string): Command | undefined {
  return commands.get(name);
}

export function getAllCommands(): Command[] {
  return Array.from(commands.values());
}

export function getCommandSuggestions(prefix: string): Command[] {
  const searchTerm = prefix.startsWith('/') ? prefix.slice(1) : prefix;
  if (!searchTerm) {
    return getAllCommands();
  }

  return getAllCommands().filter((cmd) =>
    cmd.name.toLowerCase().startsWith(searchTerm.toLowerCase())
  );
}

export function parseCommand(input: string): { command: Command | undefined; args: string[] } {
  if (!input.startsWith('/')) {
    return { command: undefined, args: [] };
  }

  const parts = input.slice(1).split(/\s+/);
  const commandName = parts[0];
  const args = parts.slice(1);

  const command = getCommand(commandName);
  return { command, args };
}

export function executeCommand(input: string): {
  isCommand: boolean;
  result?: string;
  commandName?: string;
} {
  const { command, args } = parseCommand(input);

  if (!command) {
    // Not a valid command, treat as regular message
    return { isCommand: false };
  }

  const result = command.handler(args);
  return {
    isCommand: true,
    result: result || undefined,
    commandName: command.name,
  };
}

export function formatCommandMessage(commandInput: string): ModelMessage {
  return {
    role: 'user',
    content: `<user-command>${commandInput}</user-command><system-hint>Note: This is a command executed by the user. Do not respond to this command.</system-hint>`,
  };
}
