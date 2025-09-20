/**
 * Core configuration constants for the CLI AI Agent
 * Contains system prompt and MCP server configurations
 */

import { MCPServerConfig } from './types/index.js';
import {
  RuntimeConfiguration,
  EnhancedMCPServerConfig,
} from './config/types.js';
import { getSessionId } from './logger.js';

/**
 * Default system prompt that defines the assistant's persona and operating guidelines
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Envoy, a capable CLI AI agent with access to various tool.
Your goal is to complete a task specified by the user.
The task may be complex and require significant effort and thinking to complete.
Your responsibility is to complete the task without requiring intervention from the user.
You use the tools available to you to accomplish the task given by the user.

Operating Guidelines:
- You can call multiple tools to gather information and perform tasks
- Always explain what you are doing when calling tools
- Provide clear, concise responses based on tool results
- If a tool call fails, acknowledge the error and try alternative approaches
- Be proactive in using available tools to help users accomplish their goals
- When multiple steps are needed, break down the process step by step
- Before writing a new file always check whether it exists first.
- If a file already exists edit it instead of writing it
- Always read a file before editing it
- When using the brave search tool only perform 1 search at a time to avoid exceeding rate limits
- When using the brave search tool use fetch when needed to get the full contents of the page
- Use thinking tools for analysis of problem spaces and deep research
- Think step by step before each action, especially when processing tool results and planning next steps
- Always think through the implications of tool results before deciding on next actions

Your responses should be:
- Accurate and based on current information from tools
- Well-structured and easy to understand
- Helpful and actionable
- Professional but friendly in tone

Use the tools available to you to help answer the user's question.
It is your responsibility to discover the best tools for the job and use them effectively.
It is also your responsibility to ensure that you have the necessary context to answer the user's question before responding.
You are in a non-interactive environment meaning that the user cannot respond to you after they send the initial message.
If you are unsure and have a question think about 3 possible answers and proceed with the most likely one.
Do not stop until the task is complete and all outputs are delivered.

Do not use the filesystem_directory_tree tool.

Always prioritize user safety and privacy when handling information.`;

/**
 * Builds the system prompt with dynamic information and custom content
 */
export function buildSystemPrompt(
  customContent?: string,
  mode: 'replace' | 'append' | 'prepend' = 'replace',
  isInteractive: boolean = false
): string {
  const systemInfo = `
<system information>
Current Time: ${new Date().toLocaleTimeString()}
Current working directory: ${process.cwd()}
</system information>`;

  let prompt: string;

  // Build the base prompt with conditional non-interactive line
  const basePrompt =
    isInteractive ?
      DEFAULT_SYSTEM_PROMPT.replace(
        'You are in a non-interactive environment meaning that the user cannot respond to you after they send the initial message.\nIf you are unsure and have a question think about 3 possible answers and proceed with the most likely one.\nDo not stop until the task is complete and all outputs are delivered.',
        ''
      ).trim()
    : DEFAULT_SYSTEM_PROMPT;

  if (!customContent) {
    // No custom content, use base prompt
    prompt = basePrompt;
  } else if (mode === 'replace') {
    // Replace default with custom content
    prompt = customContent;
  } else if (mode === 'append') {
    // Append custom content to base prompt
    prompt = basePrompt + '\n\n' + customContent;
  } else if (mode === 'prepend') {
    // Prepend custom content to base prompt
    prompt = customContent + '\n\n' + basePrompt;
  } else {
    // Fallback to base prompt
    prompt = basePrompt;
  }

  // Always append system information
  return prompt + systemInfo;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use buildSystemPrompt() instead
 */
export const SYSTEM_PROMPT = buildSystemPrompt();

/**
 * MCP server configuration array
 * Defines both stdio and SSE MCP servers that the agent can connect to
 *
 * Note: Commands like 'npx', 'uvx', etc. are automatically resolved to their
 * full paths using the current shell environment, so you can use them directly
 * without needing to specify absolute paths.
 */
export const MCP_SERVERS: EnhancedMCPServerConfig[] = [
  // Example stdio MCP server (local)
  // {
  //   name: 'echo-server',
  //   type: 'stdio',
  //   command: 'node',
  //   args: ['./e2e/fixtures/echo-mcp-server.js'],
  //   description: 'Simple echo server for testing and development'
  // },
  {
    name: 'todo-list',
    type: 'stdio',
    command: 'npx',
    args: ['tsx', './src/todoServer.ts'],
    env: {
      // Pass current environment variables including session ID
      ...(Object.fromEntries(
        Object.entries(process.env).filter(([_, value]) => value !== undefined)
      ) as Record<string, string>),
      // Pass session ID to todo server
      AGENT_SESSION_ID: getSessionId(),
    },
    description: 'Todo list management for tracking multi-step tasks',
  },
  {
    name: 'filesystem',
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    disabledTools: [
      'read_file',
      'read_media_file',
      'list_allowed_directories',
      'get_file_info',
      'directory_tree',
    ],
  },
  {
    name: 'shell',
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'mcp-shell'],
    disabledTools: ['list_resources', 'read_resource'],
  },
  // Example SSE MCP server (remote)
  // {
  //   name: 'weather-server',
  //   type: 'sse',
  //   url: 'https://api.example.com/mcp/weather',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.WEATHER_API_KEY || ''}`
  //   },
  //   description: 'Weather information service'
  // },
];

