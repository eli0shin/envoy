/**
 * Configuration loading orchestration
 * Main functions for loading and creating complete configurations
 */

import { access } from 'fs/promises';
import type {
  Configuration,
  CLIConfigOverrides,
  ConfigLoadResult,
  RuntimeConfiguration,
} from './types.js';
import type { CLIOptions } from '../types/index.js';
import { logger } from '../logger.js';
import {
  MAX_STEPS,
  TOOL_TIMEOUT_MS,
  GENERATION_TIMEOUT_MS,
} from '../constants.js';

// Import all the modularized functions
import { getDefaultConfiguration } from './defaults.js';
import {
  getConfigFilePaths,
  loadConfigFile,
  loadSystemPromptFile,
  isFilePath,
} from './files.js';
import { mergeConfigurations } from './merging.js';
import { applyCLIOverrides } from './overrides.js';
import { expandConfigEnvironmentVariables } from './environment.js';
import { inferMCPServerType } from './mcpServers.js';

/**
 * Main configuration loading function
 */
export async function loadConfiguration(
  cliOverrides: CLIConfigOverrides = {}
): Promise<ConfigLoadResult> {
  const errors: string[] = [];
  const loadedFrom: string[] = [];
  const configs: Configuration[] = [];

  // Start with defaults
  const defaultConfig = getDefaultConfiguration();
  configs.push(defaultConfig);

  logger.debug('Configuration loading started', {
    defaultProvider: defaultConfig.providers?.default,
    hasCliOverrides: Object.keys(cliOverrides).length > 0,
    cliProvider: cliOverrides.provider || 'none',
    cliModel: cliOverrides.model || 'none',
  });

  // Load configuration files in order of precedence
  const configPaths = getConfigFilePaths();

  logger.debug('Searching for configuration files', {
    searchPaths: configPaths,
  });

  for (const filePath of configPaths) {
    const { config, error } = await loadConfigFile(filePath);

    if (error) {
      errors.push(error);
      logger.debug('Configuration file load failed', {
        filePath,
        error,
      });
    } else if (config) {
      configs.push(config);
      loadedFrom.push(filePath);
      logger.info(
        `Config file loaded: ${filePath} -> provider=${config.providers?.default || 'none'}`,
        {
          filePath,
          hasProviders: !!config.providers,
          configuredProvider: config.providers?.default,
          allProviders: config.providers ? Object.keys(config.providers) : [],
        }
      );
    }
  }

  // Merge all configurations
  let mergedConfig = mergeConfigurations(configs);

  logger.debug('Configurations merged', {
    configCount: configs.length,
    mergedProvider: mergedConfig.providers?.default,
    loadedFromFiles: loadedFrom,
  });

  // Infer missing type fields in MCP server configurations
  if (mergedConfig.mcpServers) {
    const inferredServers: Record<
      string,
      import('./types.js').EnhancedMCPServerConfig
    > = {};
    for (const [name, config] of Object.entries(mergedConfig.mcpServers)) {
      inferredServers[name] = inferMCPServerType(config);
    }
    mergedConfig.mcpServers = inferredServers;
  }

  // Expand environment variables
  mergedConfig = expandConfigEnvironmentVariables(mergedConfig);

  // Apply environment variable overrides for persistence
  const envOverrides: CLIConfigOverrides = {};

  // Note: Persistence is always enabled, so we don't process ENVOY_PERSISTENCE_ENABLED

  if (process.env.ENVOY_PERSISTENCE_PROJECT_PATH !== undefined) {
    envOverrides.persistenceProjectPath =
      process.env.ENVOY_PERSISTENCE_PROJECT_PATH;
  }

  // Apply environment overrides first (lower precedence than CLI)
  if (Object.keys(envOverrides).length > 0) {
    logger.debug('Applying environment variable overrides', { envOverrides });
    mergedConfig = applyCLIOverrides(mergedConfig, envOverrides);
  }

  // Apply CLI overrides (highest precedence)
  logger.debug('Applying CLI overrides', {
    beforeProvider: mergedConfig.providers?.default,
    cliOverrides,
  });
  mergedConfig = applyCLIOverrides(mergedConfig, cliOverrides);

  const finalProvider = mergedConfig.providers?.default;
  const source =
    cliOverrides.provider ? 'CLI override'
    : loadedFrom.length > 0 ?
      `config file (${loadedFrom[loadedFrom.length - 1]})`
    : 'default';

  logger.info(
    `Configuration resolved: provider=${finalProvider} from ${source}`,
    {
      finalProvider,
      source,
      loadedFiles: loadedFrom,
      cliProvider: cliOverrides.provider || 'none',
    }
  );

  return {
    config: mergedConfig,
    loadedFrom,
    errors,
  };
}

/**
 * Loads and processes system prompt content based on configuration
 * Handles file loading and content preparation
 * Throws error if configuration is provided but fails to load
 */
