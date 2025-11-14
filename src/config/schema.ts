/**
 * Zod schema definition for configuration validation
 * Ensures configuration files follow the correct structure
 */

import { z } from 'zod/v3';

/**
 * Provider configuration schema
 * Base configuration for AI provider connections
 */
export const ProviderConfigSchema = z
  .object({
    /** API key for authentication */
    apiKey: z.string().optional(),
    /** Model identifier to use */
    model: z.string().optional(),
    /** Base URL for API endpoint */
    baseURL: z.string().url().optional(),
  })
  .strict();

/**
 * Extended Anthropic provider configuration schema
 * Includes authentication options beyond basic API key
 */
export const AnthropicProviderConfigSchema = z
  .object({
    /** API key for authentication */
    apiKey: z.string().optional(),
    /** Model identifier to use */
    model: z.string().optional(),
    /** Base URL for API endpoint */
    baseURL: z.string().url().optional(),
    /** Authentication type (default: 'x-api-key') */
    authType: z.enum(['x-api-key', 'bearer', 'oauth']).optional(),
    /** Additional headers to include in requests */
    customHeaders: z.record(z.string()).optional(),
    /** Skip default auth headers */
    disableDefaultAuth: z.boolean().optional(),
    /** Enable OAuth authentication */
    enableOAuth: z.boolean().optional(),
    /** Try OAuth first, fall back to API key */
    preferOAuth: z.boolean().optional(),
    /** OAuth-specific headers */
    oauthHeaders: z.record(z.string()).optional(),
  })
  .strict();

/**
 * Extended Google provider configuration schema
 * Includes authentication options beyond basic API key
 */
export const GoogleProviderConfigSchema = z
  .object({
    /** API key for authentication */
    apiKey: z.string().optional(),
    /** Model identifier to use */
    model: z.string().optional(),
    /** Base URL for API endpoint */
    baseURL: z.string().url().optional(),
    /** Authentication type (default: 'api-key') */
    authType: z.enum(['api-key', 'bearer']).optional(),
    /** Additional headers to include in requests */
    customHeaders: z.record(z.string()).optional(),
    /** Skip default auth headers */
    disableDefaultAuth: z.boolean().optional(),
  })
  .strict();

/**
 * Base MCP server configuration fields
 * Common fields shared by both stdio and SSE servers
 */
const BaseMCPServerFields = {
  /** Operation timeout in milliseconds */
  timeout: z.number().min(1000).max(600000).optional(),
  /** Initialization timeout in milliseconds */
  initTimeout: z.number().min(1000).max(60000).optional(),
  /** Disable this server */
  disabled: z.boolean().optional(),
  /** List of tool names to disable */
  disabledTools: z.array(z.string()).optional(),
  /** List of tool names to auto-approve */
  autoApprove: z.array(z.string()).optional(),
  /** Server description */
  description: z.string().optional(),
};

/**
 * Stdio MCP server configuration schema
 * For servers launched as child processes
 */
const StdioMCPServerConfigSchema = z
  .object({
    /** Server type */
    type: z.literal('stdio'),
    /** Command to execute */
    command: z.string(),
    /** Command arguments */
    args: z.array(z.string()).optional(),
    /** Environment variables */
    env: z.record(z.string()).optional(),
    /** Working directory */
    cwd: z.string().optional(),
    ...BaseMCPServerFields,
  })
  .strict();

/**
 * SSE MCP server configuration schema
 * For servers accessed via Server-Sent Events
 */
const SSEMCPServerConfigSchema = z
  .object({
    /** Server type */
    type: z.literal('sse'),
    /** Server URL */
    url: z.string().url(),
    /** HTTP headers */
    headers: z.record(z.string()).optional(),
    ...BaseMCPServerFields,
  })
  .strict();

/**
 * Inferred stdio config (no explicit type, has command)
 */
const InferredStdioConfigSchema = z
  .object({
    /** Command to execute */
    command: z.string(),
    /** Command arguments */
    args: z.array(z.string()).optional(),
    /** Environment variables */
    env: z.record(z.string()).optional(),
    /** Working directory */
    cwd: z.string().optional(),
    ...BaseMCPServerFields,
  })
  .strict();

/**
 * Inferred SSE config (no explicit type, has url)
 */
const InferredSSEConfigSchema = z
  .object({
    /** Server URL */
    url: z.string().url(),
    /** HTTP headers */
    headers: z.record(z.string()).optional(),
    ...BaseMCPServerFields,
  })
  .strict();

/**
 * MCP server configuration schema
 * Discriminated union supporting both explicit type and implicit inference
 */
const MCPServerConfigSchema = z
  .discriminatedUnion('type', [
    StdioMCPServerConfigSchema,
    SSEMCPServerConfigSchema,
  ])
  .or(z.union([InferredStdioConfigSchema, InferredSSEConfigSchema]));

/**
 * System prompt configuration schema
 * Controls how custom system prompts are applied
 */
