/**
 * TypeScript interfaces for configuration system
 * Defines the structure for file-based configuration
 */

import {
  MCPServerConfig as _MCPServerConfig,
  StdioMCPServerConfig,
  SSEMCPServerConfig,
} from '../types/index.js';
import {
  ProviderConfigSchema,
  AnthropicProviderConfigSchema,
  GoogleProviderConfigSchema,
  SystemPromptConfigSchema,
  SessionStartHookSchema,
  PostToolUseHookSchema,
  HookConfigSchema,
  TUIKeybindingsSchema,
  TUIKeybindingActionMapSchema,
} from './schema.js';
import type { z } from 'zod/v3';

/**
 * Provider-specific configuration
 */
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Extended Anthropic provider configuration with authentication options
 */
export type AnthropicProviderConfig = z.infer<
  typeof AnthropicProviderConfigSchema
>;

/**
 * Extended Google provider configuration with authentication options
 */
export type GoogleProviderConfig = z.infer<typeof GoogleProviderConfigSchema>;

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
export type SystemPromptConfig = z.infer<typeof SystemPromptConfigSchema>;

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
 * SessionStart hook configuration
 */
export type SessionStartHook = z.infer<typeof SessionStartHookSchema>;

/**
 * PostToolUse hook configuration
 */
export type PostToolUseHook = z.infer<typeof PostToolUseHookSchema>;

/**
 * Hooks configuration
 */
export type HookConfig = z.infer<typeof HookConfigSchema>;

/**
 * SessionStart hook input passed via stdin
 */
export type SessionStartInput = {
  session_id: string;
  transcript_path?: string; // absolute path to JSONL (omit if not available)
  cwd: string;
  hook_event_name: 'SessionStart';
  source: 'startup' | 'resume' | 'clear';
  permission_mode?: string;
};

/**
 * PostToolUse hook input passed via stdin
 */
export type PostToolUseInput = {
  session_id: string;
  transcript_path?: string; // absolute path to JSONL (omit if not available)
  cwd: string;
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
};

/**
 * PostToolUse hook output parsed from stdout
 */
export type PostToolUseOutput = {
  continue?: boolean; // default: true
  stopReason?: string;
  suppressOutput?: boolean; // default: false
  decision?: 'block'; // provides automated feedback to Claude
  reason?: string; // explanation shown when decision: "block"
  systemMessage?: string; // warning message shown to user
  hookSpecificOutput?: {
    hookEventName: 'PostToolUse';
    additionalContext?: string; // context added to next Claude prompt
  };
};

/**
 * Keybindings configuration for the TUI
 * Mapping: scope -> action -> one or more descriptors
 */
export type TUIKeybindingActionMap = z.infer<
  typeof TUIKeybindingActionMapSchema
>;
export type TUIKeybindings = z.infer<typeof TUIKeybindingsSchema>;

/**
 * Enhanced MCP server configuration with additional options
 */
export type EnhancedMCPServerConfig = (
  | Omit<StdioMCPServerConfig, 'name'>
  | Omit<SSEMCPServerConfig, 'name'>
) & {
  name: string;
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
  keybindings?: TUIKeybindings;
  hooks?: HookConfig;
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
