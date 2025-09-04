/**
 * Default configuration factory
 * Provides the default configuration values for the application
 */

import type { Configuration, EnhancedMCPServerConfig } from './types.js';
import {
  MCP_SERVERS,
  MAX_STEPS,
  TOOL_TIMEOUT_MS,
  GENERATION_TIMEOUT_MS,
} from '../constants.js';

/**
 * Default configuration based on existing constants
 */
export function getDefaultConfiguration(): Configuration {
  // Convert MCP_SERVERS to the new format
  const mcpServers: Record<string, EnhancedMCPServerConfig> = {};
  for (const server of MCP_SERVERS) {
    mcpServers[server.name] = {
      ...server,
      description: server.description,
    };
  }

  return {
    mcpServers,
    providers: {
      default: 'anthropic',
      openrouter: {
        model: 'google/gemini-2.5-flash-preview-05-20',
      },
      openai: {
        model: 'gpt-4.1',
      },
      anthropic: {
        model: 'claude-sonnet-4-20250514',
        authType: 'x-api-key',
      },
      google: {
        model: 'gemini-2.5-pro',
        authType: 'api-key',
      },
    },
    agent: {
      maxSteps: MAX_STEPS,
      timeout: GENERATION_TIMEOUT_MS,
      logLevel: 'SILENT',
      logProgress: 'none',
      streaming: true,
      conversationPersistence: {
        enabled: true,
        projectPath: process.cwd(),
      },
    },
    tools: {
      globalTimeout: TOOL_TIMEOUT_MS,
    },
  };
}
