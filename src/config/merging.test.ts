/**
 * Tests for merging.ts module
 * Tests configuration merging functionality
 */

import { describe, it, expect } from 'vitest';
import { mergeConfigurations } from './merging.js';
import type { Configuration } from './types.js';

describe('merging', () => {
  describe('mergeConfigurations', () => {
    it('should merge empty configurations', () => {
      const result = mergeConfigurations([]);
      expect(result).toEqual({});
    });

    it('should return single configuration unchanged', () => {
      const config: Configuration = {
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4' },
        },
      };

      const result = mergeConfigurations([config]);
      expect(result).toEqual(config);
    });

    it('should merge mcpServers configurations', () => {
      const config1: Configuration = {
        mcpServers: {
          server1: {
            type: 'stdio',
            command: 'cmd1',
          },
        },
      };

      const config2: Configuration = {
        mcpServers: {
          server2: {
            type: 'sse',
            url: 'http://example.com',
          },
        },
      };

      const result = mergeConfigurations([config1, config2]);
      expect(result.mcpServers).toEqual({
        server1: {
          type: 'stdio',
          command: 'cmd1',
        },
        server2: {
          type: 'sse',
          url: 'http://example.com',
        },
      });
    });

    it('should merge providers configurations with individual provider merging', () => {
      const config1: Configuration = {
        providers: {
          default: 'openai',
          openai: {
            model: 'gpt-4',
            apiKey: 'key1',
          },
        },
      };

      const config2: Configuration = {
        providers: {
          default: 'anthropic',
          openai: {
            baseURL: 'https://api.openai.com',
          },
          anthropic: {
            model: 'claude-3',
          },
        },
      };

      const result = mergeConfigurations([config1, config2]);
      expect(result.providers).toEqual({
        default: 'anthropic',
        openai: {
          model: 'gpt-4',
          apiKey: 'key1',
          baseURL: 'https://api.openai.com',
        },
        anthropic: {
          model: 'claude-3',
        },
      });
    });

    it('should merge agent configurations', () => {
      const config1: Configuration = {
        agent: {
          maxSteps: 50,
          timeout: 30000,
        },
      };

      const config2: Configuration = {
        agent: {
          maxSteps: 100,
          logLevel: 'DEBUG',
        },
      };

      const result = mergeConfigurations([config1, config2]);
      expect(result.agent).toEqual({
        maxSteps: 100,
        timeout: 30000,
        logLevel: 'DEBUG',
      });
    });

    it('should merge tools configurations', () => {
      const config1: Configuration = {
        tools: {
          globalTimeout: 60000,
        },
      };

      const config2: Configuration = {
        tools: {
          globalTimeout: 120000,
          disabledInternalTools: ['tool1'],
        },
      };

      const result = mergeConfigurations([config1, config2]);
      expect(result.tools).toEqual({
        globalTimeout: 120000,
        disabledInternalTools: ['tool1'],
      });
    });

    it('should handle multiple configurations in precedence order', () => {
      const config1: Configuration = {
        providers: {
          default: 'openai',
          openai: { model: 'gpt-3.5' },
        },
      };

      const config2: Configuration = {
        providers: {
          default: 'anthropic',
          openai: { model: 'gpt-4' },
        },
      };

      const config3: Configuration = {
        providers: {
          default: 'google',
          openai: { apiKey: 'key123' },
        },
      };

      const result = mergeConfigurations([config1, config2, config3]);
      expect(result.providers).toEqual({
        default: 'google',
        openai: {
          model: 'gpt-4',
          apiKey: 'key123',
        },
      });
    });

    it('should merge complex nested configurations', () => {
      const config1: Configuration = {
        mcpServers: {
          server1: { type: 'stdio', command: 'cmd1' },
        },
        providers: {
          default: 'openai',
          openai: { model: 'gpt-4' },
        },
        agent: {
          maxSteps: 50,
          conversationPersistence: {
            enabled: true,
            projectPath: '/path1',
          },
        },
      };

      const config2: Configuration = {
        mcpServers: {
          server2: { type: 'sse', url: 'http://example.com' },
        },
        providers: {
          default: 'anthropic',
          openai: { apiKey: 'key123' },
          anthropic: { model: 'claude-3' },
        },
        agent: {
          maxSteps: 100,
          logLevel: 'DEBUG',
          conversationPersistence: {
            enabled: false,
          },
        },
        tools: {
          globalTimeout: 60000,
        },
      };

      const result = mergeConfigurations([config1, config2]);
      expect(result).toEqual({
        mcpServers: {
          server1: { type: 'stdio', command: 'cmd1' },
          server2: { type: 'sse', url: 'http://example.com' },
        },
        providers: {
          default: 'anthropic',
          openai: {
            model: 'gpt-4',
            apiKey: 'key123',
          },
          anthropic: {
            model: 'claude-3',
          },
        },
        agent: {
          maxSteps: 100,
          logLevel: 'DEBUG',
          conversationPersistence: {
            enabled: false,
            projectPath: '/path1',
          },
        },
        tools: {
          globalTimeout: 60000,
        },
      });
    });

    it('should handle missing sections in configurations', () => {
      const config1: Configuration = {
        providers: {
          default: 'openai',
        },
      };

      const config2: Configuration = {
        agent: {
          maxSteps: 100,
        },
      };

      const config3: Configuration = {
        tools: {
          globalTimeout: 60000,
        },
      };

      const result = mergeConfigurations([config1, config2, config3]);
      expect(result).toEqual({
        providers: {
          default: 'openai',
        },
        agent: {
          maxSteps: 100,
        },
        tools: {
          globalTimeout: 60000,
        },
      });
    });

    it('should handle overriding mcpServers with later configurations', () => {
      const config1: Configuration = {
        mcpServers: {
          server1: {
            type: 'stdio',
            command: 'old-command',
          },
        },
      };

      const config2: Configuration = {
        mcpServers: {
          server1: {
            type: 'stdio',
            command: 'new-command',
            args: ['--verbose'],
          },
        },
      };

      const result = mergeConfigurations([config1, config2]);
      expect(result.mcpServers).toEqual({
        server1: {
          type: 'stdio',
          command: 'new-command',
          args: ['--verbose'],
        },
      });
    });

    it('should handle provider configurations with non-object values', () => {
      const config1: Configuration = {
        providers: {
          default: 'openai',
          openai: {
            model: 'gpt-4',
          },
        },
      };

      const config2: Configuration = {
        providers: {
          default: 'anthropic',
        },
      };

      const result = mergeConfigurations([config1, config2]);
      expect(result.providers).toEqual({
        default: 'anthropic',
        openai: {
          model: 'gpt-4',
        },
      });
    });

    it('should preserve existing provider configurations when new provider is not object', () => {
      const config1: Configuration = {
        providers: {
          default: 'openai',
          openai: {
            model: 'gpt-4',
            apiKey: 'key1',
          },
        },
      };

      const config2: Configuration = {
        providers: {
          openai: 'invalid-config' as unknown as object,
        },
      };

      const result = mergeConfigurations([config1, config2]);
      expect(result.providers?.openai).toEqual({
        model: 'gpt-4',
        apiKey: 'key1',
      });
    });

    it('should return new object instance', () => {
      const config: Configuration = {
        providers: {
          default: 'openai',
        },
      };

      const result = mergeConfigurations([config]);
      expect(result).not.toBe(config);
      expect(result).toEqual(config);
    });
  });
});