export const SystemPromptConfigSchema = z
  .object({
    /** How to apply the system prompt to the default */
    mode: z.enum(['replace', 'append', 'prepend']).default('append'),
    /** Either text content or file path */
    value: z.string().min(1),
  })
  .strict();

/**
 * SessionStart hook configuration schema
 * Configures shell commands to run when sessions start
 */
export const SessionStartHookSchema = z
  .object({
    /** When to run this hook (omitted = all session starts) */
    matcher: z.enum(['startup', 'resume', 'clear']).optional(),
    /** Shell command to execute */
    command: z.string().min(1),
  })
  .strict();

/**
 * PostToolUse hook configuration schema with regex validation
 * Configures shell commands to run after tool execution
 */
export const PostToolUseHookSchema = z
  .object({
    /** Regular expression pattern to match tool names */
    matcher: z
      .string()
      .min(1)
      .refine(
        (pattern) => {
          try {
            new RegExp(pattern);
            return true;
          } catch {
            return false;
          }
        },
        { message: 'matcher must be a valid regular expression' }
      ),
    /** Shell command to execute */
    command: z.string().min(1),
  })
  .strict();

/**
 * Hooks configuration schema
 * Defines all available hook types and their configurations
 */
export const HookConfigSchema = z
  .object({
    /** Hooks that run when sessions start */
    SessionStart: z.array(SessionStartHookSchema).optional(),
    /** Hooks that run after tool execution */
    PostToolUse: z.array(PostToolUseHookSchema).optional(),
  })
  .strict();

/**
 * TUI keybinding action map schema
 * Maps actions to key descriptors (single key or array of alternatives)
 */
export const TUIKeybindingActionMapSchema = z.record(
  z.union([z.string(), z.array(z.string())])
);

/**
 * TUI keybindings configuration schema
 * Defines keybindings for different TUI scopes
 */
export const TUIKeybindingsSchema = z
  .object({
    /** Global keybindings available everywhere */
    global: TUIKeybindingActionMapSchema.optional(),
    /** Modal-specific keybindings */
    modal: TUIKeybindingActionMapSchema.optional(),
    /** Autocomplete-specific keybindings */
    autocomplete: TUIKeybindingActionMapSchema.optional(),
    /** Input area keybindings */
    input: TUIKeybindingActionMapSchema.optional(),
    /** Message list keybindings */
    messages: TUIKeybindingActionMapSchema.optional(),
    /** Prefix key definitions */
    prefixes: z.record(z.union([z.string(), z.array(z.string())])).optional(),
    /** Key to cancel prefix mode */
    prefixCancel: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .strict();

/**
 * Complete configuration schema
 */
export const CONFIG_SCHEMA = z
  .object({
    /** MCP server configurations keyed by server name */
    mcpServers: z.record(MCPServerConfigSchema).optional(),
    /** AI provider configurations */
    providers: z
      .object({
        /** Default provider to use */
        default: z
          .enum(['openai', 'openrouter', 'anthropic', 'google'])
          .optional(),
        /** OpenAI provider configuration */
        openai: ProviderConfigSchema.optional(),
        /** OpenRouter provider configuration */
        openrouter: ProviderConfigSchema.optional(),
        /** Anthropic provider configuration */
        anthropic: AnthropicProviderConfigSchema.optional(),
        /** Google provider configuration */
        google: GoogleProviderConfigSchema.optional(),
      })
      .strict()
      .optional(),
    /** Agent behavior configuration */
    agent: z
      .object({
        /** Maximum number of agent steps */
        maxSteps: z.number().min(1).max(1000).optional(),
        /** Agent execution timeout in milliseconds */
        timeout: z.number().min(1000).max(3600000).optional(),
        /** Enable verbose logging */
        verbose: z.boolean().optional(),
        /** Enable streaming responses */
        streaming: z.boolean().optional(),
        /** Log level for agent operations */
        logLevel: z
          .enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'])
          .optional(),
        /** What to log during agent execution */
        logProgress: z.enum(['none', 'assistant', 'tool', 'all']).optional(),
        /** Custom system prompt configuration */
        systemPrompt: SystemPromptConfigSchema.optional(),
      })
      .strict()
      .optional(),
    /** Tool management configuration */
    tools: z
      .object({
        /** List of internal tool names to disable */
        disabledInternalTools: z.array(z.string()).optional(),
        /** Global timeout for all tool executions in milliseconds */
        globalTimeout: z.number().min(1000).max(600000).optional(),
      })
      .strict()
      .optional(),
    /** TUI keybindings configuration */
    keybindings: TUIKeybindingsSchema.optional(),
    /** Hook configurations */
    hooks: HookConfigSchema.optional(),
  })
  .strict();

/**
 * Validates configuration object against schema using Zod
 */
export function validateConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  try {
    CONFIG_SCHEMA.parse(config);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
        return `${path}: ${issue.message}`;
      });
      return { valid: false, errors };
    }

    return {
      valid: false,
      errors: [
        `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
  }
}
