/**
 * Main agent orchestrator using Vercel AI SDK streamText
 * Uses AI SDK as designed - no custom message transformation
 */

import {
  generateText,
  ModelMessage,
  APICallError,
  InvalidPromptError,
  NoSuchProviderError,
  InvalidArgumentError,
  NoSuchToolError,
  stepCountIs,
} from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { GENERATION_TIMEOUT_MS, MAX_GENERATION_RETRIES } from '../constants.js';
import { AgentResult } from '../types/index.js';

import { RuntimeConfiguration } from '../config/types.js';
import { logger } from '../logger.js';
import { AgentSession } from '../agentSession.js';
import { transformMessagesForAnthropic } from './utils/messageTransform.js';
import { ContentExtractor } from './utils/ContentExtractor.js';
import {
  ThinkingProcessor,
  type ThinkingProviderResult,
} from './thinking/ThinkingProcessor.js';

export function createThinkingProviderOptions(
  model: LanguageModelV2,
  message?: string
): ThinkingProviderResult {
  return ThinkingProcessor.createThinkingProviderOptions(model, message);
}

/**
 * Logs messages from AI SDK response based on message type
 */
function logResponseMessages(
  messages: ModelMessage[],
  config: RuntimeConfiguration
): void {
  if (config.json) return;

  for (const message of messages) {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const contentItem of message.content) {
        if (contentItem.type === 'reasoning') {
          logger.logThinking(contentItem.text);
        } else if (contentItem.type === 'text') {
          logger.logAssistantStep(contentItem.text);
        } else if (contentItem.type === 'tool-call') {
          logger.logToolCallProgress(contentItem.toolName, contentItem.input);
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
  messagesOrUserMessage: ModelMessage[] | string,
  config: RuntimeConfiguration,
  session: AgentSession,
  isInteractive: boolean = false,
  onMessageUpdate?: (message: ModelMessage) => void,
  abortSignal: AbortSignal = AbortSignal.timeout(GENERATION_TIMEOUT_MS)
): Promise<AgentResult & { messages?: ModelMessage[] }> {
  const startTime = Date.now();
  let hasToolErrors = false;
  let toolErrorMessage = '';

  // Handle both single message and conversation history
  const messages: ModelMessage[] =
    Array.isArray(messagesOrUserMessage) ?
      [...messagesOrUserMessage]
    : [{ role: 'user', content: messagesOrUserMessage }];

  // Extract user message for thinking analysis
  const userMessage =
    Array.isArray(messagesOrUserMessage) ?
      [...messagesOrUserMessage].reverse().find((m) => m.role === 'user')
        ?.content || ''
    : messagesOrUserMessage;

  // Log user message for progress display (only for single messages, not conversation history)
  if (!Array.isArray(messagesOrUserMessage) && !config.json) {
    logger.logUserStep(messagesOrUserMessage);
  }

  let currentStep = 0;
  let toolCallsCount = 0;

  try {
    const { model, tools, systemPrompt } = session;

    logger.info('Using existing agent session', {
      toolCount: Object.keys(tools).length,
      isInteractive,
      systemPromptType: Array.isArray(systemPrompt) ? 'array' : 'string',
    });

    const maxSteps = config.agent.maxSteps;
    while (currentStep < maxSteps) {
      try {
        // Apply Anthropic-specific message transformations if using array system prompts
        const transformedMessages =
          Array.isArray(systemPrompt) ?
            transformMessagesForAnthropic(messages, systemPrompt)
          : messages;

        const systemConfig =
          Array.isArray(systemPrompt) ? undefined : systemPrompt;

        // Get thinking options
        const { providerOptions, headers } = createThinkingProviderOptions(
          model,
          typeof userMessage === 'string' ? userMessage : ''
        );

        // Combine user abort signal with timeout signal
        const combinedAbortSignal = AbortSignal.any([
          abortSignal,
          AbortSignal.timeout(GENERATION_TIMEOUT_MS)
        ]);

        const result = generateText({
          model,
          system: systemConfig,
          messages: transformedMessages,
          tools,
          stopWhen: stepCountIs(1),
          maxRetries: MAX_GENERATION_RETRIES,
          abortSignal: combinedAbortSignal,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          providerOptions: providerOptions as any,
          headers,
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
        logger.debug('Evaluating termination conditions', {
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
          finishReason === 'stop' || finishReason === 'length';

        logger.debug('Termination decision', { shouldTerminate });

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
            process.stdout.write(JSON.stringify(jsonResult, null, 2) + '\n');
          } else if (
            logger.getCurrentLogProgress() === 'none' &&
            !isInteractive
          ) {
            process.stdout.write(
              ContentExtractor.extractTextContent(text) + '\n'
            );
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
          error instanceof Error ? error.message : 'Unknown error occurred';

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
          InvalidArgumentError.isInstance(error) ||
          NoSuchToolError.isInstance(error)
        ) {
          hasToolErrors = true;
          toolErrorMessage = errorMessage;
          messages.push({
            role: 'user',
            content: `Tool call failed: ${errorMessage}. Please try a different approach or continue with available information.`,
          });

          logger.warn('Step encountered tool error', {
            stepNumber: currentStep,
            errorMessage,
            errorType:
              error instanceof Error ? error.constructor.name : 'Unknown',
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
      lastMessage?.role === 'assistant' ?
        ContentExtractor.extractTextContent(lastMessage.content)
      : 'Maximum steps reached';

    if (config.json) {
      const jsonResult = {
        success: !hasToolErrors,
        response: responseText,
        toolCallsCount,
        executionTime,
        ...(hasToolErrors && { error: toolErrorMessage }),
      };
      process.stdout.write(JSON.stringify(jsonResult, null, 2) + '\n');
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
    
    // Handle AbortError specially - user-initiated cancellation
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info('Agent execution cancelled by user', {
        executionTime,
        toolCallsCount,
      });

      if (config.json) {
        const jsonResult = {
          success: false,
          error: 'Operation cancelled by user',
          toolCallsCount,
          executionTime,
        };
        process.stdout.write(JSON.stringify(jsonResult, null, 2) + '\n');
      }

      return {
        success: false,
        error: 'Operation cancelled by user',
        toolCallsCount,
        executionTime,
        messages,
        responseMessages: [], // No response messages when cancelled
      };
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    logger.error('Fatal agent error: ' + errorMessage, {
      errorMessage,
      errorType: error instanceof Error ? error.constructor.name : 'unknown',
      executionTime,
    });

    if (config.json) {
      const jsonError = {
        success: false,
        error: errorMessage,
        toolCallsCount,
        executionTime,
      };
      process.stdout.write(JSON.stringify(jsonError, null, 2) + '\n');
    }

    return {
      success: false,
      error: errorMessage,
      toolCallsCount,
      executionTime,
      messages,
      responseMessages: [], // No response messages when error occurs
    };
  }
}

export async function initializeAgent(
  config: RuntimeConfiguration
): Promise<boolean> {
  logger.info('Agent initialized', {
    provider: config.providers.default,
  });
  return true;
}

export function formatExecutionSummary(result: AgentResult): string {
  const duration = (result.executionTime / 1000).toFixed(2);
  return `Execution completed in ${duration}s with ${result.toolCallsCount} tool calls`;
}
