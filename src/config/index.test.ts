/**
 * Unit tests for configuration system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadConfiguration,
  getMCPServersFromConfig,
  getProviderFromConfig,
  getAgentConfigFromConfig,
  expandConfigEnvironmentVariables,
} from './index.js';
import { validateConfig } from './schema.js';
import { readJsonFile } from '../shared/fileOperations.js';

// Mock shared file operations
vi.mock('../shared/fileOperations.js', () => ({
  readJsonFile: vi.fn(),
  getUserConfigPath: vi.fn(),
  handleFileError: vi.fn(),
}));

// Mock process.cwd and homedir for consistent testing
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: vi.fn(() => '/test/home'),
  };
});

const mockCwd = '/test/project';
vi.stubGlobal('process', {
  ...process,
  cwd: vi.fn(() => mockCwd),
});

describe('Configuration Schema Validation', () => {
  it('should validate correct configuration', () => {
    const config = {
      mcpServers: {
        filesystem: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
        },
      },
      providers: {
        default: 'openrouter',
        openrouter: {
          model: 'google/gemini-2.5-flash-preview-05-20',
        },
      },
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid configuration', () => {
    const config = {
      mcpServers: {
        invalid: {
          type: 'invalid-type',
        },
      },
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should require command for stdio servers', () => {
    const config = {
      mcpServers: {
        stdio_server: {
          type: 'stdio',
          // missing command
        },
      },
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'mcpServers.stdio_server.command: Required'
    );
  });

  it('should require url for sse servers', () => {
    const config = {
      mcpServers: {
        sse_server: {
          type: 'sse',
          // missing url
        },
      },
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('mcpServers.sse_server.url: Required');
  });
});

describe('Configuration Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should use defaults when no config files exist', async () => {
    // Mock all config files as not existing
    vi.mocked(readJsonFile).mockResolvedValue(null);

    const result = await loadConfiguration();

    expect(result.config).toBeDefined();
    expect(result.config.providers?.default).toBe('anthropic');
    expect(result.config.agent?.maxSteps).toBe(100);
    expect(result.loadedFrom).toHaveLength(0);
  });

  it('should handle invalid JSON gracefully', async () => {
    // Mock readJsonFile to throw an error for invalid JSON
    vi.mocked(readJsonFile)
      .mockRejectedValueOnce(
        new Error('Invalid JSON in /test/project/.envoy.json: Unexpected token')
      )
      .mockResolvedValue(null); // Other files don't exist

    const result = await loadConfiguration();

    expect(result.config).toBeDefined(); // Should still have defaults
    expect(result.errors?.length).toBeGreaterThan(0); // Should report error
  });

  it('should expand environment variables', async () => {
    process.env.TEST_API_KEY = 'test-key-123';

    const configWithEnv = {
      providers: {
        openai: {
          apiKey: '${TEST_API_KEY}',
        },
      },
    };

    // Test environment variable expansion directly
    const expanded = expandConfigEnvironmentVariables(
      configWithEnv as Record<string, unknown>
    );

    expect(expanded.providers?.openai?.apiKey).toBe('test-key-123');

    delete process.env.TEST_API_KEY;
  });

  it('should preserve unexpanded variables for missing env vars', async () => {
    const configWithMissingEnv = {
      providers: {
        openai: {
          apiKey: '${MISSING_VAR}',
        },
      },
    };

    const expanded = expandConfigEnvironmentVariables(
      configWithMissingEnv as Record<string, unknown>
    );

    expect(expanded.providers?.openai?.apiKey).toBe('${MISSING_VAR}');
  });

  it('should apply CLI overrides correctly', async () => {
    // Mock all config files as not existing so we only test CLI overrides
    vi.mocked(readJsonFile).mockResolvedValue(null);

    const result = await loadConfiguration({
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      logLevel: 'DEBUG',
      logProgress: 'all',
      maxSteps: 5,
    });

    expect(result.config.providers?.default).toBe('openai');
    expect(result.config.providers?.openai?.model).toBe('gpt-3.5-turbo');
    expect(result.config.agent?.logLevel).toBe('DEBUG');
    expect(result.config.agent?.logProgress).toBe('all');
    expect(result.config.agent?.maxSteps).toBe(5);
  });
});

describe('Configuration Helpers', () => {
  it('should convert MCP servers correctly', () => {
    const config = {
      mcpServers: {
        filesystem: {
          type: 'stdio' as const,
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
        },
        remote: {
          type: 'sse' as const,
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer token' },
        },
        disabled: {
          type: 'stdio' as const,
          command: 'echo',
          disabled: true,
        },
      },
    };

    const servers = getMCPServersFromConfig(config);

    expect(servers).toHaveLength(2); // disabled server should be excluded
    expect(servers[0].name).toBe('filesystem');
    expect(servers[0].type).toBe('stdio');
    expect(servers[1].name).toBe('remote');
    expect(servers[1].type).toBe('sse');
  });

  it('should get provider configuration', () => {
    const config = {
      providers: {
        default: 'openai' as const,
        openai: {
          model: 'gpt-4',
          apiKey: 'sk-test',
          baseURL: 'https://api.openai.com/v1',
        },
      },
    };

    const provider = getProviderFromConfig(config);

    expect(provider.provider).toBe('openai');
    expect(provider.model).toBe('gpt-4');
    expect(provider.apiKey).toBe('sk-test');
    expect(provider.baseURL).toBe('https://api.openai.com/v1');
  });

  it('should get agent configuration with defaults', () => {
    const config = {
      agent: {
        maxSteps: 50,
        logLevel: 'DEBUG' as const,
        logProgress: 'all' as const,
      },
    };

    const agentConfig = getAgentConfigFromConfig(config);

    expect(agentConfig.maxSteps).toBe(50);
    expect(agentConfig.logLevel).toBe('DEBUG');
    expect(agentConfig.logProgress).toBe('all');
    expect(agentConfig.timeout).toBe(1200000); // updated default value
  });

  it('should handle empty configuration', () => {
    const config = {};

    const servers = getMCPServersFromConfig(config);
    const provider = getProviderFromConfig(config);
    const agentConfig = getAgentConfigFromConfig(config);

    expect(servers).toHaveLength(0);
    expect(provider.provider).toBe('openrouter');
    expect(agentConfig.maxSteps).toBe(100);
  });
});
