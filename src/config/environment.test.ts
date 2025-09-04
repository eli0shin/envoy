/**
 * Tests for environment.ts module
 * Tests environment variable expansion functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  expandEnvironmentVariables,
  expandConfigEnvironmentVariables,
} from './environment.js';
import type { Configuration } from './types.js';

describe('environment', () => {
  // Store original env vars to restore later
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear test environment variables
    delete process.env.TEST_VAR;
    delete process.env.TEST_API_KEY;
    delete process.env.TEST_MISSING;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('expandEnvironmentVariables', () => {
    it('should expand existing environment variables', () => {
      process.env.TEST_VAR = 'test-value';

      const result = expandEnvironmentVariables('${TEST_VAR}');
      expect(result).toBe('test-value');
    });

    it('should expand multiple environment variables in same string', () => {
      process.env.TEST_VAR1 = 'hello';
      process.env.TEST_VAR2 = 'world';

      const result = expandEnvironmentVariables('${TEST_VAR1} ${TEST_VAR2}');
      expect(result).toBe('hello world');
    });

    it('should expand environment variables within text', () => {
      process.env.TEST_VAR = 'test';

      const result = expandEnvironmentVariables('prefix-${TEST_VAR}-suffix');
      expect(result).toBe('prefix-test-suffix');
    });

    it('should preserve placeholder for missing environment variables', () => {
      const result = expandEnvironmentVariables('${MISSING_VAR}');
      expect(result).toBe('${MISSING_VAR}');
    });

    it('should handle mixed existing and missing variables', () => {
      process.env.TEST_VAR = 'exists';

      const result = expandEnvironmentVariables('${TEST_VAR}-${MISSING_VAR}');
      expect(result).toBe('exists-${MISSING_VAR}');
    });

    it('should handle strings without environment variables', () => {
      const result = expandEnvironmentVariables('no variables here');
      expect(result).toBe('no variables here');
    });

    it('should handle empty string', () => {
      const result = expandEnvironmentVariables('');
      expect(result).toBe('');
    });

    it('should handle malformed variable syntax', () => {
      const result = expandEnvironmentVariables('${');
      expect(result).toBe('${');
    });

    it('should handle nested braces', () => {
      process.env.TEST_VAR = 'value';

      const result = expandEnvironmentVariables('${TEST_VAR}${TEST_VAR}');
      expect(result).toBe('valuevalue');
    });

    it('should handle environment variables with empty values', () => {
      process.env.TEST_VAR = '';

      const result = expandEnvironmentVariables('${TEST_VAR}');
      expect(result).toBe('');
    });
  });

  describe('expandConfigEnvironmentVariables', () => {
    it('should expand environment variables in string values', () => {
      process.env.TEST_API_KEY = 'secret-key';

      const config: Configuration = {
        providers: {
          openai: {
            apiKey: '${TEST_API_KEY}',
          },
        },
      };

      const result = expandConfigEnvironmentVariables(config);
      expect(result.providers?.openai?.apiKey).toBe('secret-key');
    });

    it('should expand environment variables in nested objects', () => {
      process.env.TEST_VAR = 'test-value';

      const config: Configuration = {
        agent: {
          systemPrompt: {
            mode: 'replace',
            value: '${TEST_VAR}',
          },
        },
      };

      const result = expandConfigEnvironmentVariables(config);
      expect(result.agent?.systemPrompt?.value).toBe('test-value');
    });

    it('should expand environment variables in arrays', () => {
      process.env.TEST_ARG = 'test-arg';

      const config: Configuration = {
        mcpServers: {
          testServer: {
            type: 'stdio',
            command: 'npm',
            args: ['run', '${TEST_ARG}'],
          },
        },
      };

      const result = expandConfigEnvironmentVariables(config);
      const testServer = result.mcpServers?.testServer;
      if (testServer && 'args' in testServer) {
        expect(testServer.args).toEqual(['run', 'test-arg']);
      }
    });

    it('should preserve non-string values', () => {
      const config: Configuration = {
        agent: {
          maxSteps: 50,
          streaming: true,
        },
      };

      const result = expandConfigEnvironmentVariables(config);
      expect(result.agent?.maxSteps).toBe(50);
      expect(result.agent?.streaming).toBe(true);
    });

    it('should handle null values', () => {
      const config: Configuration = {
        providers: {
          openai: {
            apiKey: null as unknown as string,
          },
        },
      };

      const result = expandConfigEnvironmentVariables(config);
      expect(result.providers?.openai?.apiKey).toBe(null);
    });

    it('should preserve missing environment variables', () => {
      const config: Configuration = {
        providers: {
          openai: {
            apiKey: '${MISSING_API_KEY}',
          },
        },
      };

      const result = expandConfigEnvironmentVariables(config);
      expect(result.providers?.openai?.apiKey).toBe('${MISSING_API_KEY}');
    });

    it('should handle empty configuration', () => {
      const config: Configuration = {};

      const result = expandConfigEnvironmentVariables(config);
      expect(result).toEqual({});
    });

    it('should return new object instance', () => {
      const config: Configuration = {
        providers: {
          openai: {
            model: 'gpt-4',
          },
        },
      };

      const result = expandConfigEnvironmentVariables(config);
      expect(result).not.toBe(config);
      expect(result).toEqual(config);
    });

    it('should handle complex nested structures', () => {
      process.env.TEST_VAR1 = 'value1';
      process.env.TEST_VAR2 = 'value2';

      const config: Configuration = {
        providers: {
          openai: {
            apiKey: '${TEST_VAR1}',
            baseURL: 'https://api.openai.com/${TEST_VAR2}',
          },
        },
        agent: {
          systemPrompt: {
            mode: 'replace',
            value:
              'You are ${TEST_VAR1} assistant with ${TEST_VAR2} capabilities',
          },
        },
      };

      const result = expandConfigEnvironmentVariables(config);
      expect(result.providers?.openai?.apiKey).toBe('value1');
      expect(result.providers?.openai?.baseURL).toBe(
        'https://api.openai.com/value2'
      );
      expect(result.agent?.systemPrompt?.value).toBe(
        'You are value1 assistant with value2 capabilities'
      );
    });
  });
});