/**
 * Creates MCP server configuration with runtime configuration support
 * This allows the agent spawner server to inherit the parent agent's configuration
 */
export function createMCPServersWithConfig(
  runtimeConfig?: RuntimeConfiguration
): MCPServerConfig[] {
  const servers = [...MCP_SERVERS];

  // Add MCP servers from the runtime configuration file
  if (runtimeConfig?.mcpServers) {
    const fileServers = convertToLegacyMCPServers(runtimeConfig.mcpServers);
    servers.push(...fileServers);
  }

  // Add agent spawning server if not disabled
  if (process.env.AGENT_SPAWNING_DISABLED !== 'true') {
    const agentSpawnerConfig: MCPServerConfig = {
      name: 'agent-spawner',
      type: 'stdio',
      command: 'npx',
      args: ['tsx', './src/agentSpawnerServer.ts'],
      env: {
        // Pass current environment variables
        ...(Object.fromEntries(
          Object.entries(process.env).filter(
            ([_, value]) => value !== undefined
          )
        ) as Record<string, string>),
        // Always pass runtime configuration as JSON
        AGENT_RUNTIME_CONFIG: JSON.stringify(runtimeConfig),
      },
      description: 'Agent spawning server',
    };

    servers.unshift(agentSpawnerConfig);
  }

  return servers;
}

/**
 * Helper function to convert enhanced MCP server configs back to legacy format
 */
function convertToLegacyMCPServers(
  mcpServers: Record<string, EnhancedMCPServerConfig>
): MCPServerConfig[] {
  const result: MCPServerConfig[] = [];

  for (const [name, config] of Object.entries(mcpServers)) {
    if (config.disabled) {
      continue; // Skip disabled servers
    }

    const baseConfig = {
      name,
      description: config.description,
    };

    if (config.type === 'stdio') {
      // Type guard to access stdio-specific properties
      const stdioConfig = config as EnhancedMCPServerConfig & {
        type: 'stdio';
        command: string;
        args?: string[];
        env?: Record<string, string>;
        cwd?: string;
      };
      result.push({
        ...baseConfig,
        type: 'stdio',
        command: stdioConfig.command!,
        args: stdioConfig.args,
        env: stdioConfig.env,
        cwd: stdioConfig.cwd,
        timeout: config.timeout,
        initTimeout: config.initTimeout,
        disabledTools: config.disabledTools,
        autoApprove: config.autoApprove,
      });
    } else if (config.type === 'sse') {
      // Type guard to access sse-specific properties
      const sseConfig = config as EnhancedMCPServerConfig & {
        type: 'sse';
        url: string;
        headers?: Record<string, string>;
        timeout?: number;
      };
      result.push({
        ...baseConfig,
        type: 'sse',
        url: sseConfig.url!,
        headers: sseConfig.headers,
        timeout: sseConfig.timeout,
        disabledTools: config.disabledTools,
        autoApprove: config.autoApprove,
      });
    }
  }

  return result;
}

/**
 * Tool execution timeout in milliseconds (30 minutes)
 * Allows for long-running operations like complex agent spawning
 */
export const TOOL_TIMEOUT_MS = 1800000;

/**
 * Maximum number of conversation steps before termination
 */
export const MAX_STEPS = 100;

/**
 * Text generation timeout in milliseconds (20 minutes)
 * Must be less than TOOL_TIMEOUT_MS to allow proper tool execution
 */
export const GENERATION_TIMEOUT_MS = 1200000;

/**
 * Maximum number of retries for generateText calls
 */
export const MAX_GENERATION_RETRIES = 3;

/**
 * Thinking/reasoning configuration for different providers
 */
export const THINKING_CONFIG = {
  // Default budgets by provider
  anthropic: {
    defaultBudget: 1024, // Minimum required by Anthropic API
    maxBudget: 32768, // ~32k tokens to support ultrathink
    costMultiplier: 1.0, // Same as output tokens
  },
  openai: {
    defaultEffort: 'medium' as const,
    efforts: ['low', 'medium', 'high'] as const,
  },
  google: {
    defaultBudget: 8192,
    maxBudget: 24576, // Google's official maximum thinking budget
    costMultiplier: 6.0, // 6x base cost
  },
};
