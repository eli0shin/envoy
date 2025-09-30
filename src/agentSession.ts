/**
 * Agent session management for 2-phase initialization/execution pattern
 * Handles expensive setup operations that can be cached for reuse
 */

import { LanguageModelV2 } from '@ai-sdk/provider';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropicAuthFetch } from './providers/anthropicAuth.js';
import { createGoogleAuthConfig } from './providers/googleAuth.js';
import { createCertificateAwareFetch } from './providers/certificateAwareFetch.js';
import { AnthropicOAuth } from './auth/index.js';
import {
  loadMCPServersWithClients,
  convertToolsForAISDK,
} from './mcp/loader.js';
import { buildSystemPrompt } from './constants.js';
import { WrappedTool, MCPClientWrapper } from './types/index.js';
import { RuntimeConfiguration } from './config/types.js';
import { logger } from './logger.js';
import {
  getMCPServersFromConfig,
  loadSystemPromptContent,
} from './config/index.js';
import type { AuthenticationInfo } from './types/index.js';
import { ConversationPersistence } from './persistence/ConversationPersistence.js';

/**
 * Agent session containing all pre-initialized setup state
 */
export type AgentSession = {
  model: LanguageModelV2;
  tools: Record<string, WrappedTool>;
  systemPrompt: string | string[];
  mcpClients: MCPClientWrapper[];
  authInfo: AuthenticationInfo;
  conversationPersistence?: ConversationPersistence;
};

/**
 * Helper function to create model provider based on configuration
 */
