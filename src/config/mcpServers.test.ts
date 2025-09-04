/**
 * Tests for mcpServers.ts module
 * Tests MCP server configuration utilities
 */

import { describe, it, expect, vi } from 'vitest';
import {
  inferMCPServerType,
  convertToLegacyMCPServers,
  getMCPServersFromConfig,
} from './mcpServers.js';
import type {
  Configuration,
  EnhancedMCPServerConfig,
  RuntimeConfiguration,
} from './types.js';

// Mock createMCPServersWithConfig function
vi.mock('../constants.js', () => ({
  createMCPServersWithConfig: vi.fn(() => [
    {
      name: 'agent-spawner',
      type: 'stdio',
      command: 'node',
      args: ['dist/agentSpawnerServer.js'],
      description: 'Dynamic agent spawning server',
    },
  ]),
}));

describe('mcpServers', () => {
  describe('inferMCPServerType', () => {
    it('should return config unchanged when type is already specified', () => {
      const config = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        name: 'filesystem',
      };

      const result = inferMCPServerType(config);
      expect(result).toEqual(config);
    });

    it('should infer stdio type from command presence', () => {
      const config = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      };

      const result = inferMCPServerType(config);
      expect(result).toEqual({
        ...config,
        type: 'stdio',
      });
    });

    it('should infer sse type from url presence', () => {
      const config = {
        url: 'https://example.com/mcp',
        headers: { Authorization: 'Bearer token' },
      };

      const result = inferMCPServerType(config);
      expect(result).toEqual({
        ...config,
        type: 'sse',
      });
    });

    it('should throw error for invalid config type', () => {
      expect(() => inferMCPServerType(null)).toThrow(
        'Invalid MCP server configuration: expected object'
      );
      expect(() => inferMCPServerType('invalid')).toThrow(
        'Invalid MCP server configuration: expected object'
      );
      expect(() => inferMCPServerType(123)).toThrow(
        'Invalid MCP server configuration: expected object'
      );
    });

    it('should throw error when neither command nor url is present', () => {
      const config = {
        description: 'Invalid server',
      };

      expect(() => inferMCPServerType(config)).toThrow(
        'Invalid MCP server configuration: missing type, command, or url'
      );
    });

    it('should handle empty object', () => {
      expect(() => inferMCPServerType({})).toThrow(
        'Invalid MCP server configuration: missing type, command, or url'
      );
    });

    it('should prefer explicit type over inference', () => {
      const config = {
        type: 'sse',
        command: 'npx', // This would normally infer stdio
        url: 'https://example.com',
      };

      const result = inferMCPServerType(config);
      expect(result.type).toBe('sse');
    });
  });

  describe('convertToLegacyMCPServers', () => {
    it('should convert stdio server to legacy format', () => {
      const servers: Record<string, EnhancedMCPServerConfig> = {
        filesystem: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          env: { NODE_ENV: 'production' },
          cwd: '/custom/dir',
          timeout: 5000,
          initTimeout: 10000,
          disabledTools: ['dangerous-tool'],
          autoApprove: ['safe-tool'],
        },
      };

      const result = convertToLegacyMCPServers(servers);
      expect(result).toEqual([
        {
          name: 'filesystem',
          description: undefined, // No description provided in enhanced config
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          env: { NODE_ENV: 'production' },
          cwd: '/custom/dir',
          timeout: 5000,
          initTimeout: 10000,
          disabledTools: ['dangerous-tool'],
          autoApprove: ['safe-tool'],
        },
      ]);
    });

    it('should convert sse server to legacy format', () => {
      const servers: Record<string, EnhancedMCPServerConfig> = {
        remote: {
          type: 'sse',
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer token' },
          timeout: 30000,
          disabledTools: ['unsafe-tool'],
          autoApprove: ['read-tool'],
        },
      };

      const result = convertToLegacyMCPServers(servers);
      expect(result).toEqual([
        {
          name: 'remote',
          description: undefined,
          type: 'sse',
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer token' },
          timeout: 30000,
          disabledTools: ['unsafe-tool'],
          autoApprove: ['read-tool'],
        },
      ]);
    });

    it('should skip disabled servers', () => {
      const servers: Record<string, EnhancedMCPServerConfig> = {
        enabled: {
          type: 'stdio',
          command: 'npx',
          description: 'Enabled server',
        },
        disabled: {
          type: 'stdio',
          command: 'npx',
          description: 'Disabled server',
          disabled: true,
        },
      };

      const result = convertToLegacyMCPServers(servers);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('enabled');
    });

    it('should handle empty servers object', () => {
      const result = convertToLegacyMCPServers({});
      expect(result).toEqual([]);
    });

    it('should handle mixed server types', () => {
      const servers: Record<string, EnhancedMCPServerConfig> = {
        stdio_server: {
          type: 'stdio',
          command: 'npm',
          args: ['run', 'server'],
          description: 'Stdio server',
        },
        sse_server: {
          type: 'sse',
          url: 'https://api.example.com',
          description: 'SSE server',
        },
      };

      const result = convertToLegacyMCPServers(servers);
      expect(result).toHaveLength(2);

      const stdioServer = result.find(s => s.name === 'stdio_server');
      const sseServer = result.find(s => s.name === 'sse_server');

      expect(stdioServer?.type).toBe('stdio');
      if (stdioServer?.type === 'stdio') {
        expect(stdioServer.command).toBe('npm');
      }
      expect(sseServer?.type).toBe('sse');
      if (sseServer?.type === 'sse') {
        expect(sseServer.url).toBe('https://api.example.com');
      }
    });

    it('should handle servers with minimal configuration', () => {
      const servers: Record<string, EnhancedMCPServerConfig> = {
        minimal: {
          type: 'stdio',
          command: 'echo',
        },
      };

      const result = convertToLegacyMCPServers(servers);
      expect(result).toEqual([
        {
          name: 'minimal',
          description: undefined,
          type: 'stdio',
          command: 'echo',
          args: undefined,
          env: undefined,
          cwd: undefined,
          timeout: undefined,
          initTimeout: undefined,
          disabledTools: undefined,
          autoApprove: undefined,
        },
      ]);
    });
  });

  describe('getMCPServersFromConfig', () => {
    it('should return legacy servers for regular Configuration', () => {
      const config: Configuration = {
        mcpServers: {
          filesystem: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            description: 'File system server',
          },
        },
      };

      const result = getMCPServersFromConfig(config);
      expect(result).toEqual([
        {
          name: 'filesystem',
          description: 'File system server',
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          env: undefined,
          cwd: undefined,
          timeout: undefined,
          initTimeout: undefined,
          disabledTools: undefined,
          autoApprove: undefined,
        },
      ]);
    });

    it('should use createMCPServersWithConfig for RuntimeConfiguration', () => {
      const config: RuntimeConfiguration = {
        mcpServers: {
          filesystem: {
            type: 'stdio',
            command: 'npx',
          },
        },
        // Runtime-specific properties
        json: true,
        stdin: false,
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

      const result = getMCPServersFromConfig(config);
      // Should return result from mocked createMCPServersWithConfig
      expect(result).toEqual([
        {
          name: 'agent-spawner',
          type: 'stdio',
          command: 'node',
          args: ['dist/agentSpawnerServer.js'],
          description: 'Dynamic agent spawning server',
        },
      ]);
    });

    it('should return empty array when no mcpServers in config', () => {
      const config: Configuration = {};
      const result = getMCPServersFromConfig(config);
      expect(result).toEqual([]);
    });

    it('should handle config with empty mcpServers', () => {
      const config: Configuration = {
        mcpServers: {},
      };
      const result = getMCPServersFromConfig(config);
      expect(result).toEqual([]);
    });

    it('should detect RuntimeConfiguration by presence of json property', () => {
      const config: RuntimeConfiguration = {
        json: false,
        mcpServers: {
          test: {
            type: 'stdio',
            command: 'test',
          },
        },
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

      const result = getMCPServersFromConfig(config);
      // Should use createMCPServersWithConfig for runtime config
      expect(result).toEqual([
        {
          name: 'agent-spawner',
          type: 'stdio',
          command: 'node',
          args: ['dist/agentSpawnerServer.js'],
          description: 'Dynamic agent spawning server',
        },
      ]);
    });

    it('should detect RuntimeConfiguration by presence of stdin property', () => {
      const config: RuntimeConfiguration = {
        stdin: true,
        mcpServers: {
          test: {
            type: 'stdio',
            command: 'test',
          },
        },
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

      const result = getMCPServersFromConfig(config);
      // Should use createMCPServersWithConfig for runtime config
      expect(result).toEqual([
        {
          name: 'agent-spawner',
          type: 'stdio',
          command: 'node',
          args: ['dist/agentSpawnerServer.js'],
          description: 'Dynamic agent spawning server',
        },
      ]);
    });
  });
});
