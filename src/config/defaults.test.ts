/**
 * Tests for defaults.ts module
 * Tests the default configuration factory function
 */

import { describe, it, expect } from 'vitest';
import { getDefaultConfiguration } from './defaults.js';
import type { Configuration } from './types.js';

describe('defaults', () => {
  describe('getDefaultConfiguration', () => {
    it('should return a valid configuration object', () => {
      const config = getDefaultConfiguration();

      expect(config).toBeDefined();
      expect(config).toEqual(
        expect.objectContaining({
          mcpServers: expect.any(Object),
          providers: expect.any(Object),
          agent: expect.any(Object),
          tools: expect.any(Object),
        })
      );
    });

    it('should have correct default provider configuration', () => {
      const config = getDefaultConfiguration();

      expect(config.providers).toBeDefined();
      expect(config.providers?.default).toBe('anthropic');
      expect(config.providers?.openrouter).toEqual({
        model: 'google/gemini-2.5-flash-preview-05-20',
      });
      expect(config.providers?.openai).toEqual({
        model: 'gpt-4.1',
      });
      expect(config.providers?.anthropic).toEqual({
        model: 'claude-sonnet-4-5-20250929',
        authType: 'x-api-key',
      });
      expect(config.providers?.google).toEqual({
        model: 'gemini-2.5-pro',
        authType: 'api-key',
      });
    });

    it('should have correct default agent configuration', () => {
      const config = getDefaultConfiguration();

      expect(config.agent).toBeDefined();
      expect(config.agent?.maxSteps).toBe(100); // MAX_STEPS constant
      expect(config.agent?.timeout).toBe(1200000); // GENERATION_TIMEOUT_MS constant
      expect(config.agent?.logLevel).toBe('SILENT');
      expect(config.agent?.logProgress).toBe('none');
      expect(config.agent?.streaming).toBe(true);
      expect(config.agent?.conversationPersistence).toEqual({
        enabled: true,
        projectPath: process.cwd(),
      });
    });

    it('should have correct default tools configuration', () => {
      const config = getDefaultConfiguration();

      expect(config.tools).toBeDefined();
      expect(config.tools?.globalTimeout).toBe(1800000); // TOOL_TIMEOUT_MS constant
    });

    it('should convert MCP_SERVERS to enhanced format', () => {
      const config = getDefaultConfiguration();

      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers).toEqual(expect.any(Object));

      // Check that servers have been converted to enhanced format
      const serverNames = Object.keys(config.mcpServers || {});
      expect(serverNames.length).toBeGreaterThan(0);

      // Each server should have name and other properties
      for (const serverName of serverNames) {
        const server = config.mcpServers![serverName];
        expect(server).toEqual(
          expect.objectContaining({
            name: serverName,
          })
        );
        // Description may be undefined for some servers
        if (server.description !== undefined) {
          expect(server.description).toEqual(expect.any(String));
        }
      }
    });

    it('should return a different object instance on each call', () => {
      const config1 = getDefaultConfiguration();
      const config2 = getDefaultConfiguration();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should return configuration that matches Configuration type', () => {
      const config = getDefaultConfiguration();

      // Type assertion to ensure it matches Configuration interface
      const typedConfig: Configuration = config;
      expect(typedConfig).toBeDefined();
    });
  });
});
