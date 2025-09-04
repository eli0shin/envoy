/**
 * Tests for argumentParser.ts module
 * Tests yargs configuration and argument parsing functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createArgumentParser, parseArguments } from "./argumentParser.js";

// Mock auth commands
vi.mock("../../cli/authCommands.js", () => ({
  loginCommand: vi.fn(),
  logoutCommand: vi.fn(),
  listCommand: vi.fn(),
  statusCommand: vi.fn(),
}));

describe("argumentParser", () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
  });

  describe("createArgumentParser", () => {
    it("should create a yargs instance with proper configuration", () => {
      const parser = createArgumentParser();

      expect(parser).toBeDefined();
      expect(typeof parser.parse).toBe("function");
      expect(typeof parser.option).toBe("function");
      expect(typeof parser.command).toBe("function");
    });

    it("should configure all required options", () => {
      const parser = createArgumentParser();

      // Test that parser has been configured (by checking it can be called)
      expect(() => parser.options).not.toThrow();
    });
  });

  describe("parseArguments", () => {
    it("should parse basic command line arguments", async () => {
      process.argv = ["node", "cli.js", "Hello world"];

      const result = await parseArguments();

      expect(result.options).toBeDefined();
      expect(result.message).toBe("Hello world");
    });

    it("should parse provider option", async () => {
      process.argv = ["node", "cli.js", "--provider", "openai", "test message"];

      const result = await parseArguments();

      expect(result.options.provider).toBe("openai");
      expect(result.message).toBe("test message");
    });

    it("should parse model option with alias", async () => {
      process.argv = ["node", "cli.js", "-m", "gpt-4", "test message"];

      const result = await parseArguments();

      expect(result.options.model).toBe("gpt-4");
    });

    it("should parse log level option", async () => {
      process.argv = ["node", "cli.js", "--log-level", "DEBUG", "test message"];

      const result = await parseArguments();

      expect(result.options.logLevel).toBe("DEBUG");
    });

    it("should parse log progress option", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--log-progress",
        "all",
        "test message",
      ];

      const result = await parseArguments();

      expect(result.options.logProgress).toBe("all");
    });

    it("should parse JSON option", async () => {
      process.argv = ["node", "cli.js", "--json", "test message"];

      const result = await parseArguments();

      expect(result.options.json).toBe(true);
    });

    it("should parse stdin option", async () => {
      process.argv = ["node", "cli.js", "--stdin"];

      const result = await parseArguments();

      expect(result.options.stdin).toBe(true);
    });

    it("should parse max-steps option with validation", async () => {
      process.argv = ["node", "cli.js", "--max-steps", "50", "test message"];

      const result = await parseArguments();

      expect(result.options.maxSteps).toBe(50);
    });

    it("should throw error for invalid max-steps value", async () => {
      process.argv = ["node", "cli.js", "--max-steps", "0", "test message"];

      await expect(parseArguments()).rejects.toThrow(
        "max-steps must be a positive integer",
      );
    });

    it("should throw error for negative max-steps value", async () => {
      process.argv = ["node", "cli.js", "--max-steps", "-5", "test message"];

      await expect(parseArguments()).rejects.toThrow(
        "max-steps must be a positive integer",
      );
    });

    it("should throw error for non-numeric max-steps value", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--max-steps",
        "invalid",
        "test message",
      ];

      await expect(parseArguments()).rejects.toThrow(
        "max-steps must be a positive integer",
      );
    });

    it("should parse system prompt options", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--system-prompt",
        "Custom prompt",
        "test message",
      ];

      const result = await parseArguments();

      expect(result.options.systemPrompt).toBe("Custom prompt");
    });

    it("should parse system prompt file option", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--system-prompt-file",
        "./prompt.txt",
        "test message",
      ];

      const result = await parseArguments();

      expect(result.options.systemPromptFile).toBe("./prompt.txt");
    });

    it("should parse system prompt mode option", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--system-prompt-mode",
        "replace",
        "test message",
      ];

      const result = await parseArguments();

      expect(result.options.systemPromptMode).toBe("replace");
    });

    it("should throw error when both system prompt and file are specified", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--system-prompt",
        "text",
        "--system-prompt-file",
        "file.txt",
        "test",
      ];

      await expect(parseArguments()).rejects.toThrow(
        "Cannot specify both --system-prompt and --system-prompt-file",
      );
    });

    it("should parse MCP prompt options", async () => {
      process.argv = ["node", "cli.js", "--list-prompts"];

      const result = await parseArguments();

      expect(result.options.listPrompts).toBe(true);
    });

    it("should parse MCP resource options", async () => {
      process.argv = ["node", "cli.js", "--list-resources"];

      const result = await parseArguments();

      expect(result.options.listResources).toBe(true);
    });

    it("should parse interactive prompt option", async () => {
      process.argv = ["node", "cli.js", "--interactive-prompt"];

      const result = await parseArguments();

      expect(result.options.interactivePrompt).toBe(true);
    });

    it("should parse resume option with session ID", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--resume",
        "session-123",
        "test message",
      ];

      const result = await parseArguments();

      expect(result.options.resume).toBe("session-123");
    });

    it("should parse resume option without session ID", async () => {
      process.argv = ["node", "cli.js", "--resume"];

      const result = await parseArguments();

      expect(result.options.resume).toBe(true);
    });

    it("should parse list sessions option", async () => {
      process.argv = ["node", "cli.js", "--list-sessions"];

      const result = await parseArguments();

      expect(result.options.listSessions).toBe(true);
    });

    it("should handle multiple word message", async () => {
      process.argv = [
        "node",
        "cli.js",
        "This",
        "is",
        "a",
        "multi",
        "word",
        "message",
      ];

      const result = await parseArguments();

      expect(result.message).toBe("This is a multi word message");
    });

    it("should handle no message", async () => {
      process.argv = ["node", "cli.js", "--json"];

      const result = await parseArguments();

      expect(result.message).toBeUndefined();
    });

    it("should handle complex argument combination", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--provider",
        "anthropic",
        "--model",
        "claude-3-sonnet",
        "--log-level",
        "INFO",
        "--log-progress",
        "tool",
        "--json",
        "--max-steps",
        "25",
        "--system-prompt-mode",
        "prepend",
        "Complex test message",
      ];

      const result = await parseArguments();

      expect(result.options.provider).toBe("anthropic");
      expect(result.options.model).toBe("claude-3-sonnet");
      expect(result.options.logLevel).toBe("INFO");
      expect(result.options.logProgress).toBe("tool");
      expect(result.options.json).toBe(true);
      expect(result.options.maxSteps).toBe(25);
      expect(result.options.systemPromptMode).toBe("prepend");
      expect(result.message).toBe("Complex test message");
    });

    it("should use default values for options", async () => {
      process.argv = ["node", "cli.js", "test message"];

      const result = await parseArguments();

      expect(result.options.logLevel).toBe("SILENT");
      expect(result.options.logProgress).toBe("none");
      expect(result.options.json).toBe(false);
      expect(result.options.stdin).toBe(false);
      expect(result.options.maxSteps).toBe(100);
      expect(result.options.systemPromptMode).toBe("append");
      expect(result.options.listPrompts).toBe(false);
      expect(result.options.listResources).toBe(false);
      expect(result.options.interactivePrompt).toBe(false);
      expect(result.options.listSessions).toBe(false);
    });

    it("should validate choice options", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--log-level",
        "INVALID",
        "test message",
      ];

      await expect(parseArguments()).rejects.toThrow();
    });

    it("should validate system prompt mode choices", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--system-prompt-mode",
        "invalid",
        "test message",
      ];

      await expect(parseArguments()).rejects.toThrow();
    });

    it("should validate log progress choices", async () => {
      process.argv = [
        "node",
        "cli.js",
        "--log-progress",
        "invalid",
        "test message",
      ];

      await expect(parseArguments()).rejects.toThrow();
    });
  });
});
