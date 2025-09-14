/**
 * Zod schema definition for configuration validation
 * Ensures configuration files follow the correct structure
 */

import { z } from 'zod';

/**
 * Provider configuration schema
 */
const ProviderConfigSchema = z
  .object({
    apiKey: z.string().optional(),
    model: z.string().optional(),
    baseURL: z.string().url().optional(),
  })
  .strict();

/**
 * Extended Anthropic provider configuration schema
 */
const AnthropicProviderConfigSchema = z
  .object({
    apiKey: z.string().optional(),
    model: z.string().optional(),
    baseURL: z.string().url().optional(),
    authType: z.enum(['x-api-key', 'bearer', 'oauth']).optional(),
    customHeaders: z.record(z.string()).optional(),
    disableDefaultAuth: z.boolean().optional(),
    enableOAuth: z.boolean().optional(),
    preferOAuth: z.boolean().optional(),
    oauthHeaders: z.record(z.string()).optional(),
  })
  .strict();

/**
 * MCP server configuration schema with custom validation for better error messages
 * Supports both explicit type and implicit type inference
 */
const MCPServerConfigSchema = z.any().superRefine((data, ctx) => {
  // Check if it's an object
  if (typeof data !== 'object' || data === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.invalid_type,
      expected: 'object',
      received: typeof data,
    });
    return;
  }

  const config = data as Record<string, unknown>;

  // Determine if this should be stdio or sse based on explicit type or properties
  let expectedType: 'stdio' | 'sse' | null = null;

  if (config.type === 'stdio' || config.type === 'sse') {
    expectedType = config.type;
  } else if ('command' in config && !('url' in config)) {
    expectedType = 'stdio';
  } else if ('url' in config && !('command' in config)) {
    expectedType = 'sse';
  } else if ('command' in config && 'url' in config) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cannot have both 'command' and 'url' properties",
    });
    return;
  }

  if (!expectedType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Must have either 'type' field or 'command'/'url' property to determine server type",
    });
    return;
  }

  // Validate based on the determined type
  if (expectedType === 'stdio') {
    const stdioSchema = z
      .object({
        type: z.literal('stdio').optional(),
        command: z.string(),
        args: z.array(z.string()).optional(),
        env: z.record(z.string()).optional(),
        cwd: z.string().optional(),
        timeout: z.number().min(1000).max(600000).optional(),
        initTimeout: z.number().min(1000).max(60000).optional(),
        disabled: z.boolean().optional(),
        disabledTools: z.array(z.string()).optional(),
        autoApprove: z.array(z.string()).optional(),
        description: z.string().optional(),
      })
      .strict();

    const result = stdioSchema.safeParse(config);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        ctx.addIssue(issue);
      });
    }
  } else if (expectedType === 'sse') {
    const sseSchema = z
      .object({
        type: z.literal('sse').optional(),
        url: z.string().url(),
        headers: z.record(z.string()).optional(),
        timeout: z.number().min(1000).max(600000).optional(),
        initTimeout: z.number().min(1000).max(60000).optional(),
        disabled: z.boolean().optional(),
        disabledTools: z.array(z.string()).optional(),
        autoApprove: z.array(z.string()).optional(),
        description: z.string().optional(),
      })
      .strict();

    const result = sseSchema.safeParse(config);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        ctx.addIssue(issue);
      });
    }
  }
});

/**
 * System prompt configuration schema
 */
const SystemPromptConfigSchema = z
  .object({
    mode: z.enum(['replace', 'append', 'prepend']).default('append'),
    value: z.string().min(1),
  })
  .strict();

/**
 * Complete configuration schema
 */
export const CONFIG_SCHEMA = z
  .object({
    mcpServers: z.record(MCPServerConfigSchema).optional(),
    providers: z
      .object({
        default: z.enum(['openai', 'openrouter', 'anthropic']).optional(),
        openai: ProviderConfigSchema.optional(),
        openrouter: ProviderConfigSchema.optional(),
        anthropic: AnthropicProviderConfigSchema.optional(),
      })
      .strict()
      .optional(),
    agent: z
      .object({
        maxSteps: z.number().min(1).max(1000).optional(),
        timeout: z.number().min(1000).max(3600000).optional(),
        verbose: z.boolean().optional(),
        streaming: z.boolean().optional(),
        logLevel: z
          .enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'])
          .optional(),
        logProgress: z.enum(['none', 'assistant', 'tool', 'all']).optional(),
        systemPrompt: SystemPromptConfigSchema.optional(),
      })
      .strict()
      .optional(),
    tools: z
      .object({
        disabledInternalTools: z.array(z.string()).optional(),
        globalTimeout: z.number().min(1000).max(600000).optional(),
      })
      .strict()
      .optional(),
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
