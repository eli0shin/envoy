/**
 * Main CLI execution flow handlers
 * Handles session listing, prompt/resource commands, and main execution orchestration
 */

import fs from "fs";
import { parseArguments } from "../config/argumentParser.js";
import { readStdin } from "../io/inputHandler.js";

import {
  createRuntimeConfiguration,
  getMCPServersFromConfig,
} from "../../config/index.js";
import {
  initializeAgent,
  runAgent,
  formatExecutionSummary,
} from "../../agent/index.js";
import {
  initializeAgentSession,
  cleanupAgentSession,
} from "../../agentSession.js";
import { launchTUI } from "../../tui/index.js";

import { createMCPClientWrapper } from "../../mcp/loader.js";
import {
  handleListPrompts,
  handleListResources,
  handleExecutePrompt,
  handleInteractivePrompt,
  handleResourceInclusion,
  handleAutoResourceDiscovery,
} from "../handlers/mcpCommands.js";
import {
  logger,
  setLogLevel,
  setLogProgress,
  getProjectConversationDirectory,
  getProjectConversationFile,
} from "../../logger.js";
import { ConversationPersistence } from "../../persistence/ConversationPersistence.js";
import { ProcessManager } from "../../mcp/processManager.js";
import type { CLIOptions, MCPClientWrapper } from "../../types/index.js";
import type { Configuration } from "../../config/types.js";

/**
 * Handles session listing command
 */
