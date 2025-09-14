/**
 * Tests for interactiveMode.ts module
 * Tests interactive mode detection functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { shouldActivateInteractiveMode } from './interactiveMode.js';
import type { CLIOptions } from '../../types/index.js';
import type { RuntimeConfiguration } from '../../config/types.js';

describe('interactiveMode', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment variables
    delete process.env.NODE_ENV;
    delete process.env.VITEST;
    delete process.env.ENABLE_INTERACTIVE_E2E_TESTING;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('shouldActivateInteractiveMode', () => {
    it('should return true when no message and no special options are provided', () => {
      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(true);
    });

    it('should return false when message is provided', () => {
      const config: RuntimeConfiguration = {
        message: 'Hello world',
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return false when stdin is true', () => {
      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: true,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: true,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return false when listPrompts is true', () => {
      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: true,
        listResources: false,

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return false when listResources is true', () => {
      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: true,

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return false when prompt is provided', () => {
      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,
        prompt: 'analyze-code',

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return false when interactivePrompt is true', () => {
      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,

        interactivePrompt: true,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return false when resources are specified', () => {
      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,
        resources: 'file:///path/to/file.md',

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return false when autoResources is true', () => {
      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,
        autoResources: true,

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return false when listSessions is true', () => {
      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,

        interactivePrompt: false,

        listSessions: true,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return false in test environment by default', () => {
      process.env.NODE_ENV = 'test';

      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return false in vitest environment by default', () => {
      process.env.VITEST = 'true';

      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });

    it('should return true in test environment when E2E testing is enabled', () => {
      process.env.NODE_ENV = 'test';
      process.env.ENABLE_INTERACTIVE_E2E_TESTING = 'true';

      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(true);
    });

    it('should return true in vitest environment when E2E testing is enabled', () => {
      process.env.VITEST = 'true';
      process.env.ENABLE_INTERACTIVE_E2E_TESTING = 'true';

      const config: RuntimeConfiguration = {
        message: undefined,
        stdin: false,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,

        interactivePrompt: false,

        listSessions: false,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(true);
    });

    it('should handle multiple conditions combined', () => {
      const config: RuntimeConfiguration = {
        message: 'Hello',
        stdin: true,
        json: false,
        providers: {
          default: 'anthropic',
          openai: {},
          openrouter: {},
          anthropic: {},
          google: {},
        },
        agent: {
          maxSteps: 100,
          timeout: 30000,
          logLevel: 'INFO',
          logProgress: 'none',
          streaming: true,
        },
        tools: {
          globalTimeout: 60000,
          disabledInternalTools: [],
        },
      };

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: true,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: true,
        listResources: true,

        interactivePrompt: true,

        listSessions: true,
      };

      const result = shouldActivateInteractiveMode(config, options);
      expect(result).toBe(false);
    });
  });
});
