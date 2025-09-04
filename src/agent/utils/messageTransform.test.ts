import { describe, it, expect } from "vitest";
import { transformMessagesForAnthropic } from "./messageTransform.js";
import { CoreMessage } from "ai";

// Extended message type for testing provider metadata
type ExtendedCoreMessage = CoreMessage & {
  providerMetadata?: {
    anthropic?: {
      cacheControl?: { type: "ephemeral" };
    };
  };
};

describe("transformMessagesForAnthropic", () => {
  it("should return messages unchanged when no system prompts provided", () => {
    const messages: CoreMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    const result = transformMessagesForAnthropic(messages);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(messages[0]);
    expect(result[1]).toEqual(messages[1]);
  });

  it("should prepend system messages when system prompts provided", () => {
    const messages: CoreMessage[] = [{ role: "user", content: "Hello" }];
    const systemPrompts = ["You are a helpful assistant", "Be concise"];

    const result = transformMessagesForAnthropic(messages, systemPrompts);

    expect(result).toHaveLength(3);
    expect(result[0].role).toBe("system");
    expect(result[0].content).toBe("You are a helpful assistant");
    expect(result[1].role).toBe("system");
    expect(result[1].content).toBe("Be concise");
    expect(result[2]).toEqual(messages[0]);
  });

  it("should apply cache control to first 2 system messages", () => {
    const systemPrompts = ["System 1", "System 2", "System 3"];
    const messages: CoreMessage[] = [{ role: "user", content: "Hello" }];

    const result = transformMessagesForAnthropic(messages, systemPrompts);

    expect(result).toHaveLength(4);

    // First 2 system messages should have cache control
    expect(
      (result[0] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });
    expect(
      (result[1] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });

    // Third system message should not have cache control
    expect(
      (result[2] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toBeUndefined();
  });

  it("should apply cache control to last 2 non-system messages", () => {
    const messages: CoreMessage[] = [
      { role: "user", content: "Message 1" },
      { role: "assistant", content: "Response 1" },
      { role: "user", content: "Message 2" },
      { role: "assistant", content: "Response 2" },
      { role: "user", content: "Message 3" },
    ];

    const result = transformMessagesForAnthropic(messages);

    expect(result).toHaveLength(5);

    // Only last 2 non-system messages should have cache control
    expect(
      (result[0] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toBeUndefined();
    expect(
      (result[1] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toBeUndefined();
    expect(
      (result[2] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toBeUndefined();
    expect(
      (result[3] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });
    expect(
      (result[4] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });
  });

  it("should handle mixed system and non-system messages correctly", () => {
    const messages: CoreMessage[] = [
      { role: "system", content: "Existing system" },
      { role: "user", content: "User 1" },
      { role: "assistant", content: "Assistant 1" },
      { role: "system", content: "Another system" },
      { role: "user", content: "User 2" },
    ];
    const systemPrompts = ["New system"];

    const result = transformMessagesForAnthropic(messages, systemPrompts);

    expect(result).toHaveLength(6);
    expect(result[0].role).toBe("system");
    expect(result[0].content).toBe("New system");
    expect(result[1].role).toBe("system");
    expect(result[1].content).toBe("Existing system");

    // First 2 system messages should have cache control
    expect(
      (result[0] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });
    expect(
      (result[1] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });

    // Last 2 non-system messages should have cache control
    // The result array is: [New system, Existing system, User 1, Assistant 1, Another system, User 2]
    // Last 2 non-system are: Assistant 1 (index 3), User 2 (index 5)
    expect(
      (result[3] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });
    expect(
      (result[5] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });
  });

  it("should handle empty system prompts array", () => {
    const messages: CoreMessage[] = [{ role: "user", content: "Hello" }];

    const result = transformMessagesForAnthropic(messages, []);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(messages[0]);
  });

  it("should handle empty messages array", () => {
    const result = transformMessagesForAnthropic([]);

    expect(result).toHaveLength(0);
  });

  it("should handle empty messages with system prompts", () => {
    const systemPrompts = ["System message"];

    const result = transformMessagesForAnthropic([], systemPrompts);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("system");
    expect(result[0].content).toBe("System message");
    expect(
      (result[0] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });
  });

  it("should apply cache control to existing messages", () => {
    const messages: CoreMessage[] = [
      {
        role: "user",
        content: "Hello",
      },
    ];

    const result = transformMessagesForAnthropic(messages);

    expect(
      (result[0] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });
  });

  it("should handle single system and single non-system message", () => {
    const messages: CoreMessage[] = [
      { role: "system", content: "System" },
      { role: "user", content: "User" },
    ];

    const result = transformMessagesForAnthropic(messages);

    expect(result).toHaveLength(2);
    expect(
      (result[0] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });
    expect(
      (result[1] as ExtendedCoreMessage).providerMetadata?.anthropic
        ?.cacheControl,
    ).toEqual({ type: "ephemeral" });
  });
});
