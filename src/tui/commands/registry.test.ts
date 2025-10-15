import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerCommand,
  getCommand,
  getAllCommands,
  getCommandSuggestions,
  parseCommand,
  executeCommand,
  clearCommands,
} from './registry.js';

describe('Command Registry (Functional API)', () => {
  beforeEach(() => {
    // Clear all commands before each test for isolation
    clearCommands();
  });

  describe('basic registration and retrieval', () => {
    it('should register and retrieve a command', () => {
      const testCommand = {
        name: 'test',
        description: 'Test command',
        handler: () => 'test result',
      };

      registerCommand(testCommand);
      const retrieved = getCommand('test');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test');
      expect(retrieved?.description).toBe('Test command');
    });

    it('should return all registered commands', () => {
      registerCommand({
        name: 'cmd1',
        description: 'Command 1',
        handler: () => {},
      });
      registerCommand({
        name: 'cmd2',
        description: 'Command 2',
        handler: () => {},
      });
      registerCommand({
        name: 'cmd3',
        description: 'Command 3',
        handler: () => {},
      });

      const all = getAllCommands();
      expect(all).toHaveLength(3);
      expect(all.map((c) => c.name)).toEqual(['cmd1', 'cmd2', 'cmd3']);
    });
  });

  describe('getSuggestions', () => {
    beforeEach(() => {
      registerCommand({
        name: 'clear',
        description: 'Clear screen',
        handler: () => {},
      });
      registerCommand({
        name: 'help',
        description: 'Show help',
        handler: () => {},
      });
      registerCommand({
        name: 'exit',
        description: 'Exit app',
        handler: () => {},
      });
    });

    it("should return ALL commands when input is just '/'", () => {
      const suggestions = getCommandSuggestions('/');

      expect(suggestions).toHaveLength(3);
      expect(suggestions.map((s) => s.name)).toContain('clear');
      expect(suggestions.map((s) => s.name)).toContain('help');
      expect(suggestions.map((s) => s.name)).toContain('exit');
    });

    it('should return ALL commands when input is empty string', () => {
      const suggestions = getCommandSuggestions('');

      expect(suggestions).toHaveLength(3);
    });

    it('should filter commands when partial name provided after slash', () => {
      const suggestions = getCommandSuggestions('/cl');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].name).toBe('clear');
    });

    it('should filter commands when partial name provided after slash', () => {
      const suggestions = getCommandSuggestions('/e');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].name).toBe('exit');
    });

    it('should return empty array when no matches', () => {
      const suggestions = getCommandSuggestions('/xyz');

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('parse', () => {
    beforeEach(() => {
      registerCommand({
        name: 'test',
        description: 'Test',
        handler: () => {},
      });
    });

    it('should parse command with args', () => {
      const result = parseCommand('/test arg1 arg2');

      expect(result.command).toBeDefined();
      expect(result.command?.name).toBe('test');
      expect(result.args).toEqual(['arg1', 'arg2']);
    });

    it('should return undefined command for non-slash input', () => {
      const result = parseCommand('test');

      expect(result.command).toBeUndefined();
      expect(result.args).toEqual([]);
    });
  });

  describe('execute', () => {
    it('should execute command and return result', () => {
      registerCommand({
        name: 'test',
        description: 'Test',
        handler: (args: string[]) => `Result: ${args.join(', ')}`,
      });

      const result = executeCommand('/test arg1 arg2');

      expect(result.isCommand).toBe(true);
      expect(result.result).toBe('Result: arg1, arg2');
      expect(result.commandName).toBe('test');
    });

    it('should handle commands that return undefined', () => {
      registerCommand({
        name: 'void',
        description: 'Void command',
        handler: () => undefined,
      });

      const result = executeCommand('/void');

      expect(result.isCommand).toBe(true);
      expect(result.result).toBeUndefined();
      expect(result.commandName).toBe('void');
    });

    it('should treat non-command input as not a command', () => {
      const result = executeCommand('just a message');

      expect(result.isCommand).toBe(false);
      expect(result.result).toBeUndefined();
      expect(result.commandName).toBeUndefined();
    });
  });
});
