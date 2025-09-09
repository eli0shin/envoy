import { describe, it, expect, beforeEach } from "vitest";
import { CommandRegistry } from "./registry.js";

describe("CommandRegistry", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe("basic registration and retrieval", () => {
    it("should register and retrieve a command", () => {
      const testCommand = {
        name: "test",
        description: "Test command",
        handler: () => "test result"
      };

      registry.register(testCommand);
      const retrieved = registry.get("test");
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("test");
      expect(retrieved?.description).toBe("Test command");
    });

    it("should return all registered commands", () => {
      registry.register({ name: "cmd1", description: "Command 1", handler: () => {} });
      registry.register({ name: "cmd2", description: "Command 2", handler: () => {} });
      registry.register({ name: "cmd3", description: "Command 3", handler: () => {} });

      const all = registry.getAll();
      expect(all).toHaveLength(3);
      expect(all.map(c => c.name)).toEqual(["cmd1", "cmd2", "cmd3"]);
    });
  });

  describe("getSuggestions", () => {
    beforeEach(() => {
      registry.register({ name: "clear", description: "Clear screen", handler: () => {} });
      registry.register({ name: "help", description: "Show help", handler: () => {} });
      registry.register({ name: "exit", description: "Exit app", handler: () => {} });
    });

    it("should return ALL commands when input is just '/'", () => {
      const suggestions = registry.getSuggestions("/");
      console.log("Suggestions for '/':", suggestions.map(s => s.name));
      
      expect(suggestions).toHaveLength(3);
      expect(suggestions.map(s => s.name)).toContain("clear");
      expect(suggestions.map(s => s.name)).toContain("help");
      expect(suggestions.map(s => s.name)).toContain("exit");
    });

    it("should return ALL commands when input is empty string", () => {
      const suggestions = registry.getSuggestions("");
      console.log("Suggestions for '':", suggestions.map(s => s.name));
      
      expect(suggestions).toHaveLength(3);
    });

    it("should filter commands when partial name provided after slash", () => {
      const suggestions = registry.getSuggestions("/cl");
      console.log("Suggestions for '/cl':", suggestions.map(s => s.name));
      
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].name).toBe("clear");
    });

    it("should filter commands when partial name provided after slash", () => {
      const suggestions = registry.getSuggestions("/e");
      console.log("Suggestions for '/e':", suggestions.map(s => s.name));
      
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].name).toBe("exit");
    });

    it("should return empty array when no matches", () => {
      const suggestions = registry.getSuggestions("/xyz");
      console.log("Suggestions for '/xyz':", suggestions.map(s => s.name));
      
      expect(suggestions).toHaveLength(0);
    });
  });

  describe("parse", () => {
    beforeEach(() => {
      registry.register({ name: "test", description: "Test", handler: () => {} });
    });

    it("should parse command with args", () => {
      const result = registry.parse("/test arg1 arg2");
      
      expect(result.command).toBeDefined();
      expect(result.command?.name).toBe("test");
      expect(result.args).toEqual(["arg1", "arg2"]);
    });

    it("should return undefined command for non-slash input", () => {
      const result = registry.parse("test");
      
      expect(result.command).toBeUndefined();
      expect(result.args).toEqual([]);
    });
  });

  describe("execute", () => {
    it("should execute command and return result", () => {
      registry.register({
        name: "test",
        description: "Test",
        handler: (args) => `Result: ${args.join(", ")}`
      });

      const result = registry.execute("/test arg1 arg2");
      
      expect(result.isCommand).toBe(true);
      expect(result.result).toBe("Result: arg1, arg2");
      expect(result.commandName).toBe("test");
    });

    it("should handle commands that return undefined", () => {
      registry.register({
        name: "void",
        description: "Void command",
        handler: () => undefined
      });

      const result = registry.execute("/void");
      
      expect(result.isCommand).toBe(true);
      expect(result.result).toBeUndefined();
      expect(result.commandName).toBe("void");
    });

    it("should treat non-command input as not a command", () => {
      const result = registry.execute("just a message");
      
      expect(result.isCommand).toBe(false);
      expect(result.result).toBeUndefined();
      expect(result.commandName).toBeUndefined();
    });
  });
});