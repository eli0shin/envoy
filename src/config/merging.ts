/**
 * Configuration merging utilities
 * Handles merging of multiple configuration objects with proper precedence
 */

import type { Configuration, ProviderConfig } from './types.js';

/**
 * Merges multiple configuration objects with proper precedence
 */
export function mergeConfigurations(configs: Configuration[]): Configuration {
  const result: Configuration = {};

  for (const config of configs) {
    if (config.mcpServers) {
      result.mcpServers = { ...result.mcpServers, ...config.mcpServers };
    }
    if (config.providers) {
      result.providers = { ...result.providers };

      // Merge each provider configuration individually to preserve defaults
      for (const [providerName, providerConfig] of Object.entries(
        config.providers
      )) {
        if (providerName === 'default') {
          result.providers.default = providerConfig as string;
        } else {
          // Deep merge individual provider configurations
          const existingConfig =
            result.providers[providerName as keyof typeof result.providers];

          // Only merge if the new config is an object
          if (typeof providerConfig === 'object' && providerConfig !== null) {
            (result.providers as Record<string, ProviderConfig>)[providerName] =
              {
                ...(typeof existingConfig === 'object' ? existingConfig : {}),
                ...providerConfig,
              };
          } else if (!(providerName in result.providers)) {
            // Add non-object provider config only if it doesn't exist
            (result.providers as Record<string, ProviderConfig>)[providerName] =
              providerConfig as ProviderConfig;
          }
        }
      }
    }
    if (config.agent) {
      const mergedAgent = { ...result.agent, ...config.agent };

      // Deep merge nested objects in agent config
      if (
        result.agent?.conversationPersistence &&
        config.agent.conversationPersistence
      ) {
        mergedAgent.conversationPersistence = {
          ...result.agent.conversationPersistence,
          ...config.agent.conversationPersistence,
        };
      }
      if (result.agent?.systemPrompt && config.agent.systemPrompt) {
        mergedAgent.systemPrompt = {
          ...result.agent.systemPrompt,
          ...config.agent.systemPrompt,
        };
      }

      result.agent = mergedAgent;
    }
    if (config.tools) {
      result.tools = { ...result.tools, ...config.tools };
    }
    if (config.hooks) {
      result.hooks = {
        ...result.hooks,
        SessionStart: [
          ...(result.hooks?.SessionStart || []),
          ...(config.hooks.SessionStart || []),
        ],
        PostToolUse: [
          ...(result.hooks?.PostToolUse || []),
          ...(config.hooks.PostToolUse || []),
        ],
      };
    }
  }

  return result;
}
