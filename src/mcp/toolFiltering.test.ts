/**
 * Tests for Tool Filtering Module
 * Following strict TDD - tests written first before implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isToolDisabled } from './toolFiltering.js';
import type { WrappedTool, MCPServerConfig } from '../types/index.js';
import type { RuntimeConfiguration } from '../config/types.js';
import { createMinimalMockRuntimeConfiguration } from '../test/helpers/mockConfig.js';

import { logger } from '../logger.js';

describe('Tool Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isToolDisabled', () => {
    const mockTool: WrappedTool = {
      description: 'Test tool',
      parameters: {} as WrappedTool['parameters'],
      execute: vi.fn(),
      originalExecute: vi.fn(),
      serverName: 'test-server',
      toolName: 'write_file',
    };

    const mockServerConfig: MCPServerConfig = {
      type: 'stdio',
      name: 'test-server',
      command: 'test-command',
    };

    it('should return false when no disabled tools are configured', () => {
      const runtimeConfig = createMinimalMockRuntimeConfiguration();

      const result = isToolDisabled(
        'test_write_file',
        mockTool,
        mockServerConfig,
        runtimeConfig
      );

      expect(result).toBe(false);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should return true when tool is disabled at server level', () => {
      const serverConfigWithDisabled: MCPServerConfig = {
        ...mockServerConfig,
        disabledTools: ['write_file', 'delete_file'],
      };
      const runtimeConfig = createMinimalMockRuntimeConfiguration();

      const result = isToolDisabled(
        'test_write_file',
        mockTool,
        serverConfigWithDisabled,
        runtimeConfig
      );

      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        "Tool 'write_file' disabled by server 'test-server' configuration",
        {
          toolKey: 'test_write_file',
          serverName: 'test-server',
          reason: 'server_config',
        }
      );
    });

    it('should return false when tool is not in server disabled list', () => {
      const serverConfigWithDisabled: MCPServerConfig = {
        ...mockServerConfig,
        disabledTools: ['delete_file', 'read_file'],
      };
      const runtimeConfig = createMinimalMockRuntimeConfiguration();

      const result = isToolDisabled(
        'test_write_file',
        mockTool,
        serverConfigWithDisabled,
        runtimeConfig
      );

      expect(result).toBe(false);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should return true when tool is globally disabled by exact match', () => {
      const runtimeConfig = createMinimalMockRuntimeConfiguration({
        tools: {
          disabledInternalTools: ['test_write_file', 'filesystem_delete'],
          globalTimeout: 30000,
        },
      });

      const result = isToolDisabled(
        'test_write_file',
        mockTool,
        mockServerConfig,
        runtimeConfig
      );

      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        "Tool 'test_write_file' disabled by global configuration",
        {
          toolKey: 'test_write_file',
          serverName: 'test-server',
          reason: 'global_config',
        }
      );
    });

    it('should return true when tool is globally disabled by unprefixed match', () => {
      const runtimeConfig = createMinimalMockRuntimeConfiguration({
        tools: {
          disabledInternalTools: ['write_file', 'delete_file'],
          globalTimeout: 30000,
        },
      });

      const result = isToolDisabled(
        'filesystem_write_file',
        mockTool,
        mockServerConfig,
        runtimeConfig
      );

      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        "Tool 'filesystem_write_file' disabled by global configuration",
        {
          toolKey: 'filesystem_write_file',
          serverName: 'test-server',
          reason: 'global_config',
        }
      );
    });

    it('should return true when tool matches suffix pattern', () => {
      const toolWithSuffix: WrappedTool = {
        ...mockTool,
        toolName: 'write_file',
      };
      const runtimeConfig = createMinimalMockRuntimeConfiguration({
        tools: {
          disabledInternalTools: ['write_file'],
          globalTimeout: 30000,
        },
      });

      const result = isToolDisabled(
        'custom_server_write_file',
        toolWithSuffix,
        mockServerConfig,
        runtimeConfig
      );

      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        "Tool 'custom_server_write_file' disabled by global configuration",
        {
          toolKey: 'custom_server_write_file',
          serverName: 'test-server',
          reason: 'global_config',
        }
      );
    });

    it('should return false when tool does not match any global patterns', () => {
      const runtimeConfig = createMinimalMockRuntimeConfiguration({
        tools: {
          disabledInternalTools: ['delete_file', 'read_file'],
          globalTimeout: 30000,
        },
      });

      const result = isToolDisabled(
        'test_write_file',
        mockTool,
        mockServerConfig,
        runtimeConfig
      );

      expect(result).toBe(false);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should prioritize server-level disabled tools over global config', () => {
      const serverConfigWithDisabled: MCPServerConfig = {
        ...mockServerConfig,
        disabledTools: ['write_file'],
      };
      const runtimeConfig = createMinimalMockRuntimeConfiguration({
        tools: {
          disabledInternalTools: ['different_tool'],
          globalTimeout: 30000,
        },
      });

      const result = isToolDisabled(
        'test_write_file',
        mockTool,
        serverConfigWithDisabled,
        runtimeConfig
      );

      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        "Tool 'write_file' disabled by server 'test-server' configuration",
        expect.objectContaining({
          reason: 'server_config',
        })
      );
    });

    it('should handle empty disabledTools arrays', () => {
      const serverConfigWithEmpty: MCPServerConfig = {
        ...mockServerConfig,
        disabledTools: [],
      };
      const runtimeConfig = createMinimalMockRuntimeConfiguration({
        tools: {
          disabledInternalTools: [],
          globalTimeout: 30000,
        },
      });

      const result = isToolDisabled(
        'test_write_file',
        mockTool,
        serverConfigWithEmpty,
        runtimeConfig
      );

      expect(result).toBe(false);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should handle undefined tools configuration', () => {
      const runtimeConfig = {
        ...createMinimalMockRuntimeConfiguration(),
        tools: undefined,
      } as unknown as RuntimeConfiguration;

      const result = isToolDisabled(
        'test_write_file',
        mockTool,
        mockServerConfig,
        runtimeConfig
      );

      expect(result).toBe(false);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should handle missing disabledInternalTools property', () => {
      const runtimeConfig = {
        ...createMinimalMockRuntimeConfiguration(),
        tools: {
          globalTimeout: 30000,
          // disabledInternalTools is undefined
        },
      } as RuntimeConfiguration;

      const result = isToolDisabled(
        'test_write_file',
        mockTool,
        mockServerConfig,
        runtimeConfig
      );

      expect(result).toBe(false);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should work with complex tool names and patterns', () => {
      const complexTool: WrappedTool = {
        ...mockTool,
        toolName: 'complex_tool_name_with_underscores',
      };
      const runtimeConfig = createMinimalMockRuntimeConfiguration({
        tools: {
          disabledInternalTools: ['complex_tool_name_with_underscores'],
          globalTimeout: 30000,
        },
      });

      const result = isToolDisabled(
        'server_complex_tool_name_with_underscores',
        complexTool,
        mockServerConfig,
        runtimeConfig
      );

      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        "Tool 'server_complex_tool_name_with_underscores' disabled by global configuration",
        expect.objectContaining({
          reason: 'global_config',
        })
      );
    });

    it('should handle special characters in tool names', () => {
      const specialTool: WrappedTool = {
        ...mockTool,
        toolName: 'tool-with-dashes',
      };
      const runtimeConfig = createMinimalMockRuntimeConfiguration({
        tools: {
          disabledInternalTools: ['tool-with-dashes'],
          globalTimeout: 30000,
        },
      });

      const result = isToolDisabled(
        'prefix_tool-with-dashes',
        specialTool,
        mockServerConfig,
        runtimeConfig
      );

      expect(result).toBe(true);
    });

    it('should handle multiple global patterns and find first match', () => {
      const runtimeConfig = createMinimalMockRuntimeConfiguration({
        tools: {
          disabledInternalTools: [
            'not_matching',
            'write_file',
            'also_not_matching',
          ],
          globalTimeout: 30000,
        },
      });

      const result = isToolDisabled(
        'filesystem_write_file',
        mockTool,
        mockServerConfig,
        runtimeConfig
      );

      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        "Tool 'filesystem_write_file' disabled by global configuration",
        expect.objectContaining({
          reason: 'global_config',
        })
      );
    });
  });
});
