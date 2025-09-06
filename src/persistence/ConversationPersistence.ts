/**
 * ConversationPersistence service for saving and loading conversation history
 */

import { promises as fs } from "fs";
import { join } from "path";
import { ensureDirectory } from "../shared/fileOperations.js";
import type { CoreMessage } from "ai";

import {
  logger,
  getConversationDirectory,
  getProjectConversationDirectory,
  getProjectConversationFile,
} from "../logger.js";

/**
 * Entry format for conversation JSONL files
 */
type ConversationEntry = {
  timestamp: string;
  messageIndex: number;
  messageType: "conversation" | "session-meta";
  sessionId: string;
  message: CoreMessage;
};

/**
 * Preview information for a conversation
 */
export type ConversationPreview = {
  firstMessage?: string; // First 100 chars of first user message
  lastAssistantMessage?: string; // First 100 chars of last assistant message
  actualMessageCount: number; // Count of conversation messages (not lines)
};

/**
 * Result of a single conversation deletion operation
 */
export type ConversationDeleteResult = {
  success: boolean;
  sessionId: string;
  sizeFreed: number; // bytes
  error?: string;
};

/**
 * Result of batch conversation cleanup operations
 */
export type CleanupResult = {
  deletedCount: number;
  totalSizeFreed: number; // bytes
  successes: ConversationDeleteResult[];
  failures: ConversationDeleteResult[];
};

/**
 * Statistics for a conversation file
 */
export type ConversationStats = {
  size: number; // bytes
  age: number; // days
};

/**
 * ConversationPersistence handles saving and loading conversation history
 * using JSONL format for efficient storage and retrieval
 */
export class ConversationPersistence {
  private sessionId: string;
  private projectIdentifier: string;
  private conversationDir: string;
  private messageIndex: number = 0;

  constructor(sessionId: string, projectIdentifier: string) {
    this.sessionId = sessionId;
    this.projectIdentifier = projectIdentifier;

    // Set up project-scoped conversation directory path
    this.conversationDir = getProjectConversationDirectory(projectIdentifier);
  }

  /**
   * Get the session ID for this conversation
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Persist an array of complete messages to the conversation file
   * Handles all errors internally and never throws
   */
  async persistMessages(messages: CoreMessage[]): Promise<void> {
    try {
      if (messages.length === 0) {
        return;
      }

      // Filter to only complete messages
      const completeMessages = messages.filter((msg) =>
        ConversationPersistence.isMessageComplete(msg),
      );

      if (completeMessages.length === 0) {
        logger.debug("No complete messages to persist", {
          sessionId: this.sessionId,
          totalMessages: messages.length,
        });
        return;
      }

      // Only persist new messages that haven't been persisted before
      // this.messageIndex tracks how many complete messages we've already persisted
      const newMessages = completeMessages.slice(this.messageIndex);

      if (newMessages.length === 0) {
        logger.debug("No new messages to persist", {
          sessionId: this.sessionId,
          totalMessages: messages.length,
          completeMessages: completeMessages.length,
          alreadyPersisted: this.messageIndex,
        });
        return;
      }

      // Ensure conversation directory exists
      await this.ensureDirectory();

      // Create JSONL entries for new messages only
      const entries = newMessages.map((message, index) => ({
        timestamp: new Date().toISOString(),
        messageIndex: this.messageIndex + index,
        messageType: "conversation" as const,
        sessionId: this.sessionId,
        message: this.sanitizeMessage(message),
      }));

      // Convert to JSONL format
      const jsonlContent =
        entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";

      // Write to conversation file
      const conversationFile = getProjectConversationFile(
        this.projectIdentifier,
        this.sessionId,
      );
      await fs.appendFile(conversationFile, jsonlContent, "utf8");

      // Update message index
      this.messageIndex += newMessages.length;

      logger.debug("Successfully persisted conversation messages", {
        sessionId: this.sessionId,
        messageCount: newMessages.length,
        totalIndex: this.messageIndex,
      });
    } catch (error) {
      // Log the error but never throw - persistence failures should not break agent execution
      logger.warn("Failed to persist conversation messages", {
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
        messageCount: messages.length,
      });
    }
  }

