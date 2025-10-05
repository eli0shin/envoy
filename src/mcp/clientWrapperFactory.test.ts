/**
 * Tests for Client Wrapper Factory Module
 * Following strict TDD - tests written first before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodType, ZodTypeDef } from 'zod/v3';
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

function createMockTool(name: string, serverName = 'test-server'): WrappedTool {
  return {
    toolName: name,
    serverName,
    description: `Test tool ${name}`,
    inputSchema: {} as ZodType<unknown, ZodTypeDef, unknown>,
    execute: vi.fn(),
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
      expect(typeof wrapper.tools).toBe('object');
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

      expect(Object.keys(wrapper.tools).length).toBe(2);
      expect(wrapper.tools['tool1']).toBe(tools[0]);
      expect(wrapper.tools['tool2']).toBe(tools[1]);
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

      expect(Object.keys(wrapper.tools).length).toBe(1);
      expect(wrapper.tools['duplicate']).toBe(tools[0]); // First tool kept
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

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        capabilities,
        [],
        prompts,
        []
      );

      expect(Object.keys(wrapper.tools).length).toBe(2);
      expect(wrapper.tools['test-server_list_prompts']).toBeDefined();
      expect(wrapper.tools['test-server_list_prompts']?.serverName).toBe('test-server');
      expect(wrapper.tools['test-server_list_prompts']?.toolName).toBe('list_prompts');
      expect(wrapper.tools['test-server_get_prompt']).toBeDefined();
      expect(wrapper.tools['test-server_get_prompt']?.serverName).toBe('test-server');
      expect(wrapper.tools['test-server_get_prompt']?.toolName).toBe('get_prompt');
    });

    it('should create resource tools when resources capability is declared', () => {
      const client = createMockClient();
      const capabilities: ServerCapabilities = { resources: {} };
      const resources = [createMockResource('file://test.txt')];

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        capabilities,
        [],
        [],
        resources
      );

      expect(Object.keys(wrapper.tools).length).toBe(2);
      expect(wrapper.tools['test-server_list_resources']).toBeDefined();
      expect(wrapper.tools['test-server_list_resources']?.serverName).toBe('test-server');
      expect(wrapper.tools['test-server_list_resources']?.toolName).toBe('list_resources');
      expect(wrapper.tools['test-server_read_resource']).toBeDefined();
      expect(wrapper.tools['test-server_read_resource']?.serverName).toBe('test-server');
      expect(wrapper.tools['test-server_read_resource']?.toolName).toBe('read_resource');
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

      expect(Object.keys(wrapper.tools).length).toBe(0);
      expect('test-server_list_prompts' in wrapper.tools).toBe(false);
      expect('test-server_get_prompt' in wrapper.tools).toBe(false);
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

      expect(Object.keys(wrapper.tools).length).toBe(0);
      expect('test-server_list_resources' in wrapper.tools).toBe(false);
      expect('test-server_read_resource' in wrapper.tools).toBe(false);
    });

    it('should combine regular tools with capability tools', () => {
      const client = createMockClient();
      const capabilities: ServerCapabilities = { prompts: {}, resources: {} };
      const regularTools = [createMockTool('regular-tool')];

      const wrapper = createMCPClientWrapperFromData(
        client,
        baseConfig,
        capabilities,
        regularTools,
        [],
        []
      );

      // Should have: 1 regular + 2 prompt tools + 2 resource tools = 5
      expect(Object.keys(wrapper.tools).length).toBe(5);
      expect(wrapper.tools['regular-tool']).toBe(regularTools[0]);
      expect('test-server_list_prompts' in wrapper.tools).toBe(true);
      expect('test-server_get_prompt' in wrapper.tools).toBe(true);
      expect('test-server_list_resources' in wrapper.tools).toBe(true);
      expect('test-server_read_resource' in wrapper.tools).toBe(true);
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

        expect(Object.keys(wrapper.tools).length).toBe(0);
        expect(wrapper.prompts.size).toBe(0);
        expect(wrapper.resources.size).toBe(0);
      });

      it('should handle capabilities with empty tools arrays', () => {
        const client = createMockClient();
        const capabilities: ServerCapabilities = { prompts: {}, resources: {} };

        const wrapper = createMCPClientWrapperFromData(
          client,
          baseConfig,
          capabilities,
          [],
          [],
          []
        );

        // Should create prompt and resource tools even with empty arrays
        expect(Object.keys(wrapper.tools).length).toBe(4); // list_prompts, get_prompt, list_resources, read_resource
        expect('test-server_list_prompts' in wrapper.tools).toBe(true);
        expect('test-server_get_prompt' in wrapper.tools).toBe(true);
        expect('test-server_list_resources' in wrapper.tools).toBe(true);
        expect('test-server_read_resource' in wrapper.tools).toBe(true);
      });

      it('should handle server name with special characters in tool keys', () => {
        const client = createMockClient();
        const config: MCPServerConfig = {
          name: 'server-with-dashes_and_underscores',
          type: 'stdio',
          command: 'test',
        };
        const capabilities: ServerCapabilities = { prompts: {} };

        const wrapper = createMCPClientWrapperFromData(
          client,
          config,
          capabilities,
          [],
          [],
          []
        );

        // Should create tools with server name prefix including special characters
        expect('server-with-dashes_and_underscores_list_prompts' in wrapper.tools).toBe(true);
        expect('server-with-dashes_and_underscores_get_prompt' in wrapper.tools).toBe(true);
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

        expect(wrapper.tools['tool1']?.serverName).toBe('original-server');
        expect(wrapper.tools['tool2']?.serverName).toBe('another-server');
      });
    });
  });
});
