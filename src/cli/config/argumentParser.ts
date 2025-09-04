/**
 * Argument parser configuration and utilities
 * Handles yargs configuration and command line argument parsing
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { CLIOptions } from "../../types/index.js";
import {
  loginCommand,
  logoutCommand,
  listCommand,
  statusCommand,
} from "../../cli/authCommands.js";
import { getLogDirectory, getConversationDirectory } from "../../logger.js";

/**
 * Creates and configures a yargs instance with all CLI options
 */
export function createArgumentParser() {
  return yargs(hideBin(process.argv))
    .usage(
      "CLI AI Agent - Multi-Model Agent with MCP Tool Integration\n\nUsage: $0 [OPTIONS] [MESSAGE]\n       $0 [OPTIONS] --stdin\n       $0 auth <command>",
    )
    .command("auth", "Manage authentication credentials", (yargs) => {
      return yargs
        .command(
          "login",
          "Login to a provider (OAuth or API key)",
          {},
          async () => {
            await loginCommand();
            process.exit(0);
          },
        )
        .command("logout", "Remove stored credentials", {}, async () => {
          await logoutCommand();
          process.exit(0);
        })
        .command(["list", "ls"], "List stored credentials", {}, async () => {
          await listCommand();
          process.exit(0);
        })
        .command("status", "Check authentication status", {}, async () => {
          await statusCommand();
          process.exit(0);
        })
        .demandCommand(1, "You must specify an auth command")
        .help();
    })
    .option("log-level", {
      type: "string",
      description: "Set log level (DEBUG, INFO, WARN, ERROR, SILENT)",
      default: "SILENT",
      choices: ["DEBUG", "INFO", "WARN", "ERROR", "SILENT"],
    })
    .option("log-progress", {
      type: "string",
      description: "Set progress output level (none, assistant, tool, all)",
      default: "none",
      choices: ["none", "assistant", "tool", "all"],
    })
    .option("json", {
      type: "boolean",
      description: "Output results in JSON format",
      default: false,
    })
    .option("stdin", {
      type: "boolean",
      description: "Read message from stdin instead of arguments",
      default: false,
    })
    .option("provider", {
      alias: "p",
      type: "string",
      description: "AI provider to use (openai, openrouter, anthropic)",
    })
    .option("model", {
      alias: "m",
      type: "string",
      description: "Model to use (default: anthropic/claude-sonnet-4)",
    })
    .option("max-steps", {
      type: "number",
      description: "Maximum conversation steps",
      default: 100,
      coerce: (value: number) => {
        if (isNaN(value) || value < 1) {
          throw new Error("max-steps must be a positive integer");
        }
        return value;
      },
    })
    .option("system-prompt", {
      type: "string",
      description: "Custom system prompt text",
    })
    .option("system-prompt-file", {
      type: "string",
      description: "Path to system prompt file",
    })
    .option("system-prompt-mode", {
      type: "string",
      description:
        "How to handle custom system prompt (replace, append, prepend)",
      default: "append",
      choices: ["replace", "append", "prepend"],
    })
    .option("list-prompts", {
      type: "boolean",
      description: "List all available prompts from MCP servers",
      default: false,
    })
    .option("list-resources", {
      type: "boolean",
      description: "List all available resources from MCP servers",
      default: false,
    })
    .option("prompt", {
      type: "string",
      description: "Execute a specific prompt by name",
    })
    .option("prompt-args", {
      type: "string",
      description:
        "JSON string of arguments for the prompt (use with --prompt)",
    })
    .option("resources", {
      type: "string",
      description: "Comma-separated list of resource URIs to read and include",
    })
    .option("auto-resources", {
      type: "boolean",
      description: "Automatically discover and include relevant resources",
      default: false,
    })
    .option("interactive-prompt", {
      type: "boolean",
      description: "Interactive prompt selection menu",
      default: false,
    })
    .option("enable-persistence", {
      type: "boolean",
      description: "Enable conversation persistence (default: enabled)",
      default: false,
    })
    .option("disable-persistence", {
      type: "boolean",
      description: "Disable conversation persistence",
      default: false,
    })
    .option("persistence-project-path", {
      type: "string",
      description: "Path to project directory for conversation persistence",
    })
    .option("resume", {
      description: "Resume conversation (latest if no session ID provided)",
      coerce: (value: string | boolean) => {
        // Handle boolean-like values - when no value is provided, yargs may pass true
        if (
          value === "" ||
          value === true ||
          value === "true" ||
          value === undefined
        ) {
          return true;
        }
        return value;
      },
      default: undefined,
    })
    .option("list-sessions", {
      type: "boolean",
      description: "List available conversation sessions for this project",
      default: false,
    })
    .version("1.0.0")
    .help("help")
    .alias("help", "h")
    .fail((msg: string, err: Error) => {
      if (err) throw err;
      throw new Error(msg);
    })
    .epilogue(
      `Environment Variables:
  OPENAI_API_KEY               Optional for OpenAI provider
  OPENROUTER_API_KEY           Optional for OpenRouter provider
  ANTHROPIC_API_KEY            Optional for Anthropic provider
  GOOGLE_GENERATIVE_AI_API_KEY Optional for Google Generative AI provider

Logs Directory:
  ${getLogDirectory()}
  
  Session logs: sessions/
  Tool logs:    mcp-tools/

Conversations Directory:
  ${getConversationDirectory()}
  
  Saved conversations are organized by project path

Examples:
  $0 "What is the weather like today?"
  echo "Analyze this data" | $0 --stdin
  $0 --log-progress all --model gpt-3.5-turbo "Help me debug this code"
  $0 --json "Calculate 2 + 2"
  $0 --provider openai --model gpt-4 "Explain quantum physics"
  $0 --log-level DEBUG --log-progress assistant "Analyze this file"
  $0 --system-prompt "You are a helpful coding assistant" "Fix this bug"
  $0 --system-prompt-file ./custom-prompt.txt --system-prompt-mode prepend "Help me"
  $0 --system-prompt-mode replace --system-prompt "Custom behavior" "Task"

MCP Prompts and Resources Examples:
  $0 --list-prompts                                    # List all available prompts
  $0 --list-resources                                  # List all available resources
  $0 --prompt "analyze-code" --prompt-args '{"lang":"js"}' # Execute prompt with args
  $0 --resources "file:///path/to/doc.md,http://api.com/data" # Include specific resources
  $0 --auto-resources "Analyze the codebase"          # Auto-discover relevant resources
  $0 --interactive-prompt                              # Interactive prompt selection menu

Conversation Persistence Examples:
  $0 "Help me with this project"                      # Conversations saved by default
  $0 --persistence-project-path ./my-project "Analyze code" # Set custom project path
  $0 --disable-persistence "One-off question"         # Disable persistence for this run

Resume and Session Management Examples:
  $0 --resume "Continue where we left off"            # Resume latest conversation
  $0 --resume session-id "Let's continue"             # Resume specific conversation
  $0 --list-sessions                                   # List available sessions for this project`,
    )
    .strictOptions();
}