export async function handleSessionListing(
  options: CLIOptions,
): Promise<{ handled: boolean; success: boolean }> {
  if (!options.listSessions) {
    return { handled: false, success: true };
  }

  try {
    // Get project identifier and conversation directory
    const projectIdentifier = ConversationPersistence.getProjectIdentifier(
      process.cwd(),
    );
    const projectDir = getProjectConversationDirectory(projectIdentifier);

    try {
      // Check if project directory exists
      await fs.promises.access(projectDir);

      // Read directory contents
      const files = await fs.promises.readdir(projectDir);

      // Filter to only JSONL files and extract session information
      const sessions = files
        .filter((file) => file.endsWith(".jsonl"))
        .map((file) => {
          const sessionId = file.replace(".jsonl", "");
          const filePath = getProjectConversationFile(
            projectIdentifier,
            sessionId,
          );
          return { sessionId, filePath };
        })
        .sort((a, b) => b.sessionId.localeCompare(a.sessionId)); // Latest first (UUID v7 sorts by time)

      if (sessions.length === 0) {
        console.log("No conversation sessions found for this project.");
        return { handled: true, success: true };
      }

      console.log(`\nConversation Sessions for ${process.cwd()}:\n`);

      for (const session of sessions) {
        try {
          const stats = await fs.promises.stat(session.filePath);
          const fileContent = await fs.promises.readFile(
            session.filePath,
            "utf8",
          );
          const lines = fileContent
            .trim()
            .split("\n")
            .filter((line) => line.trim());

          // Parse first line to get session start time
          const firstLine = JSON.parse(lines[0]);
          const startTime = new Date(firstLine.timestamp).toLocaleString();

          console.log(`  ${session.sessionId}`);
          console.log(`    Started: ${startTime}`);
          console.log(`    Messages: ${lines.length}`);
          console.log(`    Size: ${(stats.size / 1024).toFixed(1)} KB`);
          console.log("");
        } catch {
          console.log(`  ${session.sessionId} (corrupted)`);
          console.log("");
        }
      }

      console.log(`Total: ${sessions.length} conversation(s)`);
      console.log(`\nTo resume a conversation: --resume <session-id>`);
      console.log(`To resume latest: --resume`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.log("No conversation sessions found for this project.");
      } else {
        throw error;
      }
    }

    return { handled: true, success: true };
  } catch (error) {
    console.error(
      `Error listing sessions: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { handled: true, success: false };
  }
}

/**
 * Handles MCP prompts and resources CLI commands
 */
export async function handlePromptResourceCommands(
  options: CLIOptions,
  config: Configuration,
): Promise<{ handled: boolean; success: boolean }> {
  // Check if any prompt/resource commands were specified
  const hasPromptResourceCommands =
    options.listPrompts ||
    options.listResources ||
    options.prompt ||
    options.interactivePrompt;

  if (!hasPromptResourceCommands) {
    return { handled: false, success: true };
  }

  try {
    // Extract MCP servers from configuration
    const mcpServers = getMCPServersFromConfig(config);

    // Create client wrappers for all configured MCP servers
    const clientWrappers: MCPClientWrapper[] = [];
    for (const serverConfig of mcpServers) {
      try {
        const wrapper = await createMCPClientWrapper(serverConfig);
        clientWrappers.push(wrapper);
      } catch (error) {
        logger.warn(
          `Failed to connect to MCP server ${serverConfig.name}: ${error}`,
        );
        if (!options.json) {
          console.error(
            `Warning: Could not connect to MCP server '${serverConfig.name}': ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    if (clientWrappers.length === 0) {
      const message =
        "No MCP servers available for prompts and resources operations";
      logger.error(message);
      if (options.json) {
        console.log(JSON.stringify({ error: message }, null, 2));
      } else {
        console.error(message);
      }
      return { handled: true, success: false };
    }

    // Handle list prompts command
    if (options.listPrompts) {
      await handleListPrompts(clientWrappers, options.json || false);
      return { handled: true, success: true };
    }

    // Handle list resources command
    if (options.listResources) {
      await handleListResources(clientWrappers, options.json || false);
      return { handled: true, success: true };
    }

    // Handle execute prompt command
    if (options.prompt) {
      const success = await handleExecutePrompt(
        clientWrappers,
        options.prompt,
        options.promptArgs,
        options.json || false,
      );
      return { handled: true, success };
    }

    // Handle interactive prompt command
    if (options.interactivePrompt) {
      const success = await handleInteractivePrompt(
        clientWrappers,
        options.json || false,
      );
      return { handled: true, success };
    }

    return { handled: false, success: true };
  } catch (error) {
    const message = `Error handling prompt/resource commands: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(message);
    if (options.json) {
      console.log(JSON.stringify({ error: message }, null, 2));
    } else {
      console.error(message);
    }
    return { handled: true, success: false };
  }
}

/**
 * Initializes process cleanup handlers for MCP server child processes
 */
function initializeProcessCleanup(): void {
  const processManager = ProcessManager.getInstance();

  // Handle normal exit
  process.on("exit", () => {
    processManager.cleanupAll();
  });

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, cleaning up...");
    processManager.cleanupAll();
    process.exit(0);
  });

  // Handle termination signal
  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, cleaning up...");
    processManager.cleanupAll();
    process.exit(0);
  });

  // Handle uncaught exceptions (override existing handler)
  process.removeAllListeners("uncaughtException");
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error.message);
    processManager.cleanupAll();
    process.exit(1);
  });

  // Handle unhandled promise rejections (override existing handler)
  process.removeAllListeners("unhandledRejection");
  process.on("unhandledRejection", (reason, _promise) => {
    console.error("Unhandled rejection:", String(reason));
    processManager.cleanupAll();
    process.exit(1);
  });
}

/**
 * Main CLI execution function
 */
export async function main(): Promise<void> {
  // Initialize process cleanup handlers early
  initializeProcessCleanup();
  try {
    // Parse command line arguments
    const { options, message } = await parseArguments();

    // Determine input source
    let userMessage: string;

    if (options.stdin) {
      // Read from stdin
      try {
        userMessage = await readStdin();
      } catch {
        logger.error("No input provided via stdin");
        console.error("Message cannot be empty");
        process.exit(1);
      }
    } else if (message) {
      // Use provided message
      userMessage = message;
    } else {
      // Check if we're running a prompt/resource command or session command (which doesn't need a message)
      const hasPromptResourceCommands =
        options.listPrompts ||
        options.listResources ||
        options.prompt ||
        options.interactivePrompt ||
        options.listSessions;

      if (!hasPromptResourceCommands) {
        // No message provided and no prompt/resource commands
        // This might be interactive mode, so set a placeholder for now
        userMessage = "";
      } else {
        // We have prompt/resource commands, set a placeholder message
        userMessage = "";
      }
    }

    // Validate that we have a message (unless we're running prompt/resource commands, session commands, or interactive mode)
    const hasPromptResourceCommands =
      options.listPrompts ||
      options.listResources ||
      options.prompt ||
      options.interactivePrompt ||
      options.listSessions;

    // Early check for interactive mode before message validation
    const wouldActivateInteractiveMode =
      !message &&
      !options.stdin &&
      !hasPromptResourceCommands &&
      !options.resources &&
      !options.autoResources;

    if (
      !hasPromptResourceCommands &&
      !wouldActivateInteractiveMode &&
      (!userMessage || userMessage.trim() === "")
    ) {
      logger.error("Message is empty after validation");
      console.error("Message cannot be empty");
      process.exit(1);
    }

    // Set initial log level from CLI options if provided to capture configuration loading logs
    if (options.logLevel) {
      setLogLevel(options.logLevel);
    }

    // Create unified runtime configuration
    const configResult = await createRuntimeConfiguration(options);

    // Add message to config for interactive mode detection
    configResult.config.message = message;

    // Check for interactive TUI mode
    const shouldLaunchTUI =
      !message &&
      !options.stdin &&
      !hasPromptResourceCommands &&
      !options.resources &&
      !options.autoResources;

    if (shouldLaunchTUI) {
      // Update logger settings first
      setLogLevel(
        configResult.config.agent.logLevel || options.logLevel || "SILENT",
      );
      setLogProgress(
        configResult.config.agent.logProgress || options.logProgress || "none",
      );

      // Initialize agent (environment validation)
      const initSuccess = await initializeAgent(configResult.config);
      if (!initSuccess) {
        process.exit(1);
      }

      // Initialize agent session first
      const agentSession = await initializeAgentSession(configResult.config);

      // Launch TUI interface
      launchTUI(configResult.config, agentSession);

      // The TUI will handle its own lifecycle and cleanup
      return;
    }

    // Continue with CLI execution

    // Update logger with final settings (prioritizing config file over CLI)
    setLogLevel(
      configResult.config.agent.logLevel || options.logLevel || "SILENT",
    );
    setLogProgress(
      configResult.config.agent.logProgress || options.logProgress || "none",
    );

    // Log configuration loading
    if (configResult.errors?.length) {
      logger.warn("Configuration warnings detected", {
        errors: configResult.errors || [],
        hasErrors: (configResult.errors?.length || 0) > 0,
      });
    }
    logger.info("Configuration loaded", {
      sources: configResult.loadedFrom || [],
      hasSource: (configResult.loadedFrom?.length || 0) > 0,
    });

    // Initialize agent (environment validation)
    const initSuccess = await initializeAgent(configResult.config);
    if (!initSuccess) {
      process.exit(1);
    }

    // Initialize agent session (tool loading, etc.)
    let agentSession;
    try {
      agentSession = await initializeAgentSession(configResult.config);
    } catch (error) {
      logger.error("Agent session initialization failed");
      console.error(
        `Initialization error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }

    // Handle session listing command
    const sessionListResult = await handleSessionListing(options);
    if (sessionListResult.handled) {
      // Command was handled, exit with result status
      process.exit(sessionListResult.success ? 0 : 1);
    }

    // Handle MCP prompts and resources CLI operations
    const promptResourceResult = await handlePromptResourceCommands(
      options,
      configResult.config,
    );
    if (promptResourceResult.handled) {
      // Command was handled, exit with result status
      process.exit(promptResourceResult.success ? 0 : 1);
    }

    // Handle resource inclusion and auto-discovery
    let enhancedMessage = userMessage.trim();
    if (options.resources || options.autoResources) {
      try {
        // Extract MCP servers from configuration
        const mcpServers = getMCPServersFromConfig(configResult.config);

        // Create client wrappers for all configured MCP servers
        const clientWrappers: MCPClientWrapper[] = [];
        for (const serverConfig of mcpServers) {
          try {
            const wrapper = await createMCPClientWrapper(serverConfig);
            clientWrappers.push(wrapper);
          } catch (error) {
            logger.warn(
              `Failed to connect to MCP server ${serverConfig.name} for resource operations: ${error}`,
            );
          }
        }

        if (clientWrappers.length === 0) {
          logger.warn("No MCP servers available for resource operations");
        } else {
          let resourceContext = "";

          // Handle specific resource inclusion
          if (options.resources) {
            resourceContext += await handleResourceInclusion(
              options.resources,
              clientWrappers,
            );
          }

          // Handle automatic resource discovery
          if (options.autoResources) {
            resourceContext += await handleAutoResourceDiscovery(
              enhancedMessage,
              clientWrappers,
            );
          }

          if (resourceContext) {
            enhancedMessage += resourceContext;
            logger.info("Enhanced message with resource context", {
              originalLength: userMessage.trim().length,
              enhancedLength: enhancedMessage.length,
            });
          }
        }

        // Clean up connections
        for (const wrapper of clientWrappers) {
          try {
            // Process cleanup handled globally by ProcessManager
          } catch (error) {
            logger.warn(
              `Failed to disconnect from ${wrapper.serverName}: ${error}`,
            );
          }
        }
      } catch (error) {
        logger.warn(
          `Error during resource processing: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    logger.info("Starting agent execution", {
      message:
        enhancedMessage.substring(0, 100) +
        (enhancedMessage.length > 100 ? "..." : ""),
    });

    // Run the agent with enhanced message using initialized session
    let result;
    try {
      result = await runAgent(
        enhancedMessage,
        configResult.config,
        agentSession,
        false,
      );

      logger.info("Agent execution completed", {
        success: result.success,
        toolCallsCount: result.toolCallsCount,
        executionTime: result.executionTime,
      });

      // Log execution summary
      logger.info("Execution summary", {
        success: result.success,
        toolCallsCount: result.toolCallsCount,
        executionTime: result.executionTime,
      });

      if (
        !configResult.config.json &&
        configResult.config.agent.logProgress !== "none"
      ) {
        console.error(formatExecutionSummary(result));
      }
    } finally {
      // Cleanup agent session resources
      await cleanupAgentSession(agentSession);
    }

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    logger.error("Fatal CLI error", { error: errorMessage });

    console.error(`Fatal error: ${errorMessage}`);
    process.exit(1);
  }
}
