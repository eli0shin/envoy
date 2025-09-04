/**
 * Tests for CLI resume functionality - testing the actual ConversationPersistence code
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { ConversationPersistence } from "../persistence/ConversationPersistence.js";
import type { CoreMessage } from "ai";

describe("CLI Resume Functionality - Real Code Tests", () => {
  let mockFs: typeof fs;
  let conversationPersistence: ConversationPersistence;

  beforeEach(() => {
    mockFs = fs as typeof fs;
    vi.clearAllMocks();
    conversationPersistence = new ConversationPersistence(
      "01932d4c-89ab-7890-abcd-123456789abc",
      "test-project",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ConversationPersistence.isValidSessionId", () => {
    it("should validate correct UUID formats", () => {
      const validUUIDs = [
        "01932d4c-89ab-7890-abcd-123456789abc",
        "019330e2-1234-7890-abcd-123456789def",
        "abcdef12-3456-7890-abcd-123456789012",
        "12345678-90ab-cdef-1234-567890abcdef",
      ];

      validUUIDs.forEach((uuid) => {
        expect(ConversationPersistence.isValidSessionId(uuid)).toBe(true);
      });
    });

    it("should reject invalid session ID formats", () => {
      const invalidInputs = [
        "invalid-session-id",
        "short",
        "12345678-90ab-cdef-1234-567890abcdefg", // too long
        "12345678-90ab-cdef-1234-567890abcde", // too short
        "12345678_90ab_cdef_1234_567890abcdef", // wrong separator
        "",
        "12345678-90ab-cdef-1234", // missing segments
      ];

      invalidInputs.forEach((input) => {
        expect(ConversationPersistence.isValidSessionId(input)).toBe(false);
      });
    });

    it("should handle non-string inputs", () => {
      const nonStringInputs = [null, undefined, 123, {}, []];

      nonStringInputs.forEach((input) => {
        expect(ConversationPersistence.isValidSessionId(input as string)).toBe(
          false,
        );
      });
    });
  });

  describe("ConversationPersistence.getProjectIdentifier", () => {
    it("should convert paths to safe identifiers", () => {
      expect(
        ConversationPersistence.getProjectIdentifier("/Users/dev/project"),
      ).toBe("Users_dev_project");
      expect(
        ConversationPersistence.getProjectIdentifier("/home/user/workspace"),
      ).toBe("home_user_workspace");
      expect(
        ConversationPersistence.getProjectIdentifier("C:\\Users\\Dev\\Project"),
      ).toBe("C:_Users_Dev_Project");
    });

    it("should throw error for invalid project paths", () => {
      expect(() => ConversationPersistence.getProjectIdentifier("")).toThrow(
        "Project path must be a non-empty string",
      );
      expect(() =>
        ConversationPersistence.getProjectIdentifier(null as unknown as string),
      ).toThrow("Project path must be a non-empty string");
      expect(() =>
        ConversationPersistence.getProjectIdentifier(
          undefined as unknown as string,
        ),
      ).toThrow("Project path must be a non-empty string");
    });
  });

  describe("getLatestConversation with UUID validation", () => {
    it("should filter out invalid UUID formats and return latest valid one", async () => {
      const mockFiles = [
        "01932d4a-0123-7890-abcd-123456789abc.jsonl", // valid, older
        "invalid-session-id.jsonl", // invalid format
        "short.jsonl", // too short
        "01932d4b-4567-7890-abcd-123456789def.jsonl", // valid, newest
        "not-uuid-format.jsonl", // invalid format
      ];

      vi.mocked(mockFs.access).mockResolvedValue(undefined);
      vi.mocked(mockFs.readdir).mockResolvedValue(mockFiles as never);

      const latestSessionId =
        await conversationPersistence.getLatestConversation();

      expect(latestSessionId).toBe("01932d4b-4567-7890-abcd-123456789def");
    });

    it("should return null when all files have invalid UUID formats", async () => {
      const mockFiles = [
        "invalid-session-id.jsonl",
        "short.jsonl",
        "not-uuid-format.jsonl",
      ];

      vi.mocked(mockFs.access).mockResolvedValue(undefined);
      vi.mocked(mockFs.readdir).mockResolvedValue(mockFiles as never);

      const latestSessionId =
        await conversationPersistence.getLatestConversation();

      expect(latestSessionId).toBeNull();
    });

    it("should handle missing conversation directory gracefully", async () => {
      const error = new Error("ENOENT") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      vi.mocked(mockFs.access).mockRejectedValue(error);

      const latestSessionId =
        await conversationPersistence.getLatestConversation();

      expect(latestSessionId).toBeNull();
    });
  });

  describe("loadConversation error handling", () => {
    it("should return empty array for non-existent conversation file", async () => {
      const error = new Error("ENOENT") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      vi.mocked(mockFs.access).mockRejectedValue(error);

      const messages = await conversationPersistence.loadConversation();

      expect(messages).toEqual([]);
    });

    it("should parse valid JSONL conversation file", async () => {
      const mockJsonlContent =
        JSON.stringify({
          timestamp: "2024-01-15T10:30:00.000Z",
          messageIndex: 0,
          messageType: "conversation",
          sessionId: "01932d4c-89ab-7890-abcd-123456789abc",
          message: { role: "user", content: "Hello" },
        }) +
        "\n" +
        JSON.stringify({
          timestamp: "2024-01-15T10:30:05.000Z",
          messageIndex: 1,
          messageType: "conversation",
          sessionId: "01932d4c-89ab-7890-abcd-123456789abc",
          message: { role: "assistant", content: "Hi there!" },
        }) +
        "\n";

      vi.mocked(mockFs.access).mockResolvedValue(undefined);
      vi.mocked(mockFs.readFile).mockResolvedValue(mockJsonlContent);

      const messages = await conversationPersistence.loadConversation();

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: "user", content: "Hello" });
      expect(messages[1]).toEqual({ role: "assistant", content: "Hi there!" });
    });

    it("should skip malformed JSONL lines gracefully", async () => {
      const mockJsonlContent =
        JSON.stringify({
          timestamp: "2024-01-15T10:30:00.000Z",
          messageIndex: 0,
          messageType: "conversation",
          sessionId: "01932d4c-89ab-7890-abcd-123456789abc",
          message: { role: "user", content: "Hello" },
        }) +
        "\n" +
        '{"invalid": json content without proper closing\n' + // malformed line
        JSON.stringify({
          timestamp: "2024-01-15T10:30:05.000Z",
          messageIndex: 1,
          messageType: "conversation",
          sessionId: "01932d4c-89ab-7890-abcd-123456789abc",
          message: { role: "assistant", content: "Hi there!" },
        }) +
        "\n";

      vi.mocked(mockFs.access).mockResolvedValue(undefined);
      vi.mocked(mockFs.readFile).mockResolvedValue(mockJsonlContent);

      const messages = await conversationPersistence.loadConversation();

      // Should have 2 valid messages, skipping the malformed line
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: "user", content: "Hello" });
      expect(messages[1]).toEqual({ role: "assistant", content: "Hi there!" });
    });

    it("should only load conversation messages, not session metadata", async () => {
      const mockJsonlContent =
        JSON.stringify({
          timestamp: "2024-01-15T10:30:00.000Z",
          messageIndex: 0,
          messageType: "session-meta",
          sessionId: "01932d4c-89ab-7890-abcd-123456789abc",
          metadata: { started: true },
        }) +
        "\n" +
        JSON.stringify({
          timestamp: "2024-01-15T10:30:00.000Z",
          messageIndex: 0,
          messageType: "conversation",
          sessionId: "01932d4c-89ab-7890-abcd-123456789abc",
          message: { role: "user", content: "Hello" },
        }) +
        "\n";

      vi.mocked(mockFs.access).mockResolvedValue(undefined);
      vi.mocked(mockFs.readFile).mockResolvedValue(mockJsonlContent);

      const messages = await conversationPersistence.loadConversation();

      // Should only have 1 conversation message, not the session metadata
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: "user", content: "Hello" });
    });
  });

  describe("Message completion validation", () => {
    it("should correctly identify complete user messages", () => {
      const userMessage: CoreMessage = {
        role: "user",
        content: "Any user message is complete",
      };

      expect(ConversationPersistence.isMessageComplete(userMessage)).toBe(true);
    });

    it("should correctly identify complete assistant messages", () => {
      const assistantMessage: CoreMessage = {
        role: "assistant",
        content: "Regular assistant response",
      };

      expect(ConversationPersistence.isMessageComplete(assistantMessage)).toBe(
        true,
      );
    });

    it("should correctly identify complete thinking messages", () => {
      const completeThinking = {
        role: "assistant",
        content: "Final thought",
        thinking: true,
        isThinkingComplete: true,
      } as CoreMessage;

      expect(ConversationPersistence.isMessageComplete(completeThinking)).toBe(
        true,
      );
    });
  });
});
