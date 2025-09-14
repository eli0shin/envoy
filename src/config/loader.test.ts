/**
 * Tests for loader.ts module
 * Tests configuration loading orchestration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadConfiguration,
  createRuntimeConfiguration,
  loadSystemPromptContent,
  getProviderFromConfig,
  getAgentConfigFromConfig,
} from './loader.js';
import type { Configuration, CLIConfigOverrides } from './types.js';
import type { CLIOptions } from '../types/index.js';

// Mock all dependencies
vi.mock('./defaults.js', () => ({
  getDefaultConfiguration: vi.fn(),
}));

vi.mock('./files.js', () => ({
  getConfigFilePaths: vi.fn(),
  loadConfigFile: vi.fn(),
  loadSystemPromptFile: vi.fn(),
  isFilePath: vi.fn(),
}));

vi.mock('./overrides.js', () => ({
  applyCLIOverrides: vi.fn(),
}));

vi.mock('./environment.js', () => ({
  expandConfigEnvironmentVariables: vi.fn(),
}));

vi.mock('./mcpServers.js', () => ({
  inferMCPServerType: vi.fn(),
}));

// Import mocked functions
import { getDefaultConfiguration } from './defaults.js';
import {
  getConfigFilePaths,
  loadConfigFile,
  loadSystemPromptFile,
  isFilePath,
} from './files.js';
import { applyCLIOverrides } from './overrides.js';
import { expandConfigEnvironmentVariables } from './environment.js';
import { access } from 'fs/promises';

describe('loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment variables
    delete process.env.ENVOY_PERSISTENCE_ENABLED;
    delete process.env.ENVOY_PERSISTENCE_PROJECT_PATH;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadConfiguration', () => {
    it('should load configuration with defaults and no config files', async () => {
      const defaultConfig: Configuration = {
        providers: { default: 'anthropic' },
        agent: { maxSteps: 100 },
      };

      vi.mocked(getDefaultConfiguration).mockReturnValue(defaultConfig);
      vi.mocked(getConfigFilePaths).mockReturnValue([
        '/project/.envoy.json',
        '/user/config.json',
        '/home/.envoy.json',
      ]);
      vi.mocked(loadConfigFile)
        .mockResolvedValueOnce({}) // No config found
        .mockResolvedValueOnce({}) // No config found
        .mockResolvedValueOnce({}); // No config found
      vi.mocked(expandConfigEnvironmentVariables).mockReturnValue(
        defaultConfig
      );
      vi.mocked(applyCLIOverrides).mockReturnValue(defaultConfig);

      const result = await loadConfiguration();

      expect(result.config).toEqual(defaultConfig);
      expect(result.loadedFrom).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should load and merge configuration files', async () => {
      const defaultConfig: Configuration = {
        providers: { default: 'anthropic' },
      };
      const userConfig: Configuration = {
        providers: { default: 'openai', openai: { model: 'gpt-4' } },
      };
      const projectConfig: Configuration = {
        agent: { maxSteps: 50 },
      };
      const mergedConfig: Configuration = {
        providers: { default: 'openai', openai: { model: 'gpt-4' } },
        agent: { maxSteps: 50 },
      };

      vi.mocked(getDefaultConfiguration).mockReturnValue(defaultConfig);
      vi.mocked(getConfigFilePaths).mockReturnValue([
        '/project/.envoy.json',
        '/user/config.json',
      ]);
      vi.mocked(loadConfigFile)
        .mockResolvedValueOnce({ config: projectConfig })
        .mockResolvedValueOnce({ config: userConfig });
      vi.mocked(expandConfigEnvironmentVariables).mockReturnValue(mergedConfig);
      vi.mocked(applyCLIOverrides).mockReturnValue(mergedConfig);

      const result = await loadConfiguration();

      expect(result.config).toEqual(mergedConfig);
      expect(result.loadedFrom).toEqual([
        '/project/.envoy.json',
        '/user/config.json',
      ]);
    });

    it('should handle config file errors', async () => {
      const defaultConfig: Configuration = {
        providers: { default: 'anthropic' },
      };

      vi.mocked(getDefaultConfiguration).mockReturnValue(defaultConfig);
      vi.mocked(getConfigFilePaths).mockReturnValue(['/invalid/.envoy.json']);
      vi.mocked(loadConfigFile).mockResolvedValueOnce({
        error: 'Invalid JSON syntax',
      });
      vi.mocked(expandConfigEnvironmentVariables).mockReturnValue(
        defaultConfig
      );
      vi.mocked(applyCLIOverrides).mockReturnValue(defaultConfig);

      const result = await loadConfiguration();

      expect(result.errors).toEqual(['Invalid JSON syntax']);
      expect(result.config).toEqual(defaultConfig);
    });

    it('should apply CLI overrides', async () => {
      const defaultConfig: Configuration = {
        providers: { default: 'anthropic' },
      };
      const overrides: CLIConfigOverrides = {
        provider: 'openai',
        model: 'gpt-4',
      };
      const overriddenConfig: Configuration = {
        providers: { default: 'openai', openai: { model: 'gpt-4' } },
      };

      vi.mocked(getDefaultConfiguration).mockReturnValue(defaultConfig);
      vi.mocked(getConfigFilePaths).mockReturnValue([]);
      vi.mocked(expandConfigEnvironmentVariables).mockReturnValue(
        defaultConfig
      );
      vi.mocked(applyCLIOverrides).mockReturnValue(overriddenConfig);

      const result = await loadConfiguration(overrides);

      expect(applyCLIOverrides).toHaveBeenCalledWith(defaultConfig, overrides);
      expect(result.config).toEqual(overriddenConfig);
    });

    it('should apply environment variable overrides', async () => {
      process.env.ENVOY_PERSISTENCE_ENABLED = 'true';
      process.env.ENVOY_PERSISTENCE_PROJECT_PATH = '/custom/path';

      const defaultConfig: Configuration = {
        agent: {
          conversationPersistence: {
            enabled: false,
            projectPath: '/default',
          },
        },
      };
      const envOverriddenConfig: Configuration = {
        agent: {
          conversationPersistence: {
            enabled: true,
            projectPath: '/custom/path',
          },
        },
      };

      vi.mocked(getDefaultConfiguration).mockReturnValue(defaultConfig);
      vi.mocked(getConfigFilePaths).mockReturnValue([]);
      vi.mocked(expandConfigEnvironmentVariables).mockReturnValue(
        defaultConfig
      );
      vi.mocked(applyCLIOverrides)
        .mockReturnValueOnce(envOverriddenConfig) // env overrides
        .mockReturnValueOnce(envOverriddenConfig); // cli overrides

      const result = await loadConfiguration();

      expect(applyCLIOverrides).toHaveBeenNthCalledWith(1, defaultConfig, {
        persistenceProjectPath: '/custom/path',
      });
      expect(result.config).toEqual(envOverriddenConfig);
    });
  });

  describe('createRuntimeConfiguration', () => {
    it('should create runtime configuration from CLI options', async () => {
      const cliOptions: CLIOptions = {
        provider: 'openai',
        model: 'gpt-4',
        stdin: false,
        json: true,
        logLevel: 'DEBUG',
      };
      const loadedConfig: Configuration = {
        providers: { default: 'openai', openai: { model: 'gpt-4' } },
        agent: { logLevel: 'DEBUG' },
      };

      vi.mocked(getDefaultConfiguration).mockReturnValue({});
      vi.mocked(getConfigFilePaths).mockReturnValue([]);
      vi.mocked(expandConfigEnvironmentVariables).mockReturnValue({});
      vi.mocked(applyCLIOverrides).mockReturnValue(loadedConfig);
      vi.mocked(access).mockResolvedValue(undefined);

      const result = await createRuntimeConfiguration(cliOptions);

      expect(result.config).toMatchObject({
        stdin: false,
        json: true,
        providers: {
          default: expect.any(String),
          openai: expect.objectContaining({ model: expect.any(String) }),
        },
        agent: expect.objectContaining({
          maxSteps: expect.any(Number),
          timeout: expect.any(Number),
        }),
        tools: expect.objectContaining({
          globalTimeout: expect.any(Number),
        }),
      });
    });

    it('should validate persistence project path when enabled', async () => {
      const cliOptions: CLIOptions = {};
      const configWithPersistence: Configuration = {
        agent: {
          conversationPersistence: {
            enabled: true,
            projectPath: '/valid/path',
          },
        },
      };

      vi.mocked(getDefaultConfiguration).mockReturnValue({});
      vi.mocked(getConfigFilePaths).mockReturnValue([]);
      vi.mocked(expandConfigEnvironmentVariables).mockReturnValue({});
      vi.mocked(applyCLIOverrides).mockReturnValue(configWithPersistence);
      vi.mocked(access).mockResolvedValue(undefined); // Path exists

      const result = await createRuntimeConfiguration(cliOptions);

      expect(access).toHaveBeenCalledWith('/valid/path');
      expect(result.config.agent?.conversationPersistence?.enabled).toBe(true);
    });

    it('should throw error for invalid persistence project path', async () => {
      const cliOptions: CLIOptions = {};
      const configWithPersistence: Configuration = {
        agent: {
          conversationPersistence: {
            enabled: true,
            projectPath: '/invalid/path',
          },
        },
      };

      vi.mocked(getDefaultConfiguration).mockReturnValue({});
      vi.mocked(getConfigFilePaths).mockReturnValue([]);
      vi.mocked(expandConfigEnvironmentVariables).mockReturnValue({});
      vi.mocked(applyCLIOverrides).mockReturnValue(configWithPersistence);
      vi.mocked(access).mockRejectedValue(new Error('Path does not exist'));

      await expect(createRuntimeConfiguration(cliOptions)).rejects.toThrow(
        'Persistence project path does not exist: /invalid/path'
      );
    });
  });

  describe('loadSystemPromptContent', () => {
    it('should return null when no system prompt config provided', async () => {
      const result = await loadSystemPromptContent();
      expect(result).toBe(null);
    });

    it('should load content from file when value is file path', async () => {
      vi.mocked(isFilePath).mockReturnValue(true);
      vi.mocked(loadSystemPromptFile).mockResolvedValue('File content');

      const result = await loadSystemPromptContent({
        mode: 'replace',
        value: '/path/to/prompt.txt',
      });

      expect(isFilePath).toHaveBeenCalledWith('/path/to/prompt.txt');
      expect(loadSystemPromptFile).toHaveBeenCalledWith('/path/to/prompt.txt');
      expect(result).toBe('File content');
    });

    it('should return value as direct content when not file path', async () => {
      vi.mocked(isFilePath).mockReturnValue(false);

      const result = await loadSystemPromptContent({
        mode: 'append',
        value: 'Direct prompt content',
      });

      expect(isFilePath).toHaveBeenCalledWith('Direct prompt content');
      expect(loadSystemPromptFile).not.toHaveBeenCalled();
      expect(result).toBe('Direct prompt content');
    });

    it('should propagate errors from file loading', async () => {
      vi.mocked(isFilePath).mockReturnValue(true);
      vi.mocked(loadSystemPromptFile).mockRejectedValue(
        new Error('File not found')
      );

      await expect(
        loadSystemPromptContent({
          mode: 'replace',
          value: '/nonexistent/prompt.txt',
        })
      ).rejects.toThrow('File not found');
    });
  });

  describe('getProviderFromConfig', () => {
    it('should return default provider configuration', () => {
      const config: Configuration = {
        providers: {
          default: 'anthropic',
          anthropic: {
            model: 'claude-3',
            apiKey: 'sk-test',
            baseURL: 'https://api.anthropic.com',
          },
        },
      };

      const result = getProviderFromConfig(config);

      expect(result).toEqual({
        provider: 'anthropic',
        model: 'claude-3',
        apiKey: 'sk-test',
        baseURL: 'https://api.anthropic.com',
      });
    });

    it('should handle missing providers configuration', () => {
      const config: Configuration = {};

      const result = getProviderFromConfig(config);

      expect(result).toEqual({
        provider: 'openrouter',
        model: undefined,
        apiKey: undefined,
        baseURL: undefined,
      });
    });

    it('should handle non-object provider configuration', () => {
      const config: Configuration = {
        providers: {
          default: 'openai',
        },
      };

      const result = getProviderFromConfig(config);

      expect(result).toEqual({
        provider: 'openai',
        model: undefined,
        apiKey: undefined,
        baseURL: undefined,
      });
    });
  });

  describe('getAgentConfigFromConfig', () => {
    it('should return agent configuration with defaults', () => {
      const config: Configuration = {
        agent: {
          maxSteps: 75,
          timeout: 60000,
          logLevel: 'INFO',
          logProgress: 'tool',
        },
      };

      const result = getAgentConfigFromConfig(config);

      expect(result).toEqual({
        maxSteps: 75,
        timeout: 60000,
        logLevel: 'INFO',
        logProgress: 'tool',
      });
    });

    it('should return defaults when no agent configuration', () => {
      const config: Configuration = {};

      const result = getAgentConfigFromConfig(config);

      expect(result).toEqual({
        maxSteps: 100, // MAX_STEPS default
        timeout: 1200000, // GENERATION_TIMEOUT_MS default
        logLevel: 'SILENT',
        logProgress: 'none',
      });
    });

    it('should handle partial agent configuration', () => {
      const config: Configuration = {
        agent: {
          maxSteps: 25,
          // Other fields should get defaults
        },
      };

      const result = getAgentConfigFromConfig(config);

      expect(result).toEqual({
        maxSteps: 25,
        timeout: 1200000, // Default
        logLevel: 'SILENT', // Default
        logProgress: 'none', // Default
      });
    });
  });
});