/**
 * Parses command line arguments and returns options and message
 */
export async function parseArguments(): Promise<{
  options: CLIOptions;
  message?: string;
}> {
  const yargs_instance = createArgumentParser();

  // Must use async parse() method to support async auth command handlers
  const argv = await yargs_instance.parse();

  // Validate system prompt options
  if (argv["system-prompt"] && argv["system-prompt-file"]) {
    throw new Error(
      "Cannot specify both --system-prompt and --system-prompt-file",
    );
  }

  // Validate choice options
  const validLogLevels = ["DEBUG", "INFO", "WARN", "ERROR", "SILENT"];
  if (argv["log-level"] && !validLogLevels.includes(argv["log-level"])) {
    throw new Error(
      `Invalid log level. Must be one of: ${validLogLevels.join(", ")}`,
    );
  }

  const validLogProgress = ["none", "assistant", "tool", "all"];
  if (
    argv["log-progress"] &&
    !validLogProgress.includes(argv["log-progress"])
  ) {
    throw new Error(
      `Invalid log progress. Must be one of: ${validLogProgress.join(", ")}`,
    );
  }

  const validSystemPromptModes = ["replace", "append", "prepend"];
  if (
    argv["system-prompt-mode"] &&
    !validSystemPromptModes.includes(argv["system-prompt-mode"])
  ) {
    throw new Error(
      `Invalid system prompt mode. Must be one of: ${validSystemPromptModes.join(", ")}`,
    );
  }

  // Handle resume option - if resume flag is present but undefined, set to true
  let resumeValue = argv.resume;
  if (process.argv.includes("--resume") && resumeValue === undefined) {
    resumeValue = true;
  }

  const options: CLIOptions = {
    provider: argv.provider,
    model: argv.model,
    logLevel: argv["log-level"] as
      | "DEBUG"
      | "INFO"
      | "WARN"
      | "ERROR"
      | "SILENT",
    logProgress: argv["log-progress"] as "none" | "assistant" | "tool" | "all",
    json: argv.json,
    stdin: argv.stdin,
    maxSteps: argv["max-steps"],
    systemPrompt: argv["system-prompt"],
    systemPromptFile: argv["system-prompt-file"],
    systemPromptMode: argv["system-prompt-mode"] as
      | "replace"
      | "append"
      | "prepend",
    listPrompts: argv["list-prompts"],
    listResources: argv["list-resources"],
    prompt: argv.prompt,
    promptArgs: argv["prompt-args"],
    resources: argv.resources,
    autoResources: argv["auto-resources"],
    interactivePrompt: argv["interactive-prompt"],

    // Resume and Session Management options
    resume: resumeValue,
    listSessions: argv["list-sessions"],
  };

  // Get message from remaining arguments
  const message = argv._.length > 0 ? argv._.join(" ") : undefined;

  return { options, message };
}
