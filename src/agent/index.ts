/**
 * Main agent orchestrator using Vercel AI SDK streamText
 * Uses AI SDK as designed - no custom message transformation
 */

import {
  generateText,
  CoreMessage,
  APICallError,
  InvalidPromptError,
  NoSuchProviderError,
  InvalidToolArgumentsError,
  NoSuchToolError,
  ToolExecutionError,
  LanguageModel,
} from "ai";
import { GENERATION_TIMEOUT_MS, MAX_GENERATION_RETRIES } from "../constants.js";
import { AgentResult } from "../types/index.js";

import { RuntimeConfiguration } from "../config/types.js";
import { logger } from "../logger.js";
import { AgentSession } from "../agentSession.js";
import { transformMessagesForAnthropic } from "./utils/messageTransform.js";
import { ContentExtractor } from "./utils/ContentExtractor.js";
import {
  ThinkingProcessor,
  type ThinkingProviderResult,
} from "./thinking/ThinkingProcessor.js";

export function createThinkingProviderOptions(
  model: LanguageModel,
  message?: string,
): ThinkingProviderResult {
  return ThinkingProcessor.createThinkingProviderOptions(model, message);
}

/**
 * Logs messages from AI SDK response based on message type
 */
function logResponseMessages(
  messages: CoreMessage[],
  config: RuntimeConfiguration,
): void {
  if (config.json) return;

  for (const message of messages) {
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const contentItem of message.content) {
        if (contentItem.type === "reasoning") {
          logger.logThinking(contentItem.text);
        } else if (contentItem.type === "text") {
          logger.logAssistantStep(contentItem.text);
        } else if (contentItem.type === "tool-call") {
          logger.logToolCallProgress(contentItem.toolName, contentItem.args);
        }
      }
    }
  }
}

/**
 * Main agent execution function
 * Uses AI SDK naturally - no custom streaming or message transformation
 */
