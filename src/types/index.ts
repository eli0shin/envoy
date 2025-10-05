/**
 * TypeScript type definitions for the CLI AI Agent
 * Defines interfaces for MCP server configurations and tool wrappers
 */

import type { Tool } from 'ai';
import { z } from 'zod/v3';
import type { ChildProcess } from 'child_process';
import type { ModelMessage } from 'ai';

/**
 * Base MCP server configuration
 */
export type BaseMCPServerConfig = {
  name: string;
  description?: string;
  timeout?: number;
  initTimeout?: number;
  disabledTools?: string[];
  autoApprove?: string[];
};

/**
 * Configuration for stdio-based MCP servers (local processes)
 */
export type StdioMCPServerConfig = BaseMCPServerConfig & {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
};

/**
 * Configuration for SSE-based MCP servers (remote HTTP endpoints)
 */
export type SSEMCPServerConfig = BaseMCPServerConfig & {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
};

/**
 * Union type for all MCP server configurations
 * Type is automatically inferred: 'stdio' if 'command' is present, 'sse' if 'url' is present
 */
export type MCPServerConfig = StdioMCPServerConfig | SSEMCPServerConfig;

/**
 * Wrapped tool with logging functionality
 * AI SDK tool with metadata
 */
export type WrappedTool = Tool & {
  serverName: string;
  toolName: string;
};

/**
 * MCP prompt type
 */
export type MCPPrompt = {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
};

/**
 * MCP resource type
 */
export type MCPResource = {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
};

/**
 * Prompt execution result
 */
export type PromptResult = {
  description?: string;
  messages: Array<{
    role: string;
    content: {
      type: string;
      text?: string;
    };
  }>;
};

/**
 * Resource content result
 */
export type ResourceContent = {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
};

/**
 * MCP client wrapper type
 */
export type MCPClientWrapper = {
  serverName: string;
  serverConfig: MCPServerConfig;
  tools: Record<string, WrappedTool>;
  prompts: Map<string, MCPPrompt>;
  resources: Map<string, MCPResource>;
  isConnected: boolean;
  childProcess?: ChildProcess; // Reference to child process for cleanup
  client: unknown; // Underlying MCP client for notification handlers
  // New methods for prompts and resources
  listPrompts(): Promise<MCPPrompt[]>;
  getPrompt(
    name: string,
    args?: Record<string, unknown>
  ): Promise<PromptResult>;
  listResources(): Promise<MCPResource[]>;
  readResource(uri: string): Promise<ResourceContent>;
};

/**
 * Tool loading result
 */
export type ToolLoadResult = {
  tools: Record<string, WrappedTool>;
  errors: Array<{
    serverName: string;
    error: string;
  }>;
};

/**
 * Integrated MCP server loading result with both tools and client wrappers
 */
export type MCPLoadResult = {
  tools: Record<string, WrappedTool>;
  clients: MCPClientWrapper[];
  errors: Array<{
    serverName: string;
    error: string;
  }>;
};

/**
 * CLI options for the agent
 */
export type CLIOptions = {
  message?: string;
  stdin?: boolean;
  provider?: string;
  model?: string;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT';
  logProgress?: 'none' | 'assistant' | 'tool' | 'all';
  json?: boolean;
  maxSteps?: number;
  systemPrompt?: string;
  systemPromptFile?: string;
  systemPromptMode?: 'replace' | 'append' | 'prepend';
  // MCP Prompts and Resources CLI options
  listPrompts?: boolean;
  listResources?: boolean;
  prompt?: string;
  promptArgs?: string;
  resources?: string;
  autoResources?: boolean;
  interactivePrompt?: boolean;
  // Resume and Session Management CLI options
  resume?: string | boolean;
  listSessions?: boolean;
};

/**
 * Agent execution result
 */
export type AgentResult = {
  success: boolean;
  response?: string;
  error?: string;
  toolCallsCount: number;
  executionTime: number;
  responseMessages?: ModelMessage[]; // Final AI SDK response messages with IDs, tool calls, etc.
};

/**
 * Step output formatting
 */
export type StepOutput = {
  type: 'assistant-step' | 'tool-call' | 'assistant';
  content: string;
  timestamp?: Date;
};

/**
 * Parameters for spawning a new agent instance
 */
export type SpawnAgentParams = {
  message: string;
  systemPrompt?: string;
  timeout?: number;
};

/**
 * MCP Server capabilities structure from initialize response
 */
export type ServerCapabilities = {
  tools?: {
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  logging?: {
    level?: string;
  };
};

/**
 * Result of server initialization with capability detection
 */
export type ServerInitResult = {
  client: unknown; // MCP Client instance
  capabilities: ServerCapabilities;
  config: MCPServerConfig;
  childProcess?: ChildProcess; // Child process reference for stdio servers
  serverInfo?: {
    name: string;
    version: string;
  };
  protocolVersion?: string;
};

/**
 * Result of loading capabilities from a single server
 */
export type CapabilityLoadResult = {
  tools: WrappedTool[];
  prompts: MCPPrompt[];
  resources: MCPResource[];
  errors: string[];
  serverName: string;
};

/**
 * MCP Initialize request parameters
 */
export type MCPInitializeRequest = {
  protocolVersion: string;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    tools?: object;
    prompts?: object;
    resources?: object;
  };
};

/**
 * MCP Initialize response structure
 */
export type MCPInitializeResponse = {
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: ServerCapabilities;
  instructions?: string;
};

/**
 * Extended message interface for thinking messages with signatures
 */
export type ThinkingMessage = {
  role: 'assistant';
  content: string;
  thinking: true;
  isThinkingComplete: boolean;
  thinkingSignature?: string;
  redactedData?: {
    reason: string;
    originalLength: number;
  };
};

/**
 * Authentication information for providers
 */
export type AuthenticationInfo = {
  method: 'api-key' | 'oauth';
  source: 'environment' | 'config' | 'oauth-credentials';
  details: {
    envVarName?: string;
    oauthStatus?: 'active' | 'refresh-failed';
    hasOAuthCredentials?: boolean;
  };
};

/**
 * Extended message type with provider metadata
 */
export type ExtendedCoreMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  providerOptions?: {
    anthropic?: {
      cacheControl?: { type: 'ephemeral' };
    };
  };
};
