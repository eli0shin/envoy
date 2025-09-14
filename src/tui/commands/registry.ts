import type { CoreMessage } from 'ai';

export type Command = {
  name: string;
  description: string;
  handler: (args: string[]) => string | void;
};

export class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    this.commands.set(command.name, command);
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  getSuggestions(prefix: string): Command[] {
    const searchTerm = prefix.startsWith('/') ? prefix.slice(1) : prefix;
    if (!searchTerm) {
      return this.getAll();
    }

    return this.getAll().filter((cmd) =>
      cmd.name.toLowerCase().startsWith(searchTerm.toLowerCase())
    );
  }

  parse(input: string): { command: Command | undefined; args: string[] } {
    if (!input.startsWith('/')) {
      return { command: undefined, args: [] };
    }

    const parts = input.slice(1).split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    const command = this.get(commandName);
    return { command, args };
  }

  execute(input: string): {
    isCommand: boolean;
    result?: string;
    commandName?: string;
  } {
    const { command, args } = this.parse(input);

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

  formatCommandMessage(commandInput: string): CoreMessage {
    return {
      role: 'user',
      content: `<user-command>${commandInput}</user-command><system-hint>Note: This is a command executed by the user. Do not respond to this command.</system-hint>`,
    };
  }
}

// Create singleton instance
export const commandRegistry = new CommandRegistry();