export async function runAgent(
  messagesOrUserMessage: CoreMessage[] | string,
  config: RuntimeConfiguration,
  session: AgentSession,
  isInteractive: boolean = false,
  onMessageUpdate?: (message: CoreMessage) => void,
): Promise<AgentResult & { messages?: CoreMessage[] }> {
  const startTime = Date.now();
  let hasToolErrors = false;
  let toolErrorMessage = "";

  // Handle both single message and conversation history
  const messages: CoreMessage[] = Array.isArray(messagesOrUserMessage)
    ? [...messagesOrUserMessage]
    : [{ role: "user", content: messagesOrUserMessage }];

  // Extract user message for thinking analysis
  const userMessage = Array.isArray(messagesOrUserMessage)
    ? [...messagesOrUserMessage].reverse().find((m) => m.role === "user")
        ?.content || ""
    : messagesOrUserMessage;

  // Log user message for progress display (only for single messages, not conversation history)
  if (!Array.isArray(messagesOrUserMessage) && !config.json) {
    logger.logUserStep(messagesOrUserMessage);
  }

  let currentStep = 0;
  let toolCallsCount = 0;

  try {
    const { model, tools, systemPrompt } = session;

    logger.info("Using existing agent session", {
      toolCount: Object.keys(tools).length,
      isInteractive,
      systemPromptType: Array.isArray(systemPrompt) ? "array" : "string",
    });

    const maxSteps = config.agent.maxSteps;
    while (currentStep < maxSteps) {
      try {
        // Apply Anthropic-specific message transformations if using array system prompts
        const transformedMessages = Array.isArray(systemPrompt)
          ? transformMessagesForAnthropic(messages, systemPrompt)
          : messages;

        const systemConfig = Array.isArray(systemPrompt)
          ? undefined
          : systemPrompt;

        // Get thinking options
        const { providerOptions, headers } = createThinkingProviderOptions(
          model,
          typeof userMessage === "string" ? userMessage : "",
        );

        const result = generateText({
          model,
          system: systemConfig,
          messages: transformedMessages,
          tools,
          maxSteps: 1, // Single step per call to get step-by-step updates
          maxRetries: MAX_GENERATION_RETRIES,
          abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          providerOptions: providerOptions as any,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        });

        // Extract results from generateText response
        const { text, finishReason, usage, toolResults, response } =
          await result;

        // Count tool calls from AI SDK results
        toolCallsCount += toolResults.length;

        // Log messages from response using new method
        if (response?.messages) {
          logResponseMessages(response.messages, config);
        }

        // Add AI SDK messages to conversation (no transformation)
        if (response?.messages) {
          messages.push(...response.messages);
        }

        // Call onMessageUpdate AFTER complete step with all step messages
        if (onMessageUpdate && response?.messages) {
          for (const message of response.messages) {
            onMessageUpdate(message);
          }
        }

        // Persist conversation messages
        await session.conversationPersistence?.persistMessages(messages);

        // Debug logging for termination decision
        logger.debug("Evaluating termination conditions", {
          finishReason,
          toolResultsCount: toolResults.length,
          textLength: text.trim().length,
          text: text.substring(0, 100), // First 100 chars for debugging
          currentStep,
        });

        // Check if conversation is complete
        // With maxSteps: 1, we terminate when:
        // 1. AI explicitly says stop/length, OR
        // 2. AI provides text response without tool calls (completed response), OR
        // 3. AI only made tool calls but finishReason suggests completion
        const shouldTerminate =
          finishReason === "stop" ||
          finishReason === "length" ||
          (toolResults.length === 0 && text.trim().length > 0); // AI gave final text response without tools

        logger.debug("Termination decision", { shouldTerminate });

        if (shouldTerminate) {
          const executionTime = Date.now() - startTime;

          if (config.json) {
            const jsonResult = {
              success: !hasToolErrors,
              response: ContentExtractor.extractTextContent(text),
              toolCallsCount,
              executionTime,
              usage,
              finishReason,
              ...(hasToolErrors && { error: toolErrorMessage }),
            };
            console.log(JSON.stringify(jsonResult, null, 2));
          } else if (
            logger.getCurrentLogProgress() === "none" &&
            !isInteractive
          ) {
            console.log(ContentExtractor.extractTextContent(text));
          }

          return {
            success: !hasToolErrors,
            response: ContentExtractor.extractTextContent(text),
            toolCallsCount,
            executionTime,
            messages,
            responseMessages: response?.messages || [], // Final AI SDK response messages with IDs, tool calls, etc.
            ...(hasToolErrors && { error: toolErrorMessage }),
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        // Handle AI SDK errors appropriately
        if (APICallError.isInstance(error)) {
          if (
            error.statusCode &&
            [500, 502, 503, 504, 429].includes(error.statusCode)
          ) {
            throw error;
          }
          throw error;
        }

        if (
          InvalidPromptError.isInstance(error) ||
          NoSuchProviderError.isInstance(error)
        ) {
          throw error;
        }

        // Tool errors - continue with error recovery
        if (
          InvalidToolArgumentsError.isInstance(error) ||
          NoSuchToolError.isInstance(error) ||
          ToolExecutionError.isInstance(error)
        ) {
          hasToolErrors = true;
          toolErrorMessage = errorMessage;
          messages.push({
            role: "user",
            content: `Tool call failed: ${errorMessage}. Please try a different approach or continue with available information.`,
          });

          logger.warn("Step encountered tool error", {
            stepNumber: currentStep,
            errorMessage,
            errorType: error.constructor.name,
          });
        } else {
          throw error;
        }
      }

      currentStep++;
    }

    // Max steps reached
    const executionTime = Date.now() - startTime;
    const lastMessage = messages[messages.length - 1];
    const responseText =
      lastMessage?.role === "assistant"
        ? ContentExtractor.extractTextContent(lastMessage.content)
        : "Maximum steps reached";

    if (config.json) {
      const jsonResult = {
        success: !hasToolErrors,
        response: responseText,
        toolCallsCount,
        executionTime,
        ...(hasToolErrors && { error: toolErrorMessage }),
      };
      console.log(JSON.stringify(jsonResult, null, 2));
    }

    return {
      success: !hasToolErrors,
      response: responseText,
      toolCallsCount,
      executionTime,
      messages,
      responseMessages: [], // No response messages when max steps reached
      ...(hasToolErrors && { error: toolErrorMessage }),
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    logger.error("Fatal agent error: " + errorMessage, {
      errorMessage,
      errorType: error instanceof Error ? error.constructor.name : "unknown",
      executionTime,
    });

    if (config.json) {
      const jsonError = {
        success: false,
        error: errorMessage,
        toolCallsCount,
        executionTime,
      };
      console.log(JSON.stringify(jsonError, null, 2));
    }

    return {
      success: false,
      error: errorMessage,
      toolCallsCount,
      executionTime,
      responseMessages: [], // No response messages when error occurs
    };
  }
}

export async function initializeAgent(
  config: RuntimeConfiguration,
): Promise<boolean> {
  logger.info("Agent initialized", {
    provider: config.providers.default,
  });
  return true;
}

export function formatExecutionSummary(result: AgentResult): string {
  const duration = (result.executionTime / 1000).toFixed(2);
  return `Execution completed in ${duration}s with ${result.toolCallsCount} tool calls`;
}
