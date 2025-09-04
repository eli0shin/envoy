/**
 * Tests for Client Wrapper Factory Module
 * Following strict TDD - tests written first before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodType, ZodTypeDef } from 'zod';
import { createMCPClientWrapperFromData } from './clientWrapperFactory.js';
import type {
  MCPClientWrapper,
  MCPServerConfig,
  ServerCapabilities,
  WrappedTool,
  MCPPrompt,
  MCPResource,
} from '../types/index.js';
import type {
  GetPromptResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import { createMockClient } from '../test/helpers/createMocks.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Mock dependencies
vi.mock('../mcp/capabilityTools.js', () => ({
  createPromptTools: vi.fn(),
  createResourceTools: vi.fn(),
}));

import {
  createPromptTools,
  createResourceTools,
} from '../mcp/capabilityTools.js';

function createMockTool(name: string, serverName = 'test-server'): WrappedTool {
  return {
    toolName: name,
    serverName,
    description: `Test tool ${name}`,
    parameters: {} as ZodType<unknown, ZodTypeDef, unknown>,
    execute: vi.fn(),
    originalExecute: vi.fn(),
  };
}

function createMockPrompt(name: string): MCPPrompt {
  return {
    name,
    description: `Test prompt ${name}`,
  };
}

function createMockResource(uri: string): MCPResource {
  return {
    uri,
    name: `Test resource ${uri}`,
  };
}

describe('Client Wrapper Factory Module', () => {
  const mockCreatePromptTools = vi.mocked(createPromptTools);
  const mockCreateResourceTools = vi.mocked(createResourceTools);

  const baseConfig: MCPServerConfig = {
    name: 'test-server',
    type: 'stdio',
    command: 'test-command',
  };

  const baseCapabilities: ServerCapabilities = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createMCPClientWrapperFromData', () => {
    it('should create wrapper with basic properties', () => {
      const client = createMockClient();
      const tools: WrappedTool[] = [];
      const prompts: MCPPrompt[] = [];
      const resources: MCPResource[] = [];

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        baseCapabilities,
        tools,
        prompts,
        resources
      );

      expect(wrapper.serverName).toBe('test-server');
      expect(wrapper.serverConfig).toBe(baseConfig);
      expect(wrapper.isConnected).toBe(true);
      expect(wrapper.tools).toBeInstanceOf(Map);
      expect(wrapper.prompts).toBeInstanceOf(Map);
      expect(wrapper.resources).toBeInstanceOf(Map);
      expect(wrapper.listPrompts).toBeInstanceOf(Function);
      expect(wrapper.getPrompt).toBeInstanceOf(Function);
      expect(wrapper.listResources).toBeInstanceOf(Function);
      expect(wrapper.readResource).toBeInstanceOf(Function);
    });

    it('should populate tools map from provided tools', () => {
      const client = createMockClient();
      const tools = [createMockTool('tool1'), createMockTool('tool2')];

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        baseCapabilities,
        tools,
        [],
        []
      );

      expect(wrapper.tools.size).toBe(2);
      expect(wrapper.tools.get('tool1')).toBe(tools[0]);
      expect(wrapper.tools.get('tool2')).toBe(tools[1]);
    });

    it('should handle duplicate tool names by keeping first', () => {
      const client = createMockClient();
      const tools = [
        createMockTool('duplicate'),
        createMockTool('duplicate'), // This should be ignored
      ];

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        baseCapabilities,
        tools,
        [],
        []
      );

      expect(wrapper.tools.size).toBe(1);
      expect(wrapper.tools.get('duplicate')).toBe(tools[0]); // First tool kept
    });

    it('should populate prompts map from provided prompts', () => {
      const client = createMockClient();
      const prompts = [
        createMockPrompt('prompt1'),
        createMockPrompt('prompt2'),
      ];

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        baseCapabilities,
        [],
        prompts,
        []
      );

      expect(wrapper.prompts.size).toBe(2);
      expect(wrapper.prompts.get('prompt1')).toBe(prompts[0]);
      expect(wrapper.prompts.get('prompt2')).toBe(prompts[1]);
    });

    it('should populate resources map from provided resources', () => {
      const client = createMockClient();
      const resources = [
        createMockResource('file://test1.txt'),
        createMockResource('file://test2.txt'),
      ];

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        baseCapabilities,
        [],
        [],
        resources
      );

      expect(wrapper.resources.size).toBe(2);
      expect(wrapper.resources.get('file://test1.txt')).toBe(resources[0]);
      expect(wrapper.resources.get('file://test2.txt')).toBe(resources[1]);
    });

    it('should create prompt tools when prompts capability is declared', () => {
      const client = createMockClient();
      const capabilities: ServerCapabilities = { prompts: {} };
      const prompts = [createMockPrompt('test-prompt')];
      const promptTools = [
        createMockTool('list_prompts'),
        createMockTool('get_prompt'),
      ];

      mockCreatePromptTools.mockReturnValue(promptTools);

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        capabilities,
        [],
        prompts,
        []
      );

      expect(mockCreatePromptTools).toHaveBeenCalledWith(
        client,
        'test-server',
        prompts
      );
      expect(wrapper.tools.size).toBe(2);
      expect(wrapper.tools.get('test-server_list_prompts')).toBe(
        promptTools[0]
      );
      expect(wrapper.tools.get('test-server_get_prompt')).toBe(promptTools[1]);
    });

    it('should create resource tools when resources capability is declared', () => {
      const client = createMockClient();
      const capabilities: ServerCapabilities = { resources: {} };
      const resources = [createMockResource('file://test.txt')];
      const resourceTools = [
        createMockTool('list_resources'),
        createMockTool('read_resource'),
      ];

      mockCreateResourceTools.mockReturnValue(resourceTools);

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        capabilities,
        [],
        [],
        resources
      );

      expect(mockCreateResourceTools).toHaveBeenCalledWith(
        client,
        'test-server',
        resources
      );
      expect(wrapper.tools.size).toBe(2);
      expect(wrapper.tools.get('test-server_list_resources')).toBe(
        resourceTools[0]
      );
      expect(wrapper.tools.get('test-server_read_resource')).toBe(
        resourceTools[1]
      );
    });

    it('should not create prompt tools when prompts capability is not declared', () => {
      const client = createMockClient();
      const capabilities: ServerCapabilities = {}; // No prompts capability
      const prompts = [createMockPrompt('test-prompt')];

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        capabilities,
        [],
        prompts,
        []
      );

      expect(mockCreatePromptTools).not.toHaveBeenCalled();
      expect(wrapper.tools.size).toBe(0);
    });

    it('should not create resource tools when resources capability is not declared', () => {
      const client = createMockClient();
      const capabilities: ServerCapabilities = {}; // No resources capability
      const resources = [createMockResource('file://test.txt')];

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        capabilities,
        [],
        [],
        resources
      );

      expect(mockCreateResourceTools).not.toHaveBeenCalled();
      expect(wrapper.tools.size).toBe(0);
    });

    it('should combine regular tools with capability tools', () => {
      const client = createMockClient();
      const capabilities: ServerCapabilities = { prompts: {}, resources: {} };
      const regularTools = [createMockTool('regular-tool')];
      const promptTools = [createMockTool('prompt-tool')];
      const resourceTools = [createMockTool('resource-tool')];

      mockCreatePromptTools.mockReturnValue(promptTools);
      mockCreateResourceTools.mockReturnValue(resourceTools);

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        capabilities,
        regularTools,
        [],
        []
      );

      expect(wrapper.tools.size).toBe(3);
      expect(wrapper.tools.get('regular-tool')).toBe(regularTools[0]);
      expect(wrapper.tools.get('test-server_prompt-tool')).toBe(promptTools[0]);
      expect(wrapper.tools.get('test-server_resource-tool')).toBe(
        resourceTools[0]
      );
    });

    describe('wrapper methods', () => {
      let wrapper: MCPClientWrapper;
      let mockClient: Client;

      beforeEach(() => {
        mockClient = createMockClient({
          getPrompt: vi.fn(),
          readResource: vi.fn(),
        });

        wrapper = createMCPClientWrapperFromData(
          mockClient,
          baseConfig,
          baseCapabilities,
          [],
          [createMockPrompt('test-prompt')],
          [createMockResource('file://test.txt')]
        );
      });

      describe('listPrompts', () => {
        it('should return array of prompts from prompts map', async () => {
          const prompts = await wrapper.listPrompts();

          expect(prompts).toHaveLength(1);
          expect(prompts[0].name).toBe('test-prompt');
        });
      });

      describe('getPrompt', () => {
        it('should call client.getPrompt and return formatted result', async () => {
          const mockResult: GetPromptResult = {
            description: 'Test prompt result',
            messages: [
              { role: 'user', content: { type: 'text', text: 'Hello' } },
            ],
          };
          vi.mocked(mockClient.getPrompt).mockResolvedValue(mockResult);

          const result = await wrapper.getPrompt('test-prompt', {
            arg: 'value',
          });

          expect(mockClient.getPrompt).toHaveBeenCalledWith({
            name: 'test-prompt',
            arguments: { arg: 'value' },
          });
          expect(result).toEqual({
            description: 'Test prompt result',
            messages: mockResult.messages,
          });
        });

        it('should call client.getPrompt without arguments', async () => {
          const mockResult: GetPromptResult = {
            description: 'Test prompt',
            messages: [],
          };
          vi.mocked(mockClient.getPrompt).mockResolvedValue(mockResult);

          const result = await wrapper.getPrompt('test-prompt');

          expect(mockClient.getPrompt).toHaveBeenCalledWith({
            name: 'test-prompt',
            arguments: undefined,
          });
          expect(result).toEqual({
            description: 'Test prompt',
            messages: [],
          });
        });
      });

      describe('listResources', () => {
        it('should return array of resources from resources map', async () => {
          const resources = await wrapper.listResources();

          expect(resources).toHaveLength(1);
          expect(resources[0].uri).toBe('file://test.txt');
        });
      });

      describe('readResource', () => {
        it('should call client.readResource and return formatted result', async () => {
          const mockResult: ReadResourceResult = {
            contents: [
              {
                uri: 'file://test.txt',
                mimeType: 'text/plain',
                text: 'content',
              },
            ],
          };
          vi.mocked(mockClient.readResource).mockResolvedValue(mockResult);

          const result = await wrapper.readResource('file://test.txt');

          expect(mockClient.readResource).toHaveBeenCalledWith({
            uri: 'file://test.txt',
          });
          expect(result).toEqual({
            contents: mockResult.contents,
          });
        });
      });
    });

    describe('edge cases', () => {
      it('should handle empty arrays gracefully', () => {
        const client = createMockClient();

        const wrapper = createMCPClientWrapperFromData(
          client,
          baseConfig,
          baseCapabilities,
          [],
          [],
          []
        );

        expect(wrapper.tools.size).toBe(0);
        expect(wrapper.prompts.size).toBe(0);
        expect(wrapper.resources.size).toBe(0);
      });

      it('should handle capabilities with empty tools arrays', () => {
        const client = createMockClient();
        const capabilities: ServerCapabilities = { prompts: {}, resources: {} };

        mockCreatePromptTools.mockReturnValue([]);
        mockCreateResourceTools.mockReturnValue([]);

        const wrapper = createMCPClientWrapperFromData(
          client,
          baseConfig,
          capabilities,
          [],
          [],
          []
        );

        expect(wrapper.tools.size).toBe(0);
        expect(mockCreatePromptTools).toHaveBeenCalledWith(
          client,
          'test-server',
          []
        );
        expect(mockCreateResourceTools).toHaveBeenCalledWith(
          client,
          'test-server',
          []
        );
      });

      it('should handle server name with special characters in tool keys', () => {
        const client = createMockClient();
        const config: MCPServerConfig = {
          name: 'server-with-dashes_and_underscores',
          type: 'stdio',
          command: 'test',
        };
        const capabilities: ServerCapabilities = { prompts: {} };
        const promptTools = [createMockTool('test-tool')];

        mockCreatePromptTools.mockReturnValue(promptTools);

        const wrapper = createMCPClientWrapperFromData(
          client,
          config,
          capabilities,
          [],
          [],
          []
        );

        expect(
          wrapper.tools.get('server-with-dashes_and_underscores_test-tool')
        ).toBe(promptTools[0]);
      });

      it('should preserve original tool server names', () => {
        const client = createMockClient();
        const tools = [
          createMockTool('tool1', 'original-server'),
          createMockTool('tool2', 'another-server'),
        ];

        const wrapper = createMCPClientWrapperFromData(
          client,
          baseConfig,
          baseCapabilities,
          tools,
          [],
          []
        );

        expect(wrapper.tools.get('tool1')?.serverName).toBe('original-server');
        expect(wrapper.tools.get('tool2')?.serverName).toBe('another-server');
      });
    });
  });
});
