/**
 * Tests for Capability Tool Factories Module
 * Following strict TDD - tests written first before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  executePrompt,
  readResourceContent,
  createPromptTools,
  createResourceTools,
} from './capabilityTools.js';
import type {
  GetPromptResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  MCPPrompt,
  MCPResource,
  PromptResult,
  ResourceContent,
} from '../types/index.js';
import { createMockClient } from '../test/helpers/createMocks.js';

describe('Capability Tool Factories', () => {
  const mockClient = {
    getPrompt: vi.fn(),
    readResource: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executePrompt', () => {
    it('should execute prompt with name and arguments', async () => {
      const mockResult: GetPromptResult = {
        description: 'Test prompt result',
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: 'Hello world' },
          },
        ],
      };
      mockClient.getPrompt.mockResolvedValue(mockResult);

      const result = await executePrompt(
        createMockClient(mockClient),
        'test-prompt',
        { key: 'value' }
      );

      expect(mockClient.getPrompt).toHaveBeenCalledWith({
        name: 'test-prompt',
        arguments: { key: 'value' },
      });
      expect(result).toEqual({
        description: 'Test prompt result',
        messages: mockResult.messages,
      });
    });

    it('should execute prompt without arguments', async () => {
      const mockResult: GetPromptResult = {
        description: 'Simple prompt',
        messages: [],
      };
      mockClient.getPrompt.mockResolvedValue(mockResult);

      const result = await executePrompt(
        createMockClient(mockClient),
        'simple-prompt'
      );

      expect(mockClient.getPrompt).toHaveBeenCalledWith({
        name: 'simple-prompt',
        arguments: undefined,
      });
      expect(result).toEqual({
        description: 'Simple prompt',
        messages: [],
      });
    });

    it('should handle prompt execution errors', async () => {
      mockClient.getPrompt.mockRejectedValue(new Error('Prompt not found'));

      await expect(
        executePrompt(createMockClient(mockClient), 'missing-prompt')
      ).rejects.toThrow('Prompt not found');
    });
  });

  describe('readResourceContent', () => {
    it('should read resource content by URI', async () => {
      const mockResult: ReadResourceResult = {
        contents: [
          {
            uri: 'file://test.txt',
            mimeType: 'text/plain',
            text: 'Resource content',
          },
        ],
      };
      mockClient.readResource.mockResolvedValue(mockResult);

      const result = await readResourceContent(
        createMockClient(mockClient),
        'file://test.txt'
      );

      expect(mockClient.readResource).toHaveBeenCalledWith({
        uri: 'file://test.txt',
      });
      expect(result).toEqual({
        contents: mockResult.contents,
      });
    });

    it('should handle resource reading errors', async () => {
      mockClient.readResource.mockRejectedValue(
        new Error('Resource not found')
      );

      await expect(
        readResourceContent(createMockClient(mockClient), 'missing://resource')
      ).rejects.toThrow('Resource not found');
    });
  });

  describe('createPromptTools', () => {
    const mockPrompts: MCPPrompt[] = [
      {
        name: 'test-prompt',
        description: 'A test prompt',
        arguments: [
          {
            name: 'input',
            description: 'Input text',
            required: true,
          },
        ],
      },
    ];

    it('should create prompt tools with list and get functions', () => {
      const tools = createPromptTools(
        createMockClient(mockClient),
        'test-server',
        mockPrompts
      );

      expect(tools).toHaveLength(2);

      // Check list_prompts tool
      const listTool = tools.find(t => t.toolName === 'list_prompts');
      expect(listTool).toBeDefined();
      expect(listTool?.description).toBe(
        'List available prompts from test-server'
      );
      expect(listTool?.serverName).toBe('test-server');
      expect(listTool?.parameters).toBeInstanceOf(z.ZodObject);

      // Check get_prompt tool
      const getTool = tools.find(t => t.toolName === 'get_prompt');
      expect(getTool).toBeDefined();
      expect(getTool?.description).toBe(
        'Get and execute a prompt from test-server'
      );
      expect(getTool?.serverName).toBe('test-server');
      expect(getTool?.parameters).toBeInstanceOf(z.ZodObject);
    });

    it('should execute list_prompts tool correctly', async () => {
      const tools = createPromptTools(
        createMockClient(mockClient),
        'test-server',
        mockPrompts
      );

      const listTool = tools.find(t => t.toolName === 'list_prompts')!;
      const result = await listTool.execute({});

      expect(result.result).toBe(JSON.stringify(mockPrompts, null, 2));
    });

    it('should execute get_prompt tool successfully', async () => {
      const mockPromptResult: PromptResult = {
        description: 'Test execution',
        messages: [{ role: 'user', content: { type: 'text', text: 'Hello' } }],
      };

      // Mock the executePrompt function call
      mockClient.getPrompt.mockResolvedValue({
        description: mockPromptResult.description,
        messages: mockPromptResult.messages,
      });

      const tools = createPromptTools(
        createMockClient(mockClient),
        'test-server',
        mockPrompts
      );

      const getTool = tools.find(t => t.toolName === 'get_prompt')!;
      const result = await getTool.execute({
        name: 'test-prompt',
        arguments: { input: 'test' },
      });

      expect(result.result).toBe(JSON.stringify(mockPromptResult, null, 2));
      expect(mockClient.getPrompt).toHaveBeenCalledWith({
        name: 'test-prompt',
        arguments: { input: 'test' },
      });
    });

    it('should handle get_prompt execution errors', async () => {
      mockClient.getPrompt.mockRejectedValue(new Error('Prompt failed'));

      const tools = createPromptTools(
        createMockClient(mockClient),
        'test-server',
        mockPrompts
      );

      const getTool = tools.find(t => t.toolName === 'get_prompt')!;
      const result = await getTool.execute({
        name: 'failing-prompt',
      });

      expect(result.result).toBe('Error: Prompt failed');
    });

    it('should handle get_prompt with no arguments', async () => {
      const mockPromptResult: PromptResult = {
        description: 'No args prompt',
        messages: [],
      };

      mockClient.getPrompt.mockResolvedValue({
        description: mockPromptResult.description,
        messages: mockPromptResult.messages,
      });

      const tools = createPromptTools(
        createMockClient(mockClient),
        'test-server',
        mockPrompts
      );

      const getTool = tools.find(t => t.toolName === 'get_prompt')!;
      const result = await getTool.execute({
        name: 'test-prompt',
      });

      expect(result.result).toBe(JSON.stringify(mockPromptResult, null, 2));
      expect(mockClient.getPrompt).toHaveBeenCalledWith({
        name: 'test-prompt',
        arguments: undefined,
      });
    });

    it('should work with empty prompts array', () => {
      const tools = createPromptTools(
        createMockClient(mockClient),
        'empty-server',
        []
      );

      expect(tools).toHaveLength(2);
      expect(tools[0].toolName).toBe('list_prompts');
      expect(tools[1].toolName).toBe('get_prompt');
    });
  });

  describe('createResourceTools', () => {
    const mockResources: MCPResource[] = [
      {
        uri: 'file://test.txt',
        name: 'Test file',
        description: 'A test file resource',
        mimeType: 'text/plain',
      },
    ];

    it('should create resource tools with list and read functions', () => {
      const tools = createResourceTools(
        createMockClient(mockClient),
        'test-server',
        mockResources
      );

      expect(tools).toHaveLength(2);

      // Check list_resources tool
      const listTool = tools.find(t => t.toolName === 'list_resources');
      expect(listTool).toBeDefined();
      expect(listTool?.description).toBe(
        'List available resources from test-server'
      );
      expect(listTool?.serverName).toBe('test-server');
      expect(listTool?.parameters).toBeInstanceOf(z.ZodObject);

      // Check read_resource tool
      const readTool = tools.find(t => t.toolName === 'read_resource');
      expect(readTool).toBeDefined();
      expect(readTool?.description).toBe(
        'Read content from a resource in test-server'
      );
      expect(readTool?.serverName).toBe('test-server');
      expect(readTool?.parameters).toBeInstanceOf(z.ZodObject);
    });

    it('should execute list_resources tool correctly', async () => {
      const tools = createResourceTools(
        createMockClient(mockClient),
        'test-server',
        mockResources
      );

      const listTool = tools.find(t => t.toolName === 'list_resources')!;
      const result = await listTool.execute({});

      expect(result.result).toBe(JSON.stringify(mockResources, null, 2));
    });

    it('should execute read_resource tool successfully', async () => {
      const mockResourceContent: ResourceContent = {
        contents: [
          {
            uri: 'file://test.txt',
            mimeType: 'text/plain',
            text: 'File content',
          },
        ],
      };

      mockClient.readResource.mockResolvedValue(mockResourceContent);

      const tools = createResourceTools(
        createMockClient(mockClient),
        'test-server',
        mockResources
      );

      const readTool = tools.find(t => t.toolName === 'read_resource')!;
      const result = await readTool.execute({
        uri: 'file://test.txt',
      });

      expect(result.result).toBe(JSON.stringify(mockResourceContent, null, 2));
      expect(mockClient.readResource).toHaveBeenCalledWith({
        uri: 'file://test.txt',
      });
    });

    it('should handle read_resource execution errors', async () => {
      mockClient.readResource.mockRejectedValue(new Error('Resource failed'));

      const tools = createResourceTools(
        createMockClient(mockClient),
        'test-server',
        mockResources
      );

      const readTool = tools.find(t => t.toolName === 'read_resource')!;
      const result = await readTool.execute({
        uri: 'file://missing.txt',
      });

      expect(result.result).toBe('Error: Resource failed');
    });

    it('should handle non-Error exceptions in read_resource', async () => {
      mockClient.readResource.mockRejectedValue('String error');

      const tools = createResourceTools(
        createMockClient(mockClient),
        'test-server',
        mockResources
      );

      const readTool = tools.find(t => t.toolName === 'read_resource')!;
      const result = await readTool.execute({
        uri: 'file://problematic.txt',
      });

      expect(result.result).toBe('Error: Failed to read resource');
    });

    it('should work with empty resources array', () => {
      const tools = createResourceTools(
        createMockClient(mockClient),
        'empty-server',
        []
      );

      expect(tools).toHaveLength(2);
      expect(tools[0].toolName).toBe('list_resources');
      expect(tools[1].toolName).toBe('read_resource');
    });

    it('should have proper originalExecute functions', async () => {
      const tools = createResourceTools(
        createMockClient(mockClient),
        'test-server',
        mockResources
      );

      // Test list_resources originalExecute
      const listTool = tools.find(t => t.toolName === 'list_resources')!;
      expect(listTool.originalExecute).toBeInstanceOf(Function);

      const listResult = await listTool.originalExecute({});
      expect(listResult.result).toBe(JSON.stringify(mockResources, null, 2));

      // Test read_resource originalExecute
      const mockContent: ResourceContent = {
        contents: [{ uri: 'test', mimeType: 'text', text: 'content' }],
      };
      mockClient.readResource.mockResolvedValue(mockContent);

      const readTool = tools.find(t => t.toolName === 'read_resource')!;
      expect(readTool.originalExecute).toBeInstanceOf(Function);

      const readResult = await readTool.originalExecute({
        uri: 'file://test.txt',
      });
      expect(readResult.result).toBe(JSON.stringify(mockContent, null, 2));
    });
  });

  describe('integration tests', () => {
    it('should create tools that work together properly', async () => {
      const prompts: MCPPrompt[] = [
        { name: 'test', description: 'Test prompt' },
      ];
      const resources: MCPResource[] = [
        { uri: 'file://test', name: 'Test resource' },
      ];

      const promptTools = createPromptTools(
        createMockClient(mockClient),
        'server1',
        prompts
      );
      const resourceTools = createResourceTools(
        createMockClient(mockClient),
        'server2',
        resources
      );

      expect(promptTools).toHaveLength(2);
      expect(resourceTools).toHaveLength(2);

      // Each tool should have unique names
      const allToolNames = [
        ...promptTools.map(t => t.toolName),
        ...resourceTools.map(t => t.toolName),
      ];
      expect(new Set(allToolNames).size).toBe(4); // Should be unique
    });

    it('should handle different server names properly', () => {
      const tools1 = createPromptTools(
        createMockClient(mockClient),
        'server-1',
        []
      );
      const tools2 = createResourceTools(
        createMockClient(mockClient),
        'server-2',
        []
      );

      expect(tools1[0].serverName).toBe('server-1');
      expect(tools1[0].description).toContain('server-1');
      expect(tools2[0].serverName).toBe('server-2');
      expect(tools2[0].description).toContain('server-2');
    });
  });
});