export async function loadSystemPromptContent(systemPromptConfig?: {
  mode: 'replace' | 'append' | 'prepend';
  value: string;
}): Promise<string | null> {
  if (!systemPromptConfig) {
    return null;
  }

  // Check if value is a file path or direct content
  const isFile = isFilePath(systemPromptConfig.value);

  if (isFile) {
    // Load content from file - let errors propagate
    return await loadSystemPromptFile(systemPromptConfig.value);
  } else {
    // Use value as direct content
    return systemPromptConfig.value;
  }
}

/**
 * Creates a complete runtime configuration by merging file config with CLI options
 * This is the single source of truth for the entire application
 */
export async function createRuntimeConfiguration(
  cliOptions: CLIOptions
): Promise<{
  config: RuntimeConfiguration;
  loadedFrom?: string[];
  errors?: string[];
}> {
  // Load and merge configuration files with CLI overrides
  const configResult = await loadConfiguration({
    provider: cliOptions.provider,
    model: cliOptions.model,
    logLevel: cliOptions.logLevel,
    logProgress: cliOptions.logProgress,
    maxSteps: cliOptions.maxSteps,
    systemPrompt: cliOptions.systemPrompt,
    systemPromptFile: cliOptions.systemPromptFile,
    systemPromptMode: cliOptions.systemPromptMode,
    // Persistence options removed with UI deletion
  });

  logger.debug('Runtime configuration creation', {
    loadedConfigProvider: configResult.config.providers?.default,
    cliProvider: cliOptions.provider,
    willApplyFallback: !configResult.config.providers?.default,
  });

  // Create the runtime configuration with all required fields
  const runtimeConfig: RuntimeConfiguration = {
    ...configResult.config,

    // CLI-specific options
    stdin: cliOptions.stdin,
    json: cliOptions.json,

    // Ensure all required fields are present with defaults
    providers: {
      default: (() => {
        const configProvider = configResult.config.providers?.default;
        const resolvedProvider = configProvider || 'anthropic';
        // Debug logging handled by logger.debug below
        logger.info(
          `Runtime provider resolution: ${configProvider || 'none'} -> ${resolvedProvider}`,
          {
            configProvider,
            appliedFallback: !configProvider,
            resolvedProvider,
            fallbackReason:
              !configProvider ?
                'no provider in config'
              : 'config provider used',
          }
        );
        return resolvedProvider;
      })(),
      openai: {
        model: 'gpt-4',
        ...configResult.config.providers?.openai,
      },
      openrouter: {
        model: 'google/gemini-2.5-flash-preview-05-20',
        ...configResult.config.providers?.openrouter,
      },
      anthropic: {
        model: 'claude-sonnet-4-5-20250929',
        ...configResult.config.providers?.anthropic,
      },
      google: {
        model: 'gemini-2.5-pro',
        authType: 'api-key',
        ...configResult.config.providers?.google,
      },
      ...configResult.config.providers,
    },

    agent: {
      maxSteps: MAX_STEPS,
      timeout: GENERATION_TIMEOUT_MS,
      logLevel: 'SILENT' as const,
      logProgress: 'none' as const,
      streaming: true,
      ...configResult.config.agent,
    },

    tools: {
      globalTimeout: TOOL_TIMEOUT_MS,
      disabledInternalTools: [],
      ...configResult.config.tools,
    },
  };

  // Validate persistence configuration
  if (
    runtimeConfig.agent.conversationPersistence?.enabled &&
    runtimeConfig.agent.conversationPersistence?.projectPath
  ) {
    try {
      await access(runtimeConfig.agent.conversationPersistence.projectPath);
    } catch {
      throw new Error(
        `Persistence project path does not exist: ${runtimeConfig.agent.conversationPersistence.projectPath}`
      );
    }
  }

  return {
    config: runtimeConfig,
    loadedFrom: configResult.loadedFrom,
    errors: configResult.errors,
  };
}

/**
 * Helper function to get provider configuration
 */
export function getProviderFromConfig(config: Configuration): {
  provider: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
} {
  const defaultProvider = config.providers?.default || 'openrouter';
  const providerConfig =
    config.providers?.[defaultProvider as keyof typeof config.providers];
  const typedProviderConfig =
    typeof providerConfig === 'object' ? providerConfig : {};

  return {
    provider: defaultProvider,
    model: typedProviderConfig?.model,
    apiKey: typedProviderConfig?.apiKey,
    baseURL: typedProviderConfig?.baseURL,
  };
}

/**
 * Helper function to get agent configuration
 */
export function getAgentConfigFromConfig(config: Configuration): {
  maxSteps: number;
  timeout: number;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT';
  logProgress: 'none' | 'assistant' | 'tool' | 'all';
} {
  return {
    maxSteps: config.agent?.maxSteps || MAX_STEPS,
    timeout: config.agent?.timeout || GENERATION_TIMEOUT_MS,
    logLevel: config.agent?.logLevel || 'SILENT',
    logProgress: config.agent?.logProgress || 'none',
  };
}
