export type MockConfig = {
  provider: 'anthropic' | 'openai' | 'openrouter';
  model: string;
  apiKey?: string;
  disableAgentSpawning?: boolean;
  mcpServers?: Array<{
    name: string;
    command: string;
    args: string[];
  }>;
};

export function createMockConfig(
  overrides: Partial<MockConfig> = {}
): MockConfig {
  return {
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    apiKey: 'test-key-mock',
    disableAgentSpawning: true,
    mcpServers: [],
    ...overrides,
  };
}

export async function setupTestConfig(
  env: { writeFile: (path: string, content: string) => Promise<void> },
  config: MockConfig
): Promise<string> {
  const configPath = './.envoy.json';
  const configContent = JSON.stringify(
    {
      providers: {
        default: config.provider,
        [config.provider]: {
          model: config.model,
        },
      },
      mcp: {
        servers: config.mcpServers || [],
      },
      agent: {
        logLevel: 'DEBUG',
        logProgress: 'all',
      },
    },
    null,
    2
  );

  await env.writeFile(configPath, configContent);
  return configPath;
}

export function setupMockEnvironment(config: MockConfig) {
  const originalEnv = { ...process.env };

  // Set API keys
  if (config.apiKey) {
    process.env.ANTHROPIC_API_KEY = config.apiKey;
    process.env.OPENAI_API_KEY = config.apiKey;
    process.env.OPENROUTER_API_KEY = config.apiKey;
  }

  // Disable agent spawning if requested
  if (config.disableAgentSpawning) {
    process.env.AGENT_SPAWNING_DISABLED = 'true';
  }

  // Force test mode
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';

  return () => {
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
  };
}