  /**
   * Load conversation history from the conversation file
   */
  async loadConversation(sessionId?: string): Promise<CoreMessage[]> {
    const targetSessionId = sessionId || this.sessionId;
    const conversationFile = getProjectConversationFile(
      this.projectIdentifier,
      targetSessionId,
    );

    try {
      // Check if project-scoped file exists
      await fs.access(conversationFile);

      // Read and parse JSONL file
      const fileContent = await fs.readFile(conversationFile, "utf8");
      return this.parseConversationFile(fileContent, targetSessionId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Project-scoped file doesn't exist, check for legacy file
        const legacyConversationFile = join(
          getConversationDirectory(),
          `${targetSessionId}.jsonl`,
        );

        try {
          await fs.access(legacyConversationFile);
          const legacyContent = await fs.readFile(
            legacyConversationFile,
            "utf8",
          );

          // Migrate legacy file to project-scoped location
          await ensureDirectory(this.conversationDir);
          await fs.writeFile(conversationFile, legacyContent, "utf8");
          await fs.unlink(legacyConversationFile);

          logger.debug("Migrated legacy conversation during load", {
            sessionId: targetSessionId,
            projectIdentifier: this.projectIdentifier,
            from: legacyConversationFile,
            to: conversationFile,
          });

          return this.parseConversationFile(legacyContent, targetSessionId);
        } catch (legacyError) {
          if ((legacyError as NodeJS.ErrnoException).code === "ENOENT") {
            // Neither file exists, return empty conversation
            return [];
          }
          // Re-throw other legacy file errors
          throw legacyError;
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Parse conversation file content into CoreMessage array
   */
  private parseConversationFile(
    fileContent: string,
    sessionId: string,
  ): CoreMessage[] {
    const lines = fileContent.trim().split("\n");
    const messages: CoreMessage[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as ConversationEntry;

        // Only load conversation messages, skip session metadata
        if (entry.messageType === "conversation" && entry.message) {
          messages.push(entry.message);
        }
      } catch (parseError) {
        // Skip malformed lines
        logger.warn("Skipping malformed JSONL line", {
          sessionId,
          error: parseError,
        });
      }
    }

    logger.debug("Loaded conversation", {
      sessionId,
      messageCount: messages.length,
    });

    return messages;
  }

  /**
   * Get conversation preview information including first user message,
   * last assistant message, and actual message count
   */
  async getConversationPreview(
    sessionId?: string,
  ): Promise<ConversationPreview> {
    const targetSessionId = sessionId || this.sessionId;
    const conversationFile = getProjectConversationFile(
      this.projectIdentifier,
      targetSessionId,
    );

    try {
      // Check if project-scoped file exists
      await fs.access(conversationFile);

      // Read and parse JSONL file
      const fileContent = await fs.readFile(conversationFile, "utf8");
      return this.extractConversationPreview(fileContent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Project-scoped file doesn't exist, check for legacy file
        const legacyConversationFile = join(
          getConversationDirectory(),
          `${targetSessionId}.jsonl`,
        );

        try {
          await fs.access(legacyConversationFile);
          const legacyContent = await fs.readFile(
            legacyConversationFile,
            "utf8",
          );
          return this.extractConversationPreview(legacyContent);
        } catch (legacyError) {
          if ((legacyError as NodeJS.ErrnoException).code === "ENOENT") {
            // Neither file exists, return empty preview
            return {
              actualMessageCount: 0,
            };
          }
          // Re-throw other legacy file errors
          throw legacyError;
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Extract conversation preview from file content
   */
  private extractConversationPreview(fileContent: string): ConversationPreview {
    const lines = fileContent.trim().split("\n");
    let firstMessage: string | undefined;
    let lastAssistantMessage: string | undefined;
    let actualMessageCount = 0;

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as ConversationEntry;

        // Only process conversation messages, skip session metadata
        if (entry.messageType === "conversation" && entry.message) {
          actualMessageCount++;

          // Extract first user message
          if (!firstMessage && entry.message.role === "user") {
            firstMessage = this.truncateContent(entry.message.content, 100);
          }

          // Always update last assistant message (to get the most recent one)
          if (entry.message.role === "assistant") {
            lastAssistantMessage = this.truncateContent(
              entry.message.content,
              100,
            );
          }
        }
      } catch (parseError) {
        // Skip malformed lines (same pattern as parseConversationFile)
        logger.warn("Skipping malformed JSONL line in preview extraction", {
          error: parseError,
        });
      }
    }

    return {
      firstMessage,
      lastAssistantMessage,
      actualMessageCount,
    };
  }

  /**
   * Truncate content to specified length with ellipsis
   */
  private truncateContent(content: unknown, maxLength: number): string {
    // Handle different content types
    let textContent: string;

    if (typeof content === "string") {
      textContent = content;
    } else if (content && typeof content === "object") {
      // For complex content (like tool calls), convert to string
      textContent = JSON.stringify(content);
    } else {
      textContent = String(content || "");
    }

    if (textContent.length <= maxLength) {
      return textContent;
    }

    return textContent.substring(0, maxLength) + "...";
  }

  /**
   * Get the latest conversation session ID for this project
   */
  async getLatestConversation(): Promise<string | null> {
    let projectSessionIds: string[] = [];
    let legacySessionIds: string[] = [];

    // Check project conversation directory
    try {
      await fs.access(this.conversationDir);
      const projectFiles = await fs.readdir(this.conversationDir);
      projectSessionIds = projectFiles
        .filter((file) => file.endsWith(".jsonl"))
        .map((file) => file.replace(".jsonl", ""))
        .filter((sessionId) => {
          // Validate UUID format (basic check)
          return sessionId.length === 36 && sessionId.includes("-");
        });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // Directory doesn't exist, continue to check legacy
    }

    // Check legacy conversation directory for additional sessions
    try {
      const baseConversationDir = getConversationDirectory();
      await fs.access(baseConversationDir);
      const legacyFiles = await fs.readdir(baseConversationDir);
      legacySessionIds = legacyFiles
        .filter((file) => file.endsWith(".jsonl"))
        .map((file) => file.replace(".jsonl", ""))
        .filter((sessionId) => {
          // Validate UUID format (basic check)
          return sessionId.length === 36 && sessionId.includes("-");
        })
        .filter((sessionId) => !projectSessionIds.includes(sessionId)); // Exclude already migrated
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // Legacy directory doesn't exist, that's fine
    }

    // Combine and sort all session IDs
    const allSessionIds = [...projectSessionIds, ...legacySessionIds]
      .sort() // UUID v7 is naturally sortable by time
      .reverse(); // Latest first

    return allSessionIds.length > 0 ? allSessionIds[0] : null;
  }

  /**
   * Validate session ID format (UUID v7)
   */
  static isValidSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== "string") {
      return false;
    }

    // Basic UUID format validation: 8-4-4-4-12 pattern with hyphens
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(sessionId);
  }

  /**
   * Convert project path to a safe directory identifier
   */
  static getProjectIdentifier(projectPath: string): string {
    if (!projectPath || typeof projectPath !== "string") {
      throw new Error("Project path must be a non-empty string");
    }

    return projectPath
      .replace(/^\//, "") // Remove leading slash
      .replace(/[/\\]/g, "_"); // Replace slashes and backslashes with underscores
  }

  /**
   * Check if a message is complete and ready for persistence
   */
  static isMessageComplete(message: CoreMessage): boolean {
    switch (message.role) {
      case "user":
      case "assistant":
      case "system":
        return true; // Standard messages are always complete

      case "tool": {
        // Tool messages are complete when they have meaningful content
        if (!message.content) return false;

        // For array content, check if it's not empty
        if (Array.isArray(message.content)) {
          return message.content.length > 0;
        }

        return true;
      }

      default:
        return false;
    }
  }

  /**
   * Ensure the conversation directory exists and migrate legacy conversations if needed
   */
  private async ensureDirectory(): Promise<void> {
    await ensureDirectory(this.conversationDir);
    await this.migrateLegacyConversations();
  }

  /**
   * Migrate conversations from the legacy base directory to project-scoped directories
   */
  private async migrateLegacyConversations(): Promise<void> {
    try {
      const baseConversationDir = getConversationDirectory();
      const legacyConversationFile = join(
        baseConversationDir,
        `${this.sessionId}.jsonl`,
      );

      // Check if legacy conversation file exists
      try {
        await fs.access(legacyConversationFile);
      } catch {
        // No legacy file to migrate
        return;
      }

      const newConversationFile = getProjectConversationFile(
        this.projectIdentifier,
        this.sessionId,
      );

      // Check if new file already exists
      try {
        await fs.access(newConversationFile);
        // New file exists, remove legacy file
        await fs.unlink(legacyConversationFile);
        return;
      } catch {
        // New file doesn't exist, proceed with migration
      }

      // Read legacy file and write to new location
      const legacyContent = await fs.readFile(legacyConversationFile, "utf8");
      await fs.writeFile(newConversationFile, legacyContent, "utf8");

      // Remove legacy file after successful migration
      await fs.unlink(legacyConversationFile);

      logger.debug("Migrated legacy conversation", {
        sessionId: this.sessionId,
        projectIdentifier: this.projectIdentifier,
        from: legacyConversationFile,
        to: newConversationFile,
      });
    } catch (error) {
      // Migration failures should not break normal operation
      logger.warn("Failed to migrate legacy conversation", {
        sessionId: this.sessionId,
        projectIdentifier: this.projectIdentifier,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Sanitize message content for persistence
   * Remove any sensitive data or large objects that shouldn't be persisted
   */
  private sanitizeMessage(message: CoreMessage): CoreMessage {
    // For now, just return the message as-is
    // In the future, we might want to:
    // - Remove or truncate very large tool results
    // - Strip sensitive information
    // - Normalize message format
    return message;
  }

  /**
   * Get conversations older than the specified threshold
   */
  async getOldConversations(daysThreshold: number = 7): Promise<string[]> {
    try {
      const allSessions = await this.getAllConversations();
      const oldSessions: string[] = [];

      for (const sessionId of allSessions) {
        const age = await this.getConversationAge(sessionId);
        if (age > daysThreshold) {
          oldSessions.push(sessionId);
        }
      }

      return oldSessions;
    } catch (error) {
      logger.warn("Failed to get old conversations", {
        projectIdentifier: this.projectIdentifier,
        daysThreshold,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get all conversation session IDs for this project
   */
  async getAllConversations(): Promise<string[]> {
    try {
      // Check project conversation directory
      await fs.access(this.conversationDir);
      const files = await fs.readdir(this.conversationDir);

      return files
        .filter((file) => file.endsWith(".jsonl"))
        .map((file) => file.replace(".jsonl", ""))
        .filter((sessionId) =>
          ConversationPersistence.isValidSessionId(sessionId),
        )
        .sort()
        .reverse(); // Latest first
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Directory doesn't exist, return empty array
        return [];
      }
      logger.warn("Failed to get all conversations", {
        projectIdentifier: this.projectIdentifier,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get statistics for a specific conversation
   */
  async getConversationStats(sessionId: string): Promise<ConversationStats> {
    const conversationFile = getProjectConversationFile(
      this.projectIdentifier,
      sessionId,
    );

    try {
      const stats = await fs.stat(conversationFile);
      const age = await this.getConversationAge(sessionId);

      return {
        size: stats.size,
        age,
      };
    } catch (error) {
      logger.warn("Failed to get conversation stats", {
        sessionId,
        projectIdentifier: this.projectIdentifier,
        error: error instanceof Error ? error.message : String(error),
      });
      return { size: 0, age: 0 };
    }
  }

  /**
   * Delete a single conversation file
   */
  async deleteConversation(
    sessionId: string,
  ): Promise<ConversationDeleteResult> {
    if (!ConversationPersistence.isValidSessionId(sessionId)) {
      return {
        success: false,
        sessionId,
        sizeFreed: 0,
        error: "Invalid session ID format",
      };
    }

    const conversationFile = getProjectConversationFile(
      this.projectIdentifier,
      sessionId,
    );

    try {
      // Get file size before deletion
      const stats = await fs.stat(conversationFile);
      const sizeFreed = stats.size;

      // Delete the file
      await fs.unlink(conversationFile);

      logger.debug("Deleted conversation", {
        sessionId,
        projectIdentifier: this.projectIdentifier,
        sizeFreed,
      });

      return {
        success: true,
        sessionId,
        sizeFreed,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn("Failed to delete conversation", {
        sessionId,
        projectIdentifier: this.projectIdentifier,
        error: errorMessage,
      });

      return {
        success: false,
        sessionId,
        sizeFreed: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete multiple conversations and return detailed results
   */
  async deleteConversations(sessionIds: string[]): Promise<CleanupResult> {
    const successes: ConversationDeleteResult[] = [];
    const failures: ConversationDeleteResult[] = [];

    for (const sessionId of sessionIds) {
      const result = await this.deleteConversation(sessionId);
      if (result.success) {
        successes.push(result);
      } else {
        failures.push(result);
      }
    }

    const deletedCount = successes.length;
    const totalSizeFreed = successes.reduce(
      (total, result) => total + result.sizeFreed,
      0,
    );

    logger.debug("Batch conversation deletion completed", {
      projectIdentifier: this.projectIdentifier,
      totalRequested: sessionIds.length,
      deletedCount,
      failedCount: failures.length,
      totalSizeFreed,
    });

    return {
      deletedCount,
      totalSizeFreed,
      successes,
      failures,
    };
  }

  /**
   * Get the age of a conversation in days
   */
  private async getConversationAge(sessionId: string): Promise<number> {
    const conversationFile = getProjectConversationFile(
      this.projectIdentifier,
      sessionId,
    );

    try {
      const stats = await fs.stat(conversationFile);
      const ageMs = Date.now() - stats.mtime.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      return ageDays;
    } catch (error) {
      logger.warn("Failed to get conversation age", {
        sessionId,
        projectIdentifier: this.projectIdentifier,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}