async function createModelProvider(
  config: RuntimeConfiguration
): Promise<{ model: LanguageModelV2; authInfo: AuthenticationInfo }> {
  const defaultProvider = config.providers.default;
  const providerConfig =
    config.providers[defaultProvider as keyof typeof config.providers];
  const model =
    typeof providerConfig === 'object' && providerConfig.model ?
      providerConfig.model
    : defaultProvider === 'openrouter' ? 'google/gemini-2.5-flash-preview-05-20'
    : defaultProvider === 'anthropic' ? 'claude-sonnet-4-5-20250929'
    : defaultProvider === 'openai' ? 'o4-mini'
    : defaultProvider === 'google' ? 'gemini-2.5-pro'
    : 'gemini-2.5-pro'; // fallback for unknown providers

  logger.info(
    `Creating model provider: ${defaultProvider.toUpperCase()} with model=${model}`,
    {
      defaultProvider,
      configuredModel:
        typeof providerConfig === 'object' && providerConfig.model ?
          providerConfig.model
        : null,
      resolvedModel: model,
      hasProviderConfig: !!providerConfig,
      providerConfigType: typeof providerConfig,
    }
  );

  // Create certificate-aware fetch for all providers
  const certificateAwareFetch = createCertificateAwareFetch();

  switch (defaultProvider.toLowerCase()) {
    case 'openai': {
      logger.debug('Creating OpenAI provider', {
        model,
        hasApiKey: !!process.env.OPENAI_API_KEY,
      });
      const openaiAuthInfo: AuthenticationInfo = {
        method: 'api-key',
        source: 'environment',
        details: {
          envVarName: 'OPENAI_API_KEY',
        },
      };
      const openaiProvider = createOpenAI({
        fetch: certificateAwareFetch,
      });
      return { model: openaiProvider(model), authInfo: openaiAuthInfo };
    }
    case 'openrouter': {
      logger.debug('Creating OpenRouter provider', {
        model,
        hasApiKey: !!process.env.OPENROUTER_API_KEY,
      });
      const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
        fetch: certificateAwareFetch,
      });
      const openrouterAuthInfo: AuthenticationInfo = {
        method: 'api-key',
        source: 'environment',
        details: {
          envVarName: 'OPENROUTER_API_KEY',
        },
      };
      return { model: openrouter.chat(model), authInfo: openrouterAuthInfo };
    }
    case 'anthropic': {
      const anthropicConfig = config.providers.anthropic;

      // Always use enhanced authentication with OAuth support
      const apiKey = anthropicConfig?.apiKey || process.env.ANTHROPIC_API_KEY;

      // Determine authentication strategy
      const authType = anthropicConfig?.authType || 'oauth'; // Default to OAuth
      const enableOAuth = anthropicConfig?.enableOAuth !== false; // Default true
      const preferOAuth = anthropicConfig?.preferOAuth !== false; // Default true

      // Check if we have valid OAuth credentials
      const hasOAuthToken = await AnthropicOAuth.isAuthenticated();
      const hasOAuthCredentials = await AnthropicOAuth.hasOAuthCredentials();

      // If user has OAuth credentials, don't pass API key (no fallback)
      const finalApiKey = hasOAuthCredentials ? undefined : apiKey;

      logger.debug('Anthropic provider authentication analysis', {
        model,
        authType,
        enableOAuth,
        preferOAuth,
        hasOAuthToken,
        hasOAuthCredentials,
        hasApiKey: !!apiKey,
        finalApiKey: !!finalApiKey,
        hasConfigApiKey: !!anthropicConfig?.apiKey,
        hasEnvApiKey: !!process.env.ANTHROPIC_API_KEY,
        disableDefaultAuth: !!anthropicConfig?.disableDefaultAuth,
        hasCustomHeaders: !!anthropicConfig?.customHeaders,
        hasOauthHeaders: !!anthropicConfig?.oauthHeaders,
        baseURL: anthropicConfig?.baseURL || 'default',
      });

      // Create custom fetch with OAuth and fallback support
      const customFetch = createAnthropicAuthFetch({
        apiKey: finalApiKey,
        authType,
        customHeaders: anthropicConfig?.customHeaders,
        disableDefaultAuth: anthropicConfig?.disableDefaultAuth,
        enableOAuth,
        preferOAuth,
        oauthHeaders: anthropicConfig?.oauthHeaders,
        baseFetch: certificateAwareFetch,
      });

      const anthropicProvider = createAnthropic({
        apiKey: '',
        baseURL: anthropicConfig?.baseURL,
        fetch: customFetch,
      });

      // Create authentication info
      const authInfo: AuthenticationInfo = {
        method: hasOAuthCredentials ? 'oauth' : 'api-key',
        source:
          hasOAuthCredentials ? 'oauth-credentials'
          : anthropicConfig?.apiKey ? 'config'
          : 'environment',
        details: {
          envVarName:
            !hasOAuthCredentials && !anthropicConfig?.apiKey ?
              'ANTHROPIC_API_KEY'
            : undefined,
          oauthStatus:
            hasOAuthCredentials ?
              hasOAuthToken ? 'active'
              : 'refresh-failed'
            : undefined,
          hasOAuthCredentials,
        },
      };

      logger.info('Anthropic provider created successfully', {
        model,
        authStrategy: hasOAuthToken ? 'OAuth' : 'API Key',
        baseURL: anthropicConfig?.baseURL || 'default',
        authInfo,
      });

      return { model: anthropicProvider(model), authInfo };
    }
    case 'google': {
      const googleConfig = config.providers.google;

      // Determine authentication strategy
      const googleApiKey =
        googleConfig?.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      const googleAuthType = googleConfig?.authType || 'api-key';

      logger.debug('Google provider authentication analysis', {
        model,
        authType: googleAuthType,
        hasApiKey: !!googleApiKey,
        hasConfigApiKey: !!googleConfig?.apiKey,
        hasEnvApiKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        disableDefaultAuth: !!googleConfig?.disableDefaultAuth,
        hasCustomHeaders: !!googleConfig?.customHeaders,
        baseURL: googleConfig?.baseURL || 'default',
      });

      // Create authentication configuration
      const googleAuthConfig = createGoogleAuthConfig({
        apiKey: googleApiKey,
        authType: googleAuthType,
        customHeaders: googleConfig?.customHeaders,
        disableDefaultAuth: googleConfig?.disableDefaultAuth,
      });

      // Create Google provider with authentication
      const googleProvider = createGoogleGenerativeAI({
        apiKey: googleAuthConfig.apiKey,
        baseURL: googleConfig?.baseURL,
        headers:
          (
            googleAuthConfig.headers &&
            Object.keys(googleAuthConfig.headers).length > 0
          ) ?
            googleAuthConfig.headers
          : undefined,
        fetch: certificateAwareFetch,
      });

      // Create authentication info
      const googleAuthInfo: AuthenticationInfo = {
        method: 'api-key',
        source: googleConfig?.apiKey ? 'config' : 'environment',
        details: {
          envVarName:
            !googleConfig?.apiKey ? 'GOOGLE_GENERATIVE_AI_API_KEY' : undefined,
        },
      };

      logger.info('Google Gemini provider created successfully', {
        model,
        authStrategy: googleAuthType === 'bearer' ? 'Bearer Token' : 'API Key',
        baseURL: googleConfig?.baseURL || 'default',
        hasCustomHeaders: !!googleConfig?.customHeaders,
        authInfo: googleAuthInfo,
      });

      return { model: googleProvider(model), authInfo: googleAuthInfo };
    }
    default:
      logger.error('Unsupported provider specified', {
        provider: defaultProvider,
        supportedProviders: ['openai', 'openrouter', 'anthropic', 'google'],
      });
      throw new Error(
        `Unsupported provider: ${defaultProvider}. Supported providers are 'openai', 'openrouter', 'anthropic', and 'google'.`
      );
  }
}

