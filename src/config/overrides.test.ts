/**
 * Tests for overrides.ts module
 * Tests CLI override application functionality
 */

import { describe, it, expect } from 'vitest';
import { applyCLIOverrides } from './overrides.js';
import type { Configuration } from './types.js';

describe('overrides', () => {
  describe('applyCLIOverrides', () => {
    it('should return configuration unchanged when no overrides provided', () => {
      const config: Configuration = {
        providers: {
          default: 'anthropic',
          anthropic: { model: 'claude-3' },
        },
        agent: {
          maxSteps: 50,
          logLevel: 'INFO',
        },
      };

      const result = applyCLIOverrides(config, {});
      expect(result).toEqual(config);
      expect(result).not.toBe(config); // Should return new object
    });

    it('should override provider', () => {
      const config: Configuration = {
        providers: {
          default: 'anthropic',
          anthropic: { model: 'claude-3' },
          openai: { model: 'gpt-4' },
        },
      };

      const result = applyCLIOverrides(config, { provider: 'openai' });
      expect(result.providers?.default).toBe('openai');
    });

    it('should override model for default provider', () => {
      const config: Configuration = {
        providers: {
          default: 'anthropic',
          anthropic: { model: 'claude-3' },
          openai: { model: 'gpt-4' },
        },
      };

      const result = applyCLIOverrides(config, { model: 'claude-3.5' });
      expect(result.providers?.anthropic?.model).toBe('claude-3.5');
    });

    it('should override model for provider specified in overrides', () => {
      const config: Configuration = {
        providers: {
          default: 'anthropic',
          anthropic: { model: 'claude-3' },
          openai: { model: 'gpt-4' },
        },
      };

      const result = applyCLIOverrides(config, {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
      });
      expect(result.providers?.default).toBe('openai');
      expect(result.providers?.openai?.model).toBe('gpt-3.5-turbo');
    });

    it('should override logLevel', () => {
      const config: Configuration = {
        agent: {
          logLevel: 'INFO',
        },
      };

      const result = applyCLIOverrides(config, { logLevel: 'DEBUG' });
      expect(result.agent?.logLevel).toBe('DEBUG');
    });

    it('should override logProgress', () => {
      const config: Configuration = {
        agent: {
          logProgress: 'none',
        },
      };

      const result = applyCLIOverrides(config, { logProgress: 'all' });
      expect(result.agent?.logProgress).toBe('all');
    });

    it('should override maxSteps', () => {
      const config: Configuration = {
        agent: {
          maxSteps: 100,
        },
      };

      const result = applyCLIOverrides(config, { maxSteps: 50 });
      expect(result.agent?.maxSteps).toBe(50);
    });

    it('should handle systemPrompt override', () => {
      const config: Configuration = {};

      const result = applyCLIOverrides(config, {
        systemPrompt: 'You are a helpful assistant',
      });
      expect(result.agent?.systemPrompt).toEqual({
        mode: 'replace',
        value: 'You are a helpful assistant',
      });
    });

    it('should handle systemPromptFile override', () => {
      const config: Configuration = {};

      const result = applyCLIOverrides(config, {
        systemPromptFile: '/path/to/prompt.txt',
      });
      expect(result.agent?.systemPrompt).toEqual({
        mode: 'replace',
        value: '/path/to/prompt.txt',
      });
    });

    it('should handle systemPrompt with custom mode', () => {
      const config: Configuration = {};

      const result = applyCLIOverrides(config, {
        systemPrompt: 'Additional instructions',
        systemPromptMode: 'append',
      });
      expect(result.agent?.systemPrompt).toEqual({
        mode: 'append',
        value: 'Additional instructions',
      });
    });

    it('should prefer systemPromptFile over systemPrompt', () => {
      const config: Configuration = {};

      const result = applyCLIOverrides(config, {
        systemPrompt: 'Direct content',
        systemPromptFile: '/path/to/file.txt',
        systemPromptMode: 'prepend',
      });
      expect(result.agent?.systemPrompt).toEqual({
        mode: 'prepend',
        value: '/path/to/file.txt',
      });
    });

    it('should enable conversation persistence', () => {
      const config: Configuration = {
        agent: {
          conversationPersistence: {
            enabled: false,
            projectPath: '/default/path',
          },
        },
      };

      const result = applyCLIOverrides(config, { enablePersistence: true });
      expect(result.agent?.conversationPersistence?.enabled).toBe(true);
      expect(result.agent?.conversationPersistence?.projectPath).toBe(
        '/default/path'
      );
    });

    it('should disable conversation persistence', () => {
      const config: Configuration = {
        agent: {
          conversationPersistence: {
            enabled: true,
            projectPath: '/default/path',
          },
        },
      };

      const result = applyCLIOverrides(config, { disablePersistence: true });
      expect(result.agent?.conversationPersistence?.enabled).toBe(false);
      expect(result.agent?.conversationPersistence?.projectPath).toBe(
        '/default/path'
      );
    });

    it('should set persistence project path', () => {
      const config: Configuration = {
        agent: {
          conversationPersistence: {
            enabled: false,
            projectPath: '/default/path',
          },
        },
      };

      const result = applyCLIOverrides(config, {
        persistenceProjectPath: '/custom/path',
      });
      expect(result.agent?.conversationPersistence?.projectPath).toBe(
        '/custom/path'
      );
    });

    it('should auto-enable persistence when project path is provided', () => {
      const config: Configuration = {
        agent: {
          conversationPersistence: {
            enabled: false,
            projectPath: '/default/path',
          },
        },
      };

      const result = applyCLIOverrides(config, {
        persistenceProjectPath: '/custom/path',
      });
      expect(result.agent?.conversationPersistence?.enabled).toBe(true);
      expect(result.agent?.conversationPersistence?.projectPath).toBe(
        '/custom/path'
      );
    });

    it('should not auto-enable persistence when explicitly disabled', () => {
      const config: Configuration = {
        agent: {
          conversationPersistence: {
            enabled: false,
            projectPath: '/default/path',
          },
        },
      };

      const result = applyCLIOverrides(config, {
        persistenceProjectPath: '/custom/path',
        disablePersistence: true,
      });
      expect(result.agent?.conversationPersistence?.enabled).toBe(false);
      expect(result.agent?.conversationPersistence?.projectPath).toBe(
        '/custom/path'
      );
    });

    it('should prioritize disablePersistence over enablePersistence', () => {
      const config: Configuration = {
        agent: {
          conversationPersistence: {
            enabled: true,
            projectPath: '/default/path',
          },
        },
      };

      const result = applyCLIOverrides(config, {
        enablePersistence: true,
        disablePersistence: true,
      });
      expect(result.agent?.conversationPersistence?.enabled).toBe(false);
    });

    it('should handle missing agent configuration', () => {
      const config: Configuration = {};

      const result = applyCLIOverrides(config, {
        logLevel: 'DEBUG',
        maxSteps: 25,
      });
      expect(result.agent?.logLevel).toBe('DEBUG');
      expect(result.agent?.maxSteps).toBe(25);
    });

    it('should handle missing providers configuration', () => {
      const config: Configuration = {};

      const result = applyCLIOverrides(config, {
        provider: 'openai',
        model: 'gpt-4',
      });
      expect(result.providers?.default).toBe('openai');
      expect(result.providers?.openai?.model).toBe('gpt-4');
    });

    it('should handle missing conversationPersistence configuration', () => {
      const config: Configuration = {};

      const result = applyCLIOverrides(config, {
        enablePersistence: true,
        persistenceProjectPath: '/custom/path',
      });
      expect(result.agent?.conversationPersistence?.enabled).toBe(true);
      expect(result.agent?.conversationPersistence?.projectPath).toBe(
        '/custom/path'
      );
    });

    it('should handle model override when provider config is not object', () => {
      const config: Configuration = {
        providers: {
          default: 'openrouter',
        },
      };

      const result = applyCLIOverrides(config, { model: 'new-model' });
      expect(result.providers?.openrouter?.model).toBe('new-model');
    });

    it('should handle multiple overrides together', () => {
      const config: Configuration = {
        providers: {
          default: 'anthropic',
          anthropic: { model: 'claude-3' },
        },
        agent: {
          maxSteps: 100,
          logLevel: 'INFO',
          conversationPersistence: {
            enabled: false,
            projectPath: '/default',
          },
        },
      };

      const result = applyCLIOverrides(config, {
        provider: 'openai',
        model: 'gpt-4',
        logLevel: 'DEBUG',
        logProgress: 'all',
        maxSteps: 50,
        systemPrompt: 'You are helpful',
        enablePersistence: true,
        persistenceProjectPath: '/custom',
      });

      expect(result.providers?.default).toBe('openai');
      expect(result.providers?.openai?.model).toBe('gpt-4');
      expect(result.agent?.logLevel).toBe('DEBUG');
      expect(result.agent?.logProgress).toBe('all');
      expect(result.agent?.maxSteps).toBe(50);
      expect(result.agent?.systemPrompt).toEqual({
        mode: 'replace',
        value: 'You are helpful',
      });
      expect(result.agent?.conversationPersistence?.enabled).toBe(true);
      expect(result.agent?.conversationPersistence?.projectPath).toBe(
        '/custom'
      );
    });

    it('should not modify original configuration', () => {
      const config: Configuration = {
        providers: {
          default: 'anthropic',
          anthropic: { model: 'claude-3' },
        },
        agent: {
          maxSteps: 100,
        },
      };

      const original = JSON.parse(JSON.stringify(config));
      applyCLIOverrides(config, { provider: 'openai', maxSteps: 50 });

      expect(config).toEqual(original);
    });
  });
});
