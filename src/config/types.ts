/**
 * TypeScript interfaces for configuration system
 * Defines the structure for file-based configuration
 */

import {
  MCPServerConfig as _MCPServerConfig,
  StdioMCPServerConfig,
  SSEMCPServerConfig,
} from '../types/index.js';

/**
 * Provider-specific configuration
 */
export type ProviderConfig = {
  apiKey?: string;
  model?: string;
  baseURL?: string;
};

/**
 * Extended Anthropic provider configuration with authentication options
 */
export type AnthropicProviderConfig = ProviderConfig & {
  authType?: 'x-api-key' | 'bearer' | 'oauth'; // Default: 'x-api-key'
  customHeaders?: Record<string, string>; // Additional headers
  disableDefaultAuth?: boolean; // Skip default auth headers
  enableOAuth?: boolean; // Enable OAuth authentication
  preferOAuth?: boolean; // Try OAuth first, fall back to API key
  oauthHeaders?: Record<string, string>; // OAuth-specific headers
};

/**
 * Extended Google provider configuration with authentication options
 */
export type GoogleProviderConfig = ProviderConfig & {
  authType?: 'api-key' | 'bearer'; // Default: 'api-key'
  customHeaders?: Record<string, string>; // Additional headers
  disableDefaultAuth?: boolean; // Skip default auth headers
};

/**
 * AI providers configuration
 */
export type ProvidersConfig = {
  default?: string;
  openai?: ProviderConfig;
  openrouter?: ProviderConfig;
  anthropic?: AnthropicProviderConfig;
  google?: GoogleProviderConfig;
};

/**
 * Log progress output level
 */
export type LogProgress = 'none' | 'assistant' | 'tool' | 'all';

/**
 * System prompt configuration mode
 */
export type SystemPromptMode = 'replace' | 'append' | 'prepend';

/**
 * System prompt configuration
 */
export type SystemPromptConfig = {
  mode: SystemPromptMode;
  value: string; // Either text content or file path
};

/**
 * Conversation persistence configuration
 */
export type ConversationPersistenceConfig = {
  enabled?: boolean;
  projectPath?: string;
};

/**
 * Agent behavior configuration
 */
export type AgentConfig = {
  maxSteps?: number;
  timeout?: number;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT';
  logProgress?: LogProgress;
  streaming?: boolean;
  systemPrompt?: SystemPromptConfig;
  conversationPersistence?: ConversationPersistenceConfig;
};

/**
 * Tool management configuration
 */
export type ToolsConfig = {
  disabledInternalTools?: string[];
  globalTimeout?: number;
};

/**
 * Enhanced MCP server configuration with additional options
 */
export type EnhancedMCPServerConfig = (
  | Omit<StdioMCPServerConfig, 'name'>
  | Omit<SSEMCPServerConfig, 'name'>
) & {
  timeout?: number;
  initTimeout?: number;
  disabled?: boolean;
  disabledTools?: string[];
  autoApprove?: string[];
};

/**
 * Complete configuration structure
 */
export type Configuration = {
  mcpServers?: Record<string, EnhancedMCPServerConfig>;
  providers?: ProvidersConfig;
  agent?: AgentConfig;
  tools?: ToolsConfig;
};

/**
 * Configuration file locations in order of precedence
 */
export type ConfigFileLocations = {
  project?: string;
  user?: string;
};

/**
 * Configuration loading result
 */
export type ConfigLoadResult = {
  config: Configuration;
  loadedFrom?: string[];
  errors?: string[];
};

/**
 * CLI configuration overrides
 */
export type CLIConfigOverrides = {
  provider?: string;
  model?: string;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT';
  logProgress?: LogProgress;
  maxSteps?: number;
  systemPrompt?: string;
  systemPromptFile?: string;
  systemPromptMode?: SystemPromptMode;
  enablePersistence?: boolean;
  disablePersistence?: boolean;
  persistenceProjectPath?: string;
};

/**
 * MCP prompts configuration
 */
export type MCPPromptsConfig = {
  list?: boolean;
  name?: string;
  args?: string;
  interactive?: boolean;
};

/**
 * MCP resources configuration
 */
export type MCPResourcesConfig = {
  list?: boolean;
  uris?: string;
  auto?: boolean;
};

/**
 * Runtime configuration that combines file config with CLI options
 * This is the single source of truth used throughout the application
 */
export type RuntimeConfiguration = Configuration & {
  // CLI-specific options that aren't in file config
  message?: string;
  stdin?: boolean;
  json?: boolean;

  // MCP-specific CLI options
  mcpPrompts?: MCPPromptsConfig;
  mcpResources?: MCPResourcesConfig;

  // Resolved values (no longer optional after CLI merge)
  providers: Required<ProvidersConfig> & ProvidersConfig;
  agent: Required<
    Omit<AgentConfig, 'systemPrompt' | 'conversationPersistence'>
  > &
    AgentConfig;
  tools: Required<ToolsConfig> & ToolsConfig;
};
