/**
 * Test helper utilities for creating proper mock configurations
 * Ensures compatibility with strict RuntimeConfiguration requirements
 */

import type {
  RuntimeConfiguration,
  ProvidersConfig,
  AgentConfig,
  ToolsConfig,
} from '../../config/types.js';

/**
 * Creates a complete RuntimeConfiguration for testing
 * with all required properties set to sensible defaults
 */
export function createMockRuntimeConfiguration(
  overrides: Partial<RuntimeConfiguration> = {}
): RuntimeConfiguration {
  const defaultProviders: Required<ProvidersConfig> & ProvidersConfig = {
    default: 'anthropic',
    openai: { apiKey: 'mock-openai-key' },
    openrouter: { apiKey: 'mock-openrouter-key' },
    anthropic: { apiKey: 'mock-anthropic-key' },
    google: { apiKey: 'mock-google-key' },
  };

  const defaultAgent: Required<
    Omit<AgentConfig, 'systemPrompt' | 'conversationPersistence'>
  > &
    AgentConfig = {
    maxSteps: 10,
    timeout: 30000,
    logLevel: 'INFO',
    logProgress: 'none',
    streaming: true,
  };

  const defaultTools: Required<ToolsConfig> & ToolsConfig = {
    disabledInternalTools: [],
    globalTimeout: 30000,
  };

  return {
    providers: defaultProviders,
    agent: defaultAgent,
    tools: defaultTools,
    ...overrides,
  };
}

/**
 * Creates a minimal RuntimeConfiguration for tests that need basic structure
 */
export function createMinimalMockRuntimeConfiguration(
  overrides: Partial<RuntimeConfiguration> = {}
): RuntimeConfiguration {
  return createMockRuntimeConfiguration({
    providers: {
      default: 'anthropic',
      openai: {},
      openrouter: {},
      anthropic: { apiKey: 'test-key' },
      google: {},
    },
    agent: {
      maxSteps: 5,
      timeout: 10000,
      logLevel: 'SILENT',
      logProgress: 'none',
      streaming: false,
    },
    tools: {
      disabledInternalTools: [],
      globalTimeout: 10000,
    },
    ...overrides,
  } as RuntimeConfiguration);
}
