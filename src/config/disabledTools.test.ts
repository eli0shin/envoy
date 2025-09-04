/**
 * Regression test for disabledTools functionality
 *
 * This test verifies that the disabledTools field is properly preserved
 * when converting from user config to MCP server config.
 *
 * Bug History:
 * - Issue: convertToLegacyMCPServers() was dropping disabledTools field
 * - Root Cause: Both config.ts and constants.ts versions missing field preservation
 * - Fix: Updated both functions + type definitions to include all enhanced fields
 *
 * This test prevents regression by ensuring the conversion preserves:
 * - disabledTools
 * - autoApprove
 * - timeout
 * - initTimeout
 */
import { describe, it, expect } from 'vitest';
import { getMCPServersFromConfig } from './index.js';
import type { Configuration } from './types.js';

describe('DisabledTools Regression Tests', () => {
  it('should preserve disabledTools when converting user config to MCP server config', () => {
    // Simulate the exact user config structure that was failing
    const userConfig: Configuration = {
      agent: {
        maxSteps: 500,
        logLevel: 'SILENT',
        logProgress: 'none',
      },
      providers: {
        default: 'anthropic',
        anthropic: {
          authType: 'oauth',
        },
      },
      mcpServers: {
        'brave-search': {
          type: 'stdio',
          command: 'docker',
          args: [
            'run',
            '-i',
            '--rm',
            '-e',
            'BRAVE_API_KEY',
            'mcp/brave-search',
          ],
          env: {
            BRAVE_API_KEY: '${BRAVE_API_KEY}',
          },
          disabledTools: ['brave_local_search'], // This was being dropped!
        },
        fetch: {
          type: 'stdio',
          command: 'uvx',
          args: ['mcp-server-fetch'],
          disabledTools: ['list_prompts', 'get_prompt'],
        },
      },
    };

    // Convert using the same function the app uses
    const mcpServers = getMCPServersFromConfig(userConfig);

    // Find the servers
    const braveSearchServer = mcpServers.find(
      server => server.name === 'brave-search'
    );
    const fetchServer = mcpServers.find(server => server.name === 'fetch');

    expect(braveSearchServer).toBeDefined();
    expect(fetchServer).toBeDefined();

    // Verify disabledTools are preserved (this was failing before the fix)
    expect(braveSearchServer!.disabledTools).toEqual(['brave_local_search']);
    expect(fetchServer!.disabledTools).toEqual(['list_prompts', 'get_prompt']);
  });

  it('should preserve all enhanced fields during config conversion', () => {
    const userConfig: Configuration = {
      mcpServers: {
        'test-server': {
          type: 'stdio',
          command: 'test',
          args: ['arg1'],
          disabledTools: ['tool1', 'tool2'],
          autoApprove: ['safe_tool'],
          timeout: 30000,
          initTimeout: 10000,
        },
      },
    };

    const mcpServers = getMCPServersFromConfig(userConfig);
    const testServer = mcpServers.find(server => server.name === 'test-server');

    expect(testServer).toBeDefined();

    // All enhanced fields should be preserved
    expect(testServer!.disabledTools).toEqual(['tool1', 'tool2']);
    expect(testServer!.autoApprove).toEqual(['safe_tool']);
    expect(testServer!.timeout).toBe(30000);
    expect(testServer!.initTimeout).toBe(10000);
  });

  it('should handle SSE server configs with enhanced fields', () => {
    const userConfig: Configuration = {
      mcpServers: {
        'sse-server': {
          type: 'sse',
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer token' },
          timeout: 15000,
          disabledTools: ['dangerous_tool'],
          autoApprove: ['read_only_tool'],
        },
      },
    };

    const mcpServers = getMCPServersFromConfig(userConfig);
    const sseServer = mcpServers.find(server => server.name === 'sse-server');

    expect(sseServer).toBeDefined();
    expect(sseServer!.type).toBe('sse');
    expect(sseServer!.disabledTools).toEqual(['dangerous_tool']);
    expect(sseServer!.autoApprove).toEqual(['read_only_tool']);
    expect(sseServer!.timeout).toBe(15000);
  });

  it('should handle undefined/empty enhanced fields gracefully', () => {
    const userConfig: Configuration = {
      mcpServers: {
        'minimal-server': {
          type: 'stdio',
          command: 'minimal',
          // No enhanced fields defined
        },
      },
    };

    const mcpServers = getMCPServersFromConfig(userConfig);
    const minimalServer = mcpServers.find(
      server => server.name === 'minimal-server'
    );

    expect(minimalServer).toBeDefined();

    // Enhanced fields should be undefined (not causing errors)
    expect(minimalServer!.disabledTools).toBeUndefined();
    expect(minimalServer!.autoApprove).toBeUndefined();
    expect(minimalServer!.timeout).toBeUndefined();
    expect(minimalServer!.initTimeout).toBeUndefined();
  });

  it('should prevent the original bug: constants.ts conversion path preserves disabledTools', () => {
    // This test specifically covers the constants.ts convertToLegacyMCPServers path
    // which was the actual bug - the constants.ts version was missing field preservation

    const userConfig: Configuration = {
      // Simulate runtime config scenario (has json/stdin properties)
      json: true,
      stdin: false,
      mcpServers: {
        'production-server': {
          type: 'stdio',
          command: 'production-tool',
          disabledTools: ['security_risk_tool', 'deprecated_tool'],
          autoApprove: ['safe_read_tool'],
          timeout: 60000,
          initTimeout: 5000,
        },
      },
    } as never; // Cast needed because json/stdin aren't in Configuration type

    const mcpServers = getMCPServersFromConfig(userConfig);
    const productionServer = mcpServers.find(
      server => server.name === 'production-server'
    );

    expect(productionServer).toBeDefined();

    // The original bug: constants.ts version wasn't preserving these fields
    expect(productionServer!.disabledTools).toEqual([
      'security_risk_tool',
      'deprecated_tool',
    ]);
    expect(productionServer!.autoApprove).toEqual(['safe_read_tool']);
    expect(productionServer!.timeout).toBe(60000);
    expect(productionServer!.initTimeout).toBe(5000);
  });
});