// Removed createMCPClientWrappers function - now integrated into loadMCPServersWithClients

/**
 * Initialize agent session with all expensive setup operations
 * This should be called once before using runAgent()
 */
export async function initializeAgentSession(
  config: RuntimeConfiguration
): Promise<AgentSession> {
  const startTime = Date.now();

  // Environment variables are loaded at application startup

  logger.info('Agent session initializing', {
    provider: config.providers.default,
  });

  // Load MCP servers with integrated tools and client wrappers (single operation)
  const mcpServers = getMCPServersFromConfig(config);
  const { tools, clients, errors } = await loadMCPServersWithClients(
    mcpServers,
    config
  );

  // Report any tool loading errors
  if (errors.length > 0) {
    logger.warn('Tool loading completed with errors', {
      errorCount: errors.length,
      errors: errors.map((e) => ({ serverName: e.serverName, error: e.error })),
    });
  }

  // Convert tools to AI SDK format
  const aiSDKTools = convertToolsForAISDK(tools);

  // Initialize model provider
  const { model, authInfo } = await createModelProvider(config);

  // Build system prompt
  const systemPromptContent = await loadSystemPromptContent(
    config.agent.systemPrompt
  );

  let systemPrompt: string | string[];

  if (config.providers.default.toLowerCase() === 'anthropic') {
    // For Anthropic, create array of system messages for OAuth compatibility
    const systemPrompts: string[] = [];

    // 1. Add Claude Code identity spoof first
    const anthropicSpoof =
      "You are Claude Code, Anthropic's official CLI for Claude.";
    systemPrompts.push(anthropicSpoof);

    // 2. Add main system prompt
    const baseSystemPrompt = buildSystemPrompt(
      systemPromptContent || undefined,
      config.agent.systemPrompt?.mode || 'append',
      true // Assume interactive mode for session-based usage
    );
    systemPrompts.push(baseSystemPrompt);

    // 3. Add environment information
    const envInfo = `
<env>
Working directory: ${process.cwd()}
Is directory a git repo: ${process.env.GIT_REPO_STATUS || 'Unknown'}
Platform: ${process.platform}
OS Version: ${process.env.OS_VERSION || 'Unknown'}
Today's date: ${new Date().toISOString().split('T')[0]}
</env>`;
    systemPrompts.push(envInfo.trim());

    systemPrompt = systemPrompts;
  } else {
    // For other providers, use normal system prompt
    systemPrompt = buildSystemPrompt(
      systemPromptContent || undefined,
      config.agent.systemPrompt?.mode || 'append',
      true // Assume interactive mode for session-based usage
    );
  }

  // Client wrappers are already created and connected from the integrated loading
  const mcpClients = clients;

  // Initialize conversation persistence if enabled
  let conversationPersistence: ConversationPersistence | undefined;
  if (config.agent.conversationPersistence?.enabled) {
    const projectPath =
      config.agent.conversationPersistence.projectPath || process.cwd();
    const projectIdentifier =
      ConversationPersistence.getProjectIdentifier(projectPath);
    const sessionId = logger.getSessionId();

    conversationPersistence = new ConversationPersistence(
      sessionId,
      projectIdentifier
    );

    logger.debug('Conversation persistence initialized', {
      sessionId,
      projectPath,
      projectIdentifier,
    });
  }

  logger.info('Agent session initialized', {
    setupTime: Date.now() - startTime,
    toolCount: Object.keys(aiSDKTools).length,
    mcpServerCount: mcpServers.length,
    errorCount: errors.length,
    persistenceEnabled: !!conversationPersistence,
  });

  return {
    model,
    tools: aiSDKTools,
    systemPrompt,
    mcpClients,
    authInfo,
    conversationPersistence,
  };
}

/**
 * Cleanup agent session resources
 * Should be called when the session is no longer needed
 */
export async function cleanupAgentSession(
  session: AgentSession
): Promise<void> {
  // Process cleanup handled globally by ProcessManager

  logger.info('Agent session cleaned up', {
    mcpClientCount: session.mcpClients.length,
  });
}
