import envPaths from "env-paths";
import { v7 as uuidv7 } from "uuid";
import { promises as fs } from "fs";
import { join } from "path";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

// Configure marked with terminal renderer using the types I just wrote
marked.setOptions({
  renderer: new TerminalRenderer(),
});

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
export type LoggerLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SILENT";
export type LogProgress = "none" | "assistant" | "tool" | "all";
export type LogType = "agent" | "tool-call" | "mcp-tool";

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  type: LogType;
  sessionId: string;
  serverName?: string;
  toolName?: string;
  message: string;
  metadata?: Record<string, unknown>;
};

class Logger {
  private sessionId: string;
  private logLevel: LoggerLevel;
  private logProgress: LogProgress;
  private paths: ReturnType<typeof envPaths>;
  private initialized = false;
  private writeQueue: Promise<void> = Promise.resolve();
  private suppressConsoleOutput = false;

  constructor() {
    this.sessionId = uuidv7();
    this.logLevel = "SILENT";
    this.logProgress = "none";
    this.paths = envPaths("envoy", { suffix: "" });
  }

  setLogLevel(level: LoggerLevel): void {
    this.logLevel = level;
  }

  setLogProgress(progress: LogProgress): void {
    this.logProgress = progress;
  }

  setSuppressConsoleOutput(suppress: boolean): void {
    this.suppressConsoleOutput = suppress;
  }

  private renderMarkdown(content: string): string {
    try {
      const rendered = marked.parse(content, { async: false }) as string;
      return rendered.replace(/\n+$/, "");
    } catch {
      // Fallback to original content if markdown rendering fails
      return content;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.logLevel === "SILENT") return false;

    const levels: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];
    const currentLevelIndex = levels.indexOf(this.logLevel as LogLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(join(this.paths.data, "sessions"), { recursive: true });
      await fs.mkdir(join(this.paths.data, "mcp-tools"), { recursive: true });
      this.initialized = true;
    } catch {
      // Silently fail if directories cannot be created
      this.initialized = false;
    }
  }

  private queueLogEntry(entry: LogEntry, filePath: string): void {
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.initialized) {
        await this.initialize();

        // If still not initialized, skip file logging silently
        if (!this.initialized) {
          return;
        }
      }

      const logLine = JSON.stringify(entry) + "\n";

      try {
        await fs.appendFile(filePath, logLine, "utf8");
      } catch {
        // Silently fail if file cannot be written
      }
    });
  }

  private createLogEntry(
    level: LogLevel,
    type: LogType,
    message: string,
    metadata?: Record<string, unknown>,
    serverName?: string,
    toolName?: string,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      type,
      sessionId: this.sessionId,
      serverName,
      toolName,
      message,
      metadata,
    };
  }

  private getSessionLogPath(): string {
    return join(this.paths.data, "sessions", `${this.sessionId}.jsonl`);
  }

  private getMcpToolLogPath(serverName: string, toolName: string): string {
    const filename = `${serverName}_${toolName}.jsonl`;
    return join(this.paths.data, "mcp-tools", filename);
  }

  logAgent(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const entry = this.createLogEntry(level, "agent", message, metadata);
    this.queueLogEntry(entry, this.getSessionLogPath());

    if (this.shouldLog(level)) {
      this.logConsole(level, message, metadata);
    }
  }

  logToolCall(
    toolName: string,
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const entry = this.createLogEntry(
      level,
      "tool-call",
      message,
      metadata,
      undefined,
      toolName,
    );
    this.queueLogEntry(entry, this.getSessionLogPath());

    if (this.shouldLog(level)) {
      this.logConsole(level, `[tool-call:${toolName}] ${message}`, metadata);
    }
  }

  logMcpTool(
    serverName: string,
    toolName: string,
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const entry = this.createLogEntry(
      level,
      "mcp-tool",
      message,
      metadata,
      serverName,
      toolName,
    );

    this.queueLogEntry(entry, this.getMcpToolLogPath(serverName, toolName));

    if (this.shouldLog(level)) {
      this.logConsole(
        level,
        `[mcp:${serverName}:${toolName}] ${message}`,
        metadata,
      );
    }
  }

  logConsole(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${level}: ${message}`;

    // Include metadata in console output for DEBUG level to show actual values
    if (level === "DEBUG" && metadata && Object.keys(metadata).length > 0) {
      const metadataStr = JSON.stringify(metadata, null, 2);
      logMessage += `\n${metadataStr}`;
    }

    // Always use stderr for console output to preserve stdout for results
    process.stderr.write(logMessage + '\n');
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.logAgent("ERROR", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.logAgent("WARN", message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.logAgent("INFO", message, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.logAgent("DEBUG", message, metadata);
  }

  private shouldLogProgress(type: "assistant" | "tool" | "user"): boolean {
    return this.logProgress === "all" || this.logProgress === type;
  }

  getCurrentLogProgress(): LogProgress {
    return this.logProgress;
  }

  logUserStep(message: string): void {
    if (this.shouldLogProgress("user") && !this.suppressConsoleOutput) {
      const renderedMessage = this.renderMarkdown(message);
      process.stdout.write(`[user]\n${renderedMessage}\n\n`);
    }
  }

  logAssistantStep(message: string): void {
    if (this.shouldLogProgress("assistant") && !this.suppressConsoleOutput) {
      const renderedMessage = this.renderMarkdown(message);
      process.stdout.write(`[assistant]\n${renderedMessage}\n\n`);
    }
  }

  logToolCallProgress(toolName: string, args: unknown): void {
    if (this.shouldLogProgress("tool") && !this.suppressConsoleOutput) {
      process.stdout.write(`[tool-call]\n${toolName} ${JSON.stringify(args)}\n\n`);
    }
  }

  logThinking(message: string): void {
    if (this.shouldLogProgress("assistant") && !this.suppressConsoleOutput) {
      const renderedMessage = this.renderMarkdown(message);
      process.stdout.write(`[thinking...]\n${renderedMessage}\n\n`);
    }
  }

  getLogDirectory(): string {
    return this.paths.data;
  }

  getConversationDirectory(): string {
    return join(this.paths.data, "conversations");
  }

  getProjectConversationDirectory(projectIdentifier: string): string {
    return join(this.paths.data, "conversations", projectIdentifier);
  }

  getProjectConversationFile(
    projectIdentifier: string,
    sessionId: string,
  ): string {
    return join(
      this.paths.data,
      "conversations",
      projectIdentifier,
      `${sessionId}.jsonl`,
    );
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

// Initialize logger as singleton
const logger = new Logger();

// Export logger instance and functions
export { logger };

export function setLogLevel(level: LoggerLevel): void {
  logger.setLogLevel(level);
}

export function setLogProgress(progress: LogProgress): void {
  logger.setLogProgress(progress);
}

export function logMcpTool(
  serverName: string,
  toolName: string,
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  logger.logMcpTool(serverName, toolName, level, message, metadata);
}

export function createSessionId(): string {
  return uuidv7();
}

export function getLogDirectory(): string {
  return logger.getLogDirectory();
}

export function getConversationDirectory(): string {
  return logger.getConversationDirectory();
}

export function getProjectConversationDirectory(
  projectIdentifier: string,
): string {
  return logger.getProjectConversationDirectory(projectIdentifier);
}

export function getProjectConversationFile(
  projectIdentifier: string,
  sessionId: string,
): string {
  return logger.getProjectConversationFile(projectIdentifier, sessionId);
}

export function getSessionId(): string {
  return logger.getSessionId();
}

export function setSuppressConsoleOutput(suppress: boolean): void {
  logger.setSuppressConsoleOutput(suppress);
}
