/**
 * Tests for Tool Wrapper Module
 * Following strict TDD - tests written first before implementation
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';
import { z } from 'zod';
import { convertMCPSchemaToZod, createWrappedTool } from './toolWrapper.js';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMockClient } from '../test/helpers/createMocks.js';

// Mock constants
vi.mock('../constants.js', () => ({
  TOOL_TIMEOUT_MS: 5000,
}));

import { logMcpTool } from '../logger.js';
import { TOOL_TIMEOUT_MS } from '../constants.js';

describe('Tool Wrapper Module', () => {
  const mockLogMcpTool = vi.mocked(logMcpTool);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('convertMCPSchemaToZod', () => {
    it('should return empty object schema for null schema', () => {
      const result = convertMCPSchemaToZod(null);

      expect(result).toBeInstanceOf(z.ZodObject);
      expect(() => result.parse({})).not.toThrow();
      expect(() => result.parse({ extra: 'property' })).not.toThrow(); // Should be partial
    });

    it('should return empty object schema for undefined schema', () => {
      const result = convertMCPSchemaToZod(undefined);

      expect(result).toBeInstanceOf(z.ZodObject);
      expect(() => result.parse({})).not.toThrow();
    });

    it('should handle object schema with properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const result = convertMCPSchemaToZod(schema);

      expect(() => result.parse({ name: 'John', age: 30 })).not.toThrow();
      expect(() => result.parse({ name: 'John' })).not.toThrow(); // Should be partial
      expect(() => result.parse({})).not.toThrow(); // Should be partial
    });

    it('should handle required fields in object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      };

      const result = convertMCPSchemaToZod(schema);

      expect(() => result.parse({ name: 'John', age: 30 })).not.toThrow();
      expect(() => result.parse({ name: 'John' })).not.toThrow();
      expect(() => result.parse({ age: 30 })).toThrow(); // Should require name
      expect(() => result.parse({})).toThrow(); // Should require name
    });

    it('should handle string type', () => {
      const schema = { type: 'string' };
      const result = convertMCPSchemaToZod(schema);

      expect(() => result.parse('hello')).not.toThrow();
      expect(() => result.parse(123)).toThrow();
    });

    it('should handle number type', () => {
      const schema = { type: 'number' };
      const result = convertMCPSchemaToZod(schema);

      expect(() => result.parse(123)).not.toThrow();
      expect(() => result.parse(123.45)).not.toThrow();
      expect(() => result.parse('123')).toThrow();
    });

    it('should handle integer type', () => {
      const schema = { type: 'integer' };
      const result = convertMCPSchemaToZod(schema);

      expect(() => result.parse(123)).not.toThrow();
      expect(() => result.parse(123.45)).toThrow();
      expect(() => result.parse('123')).toThrow();
    });

    it('should handle boolean type', () => {
      const schema = { type: 'boolean' };
      const result = convertMCPSchemaToZod(schema);

      expect(() => result.parse(true)).not.toThrow();
      expect(() => result.parse(false)).not.toThrow();
      expect(() => result.parse('true')).toThrow();
    });

    it('should handle array type with items', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' },
      };
      const result = convertMCPSchemaToZod(schema);

      expect(() => result.parse(['a', 'b', 'c'])).not.toThrow();
      expect(() => result.parse([])).not.toThrow();
      expect(() => result.parse([1, 2, 3])).toThrow();
    });

    it('should handle array type without items', () => {
      const schema = { type: 'array' };
      const result = convertMCPSchemaToZod(schema);

      expect(() => result.parse(['a', 'b', 'c'])).not.toThrow();
      expect(() => result.parse([1, 2, 3])).not.toThrow();
      expect(() => result.parse([])).not.toThrow();
    });

    it('should handle nested object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
            required: ['name'],
          },
        },
      };

      const result = convertMCPSchemaToZod(schema);

      expect(() =>
        result.parse({ user: { name: 'John', age: 30 } })
      ).not.toThrow();
      expect(() => result.parse({ user: { name: 'John' } })).not.toThrow();
      expect(() => result.parse({ user: { age: 30 } })).toThrow(); // Should require name
    });

    it('should handle unknown/default schema type', () => {
      const schema = { type: 'unknown_type' };
      const result = convertMCPSchemaToZod(schema);

      expect(() => result.parse('anything')).not.toThrow();
      expect(() => result.parse(123)).not.toThrow();
      expect(() => result.parse({})).not.toThrow();
    });
  });

  describe('createWrappedTool', () => {
    const mockTool: Tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
    };

    const mockClient = {
      callTool: vi.fn(),
    };

    it('should create wrapped tool with basic properties', () => {
      const result = createWrappedTool(
        mockTool,
        createMockClient(mockClient),
        'test-server'
      );

      expect(result.toolName).toBe('test_tool');
      expect(result.serverName).toBe('test-server');
      expect(result.description).toBe('A test tool');
      expect(result.execute).toBeInstanceOf(Function);
      expect(result.originalExecute).toBeInstanceOf(Function);
      expect(result.parameters).toBeDefined();
    });

    it('should use default description when tool description is missing', () => {
      const toolWithoutDescription: Tool = {
        name: 'no_desc_tool',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      };

      const result = createWrappedTool(
        toolWithoutDescription,
        createMockClient(mockClient),
        'test-server'
      );

      expect(result.description).toBe('Tool no_desc_tool from test-server');
    });

    it('should handle tool without input schema', () => {
      const toolWithoutSchema: Tool = {
        name: 'simple_tool',
        description: 'Simple tool',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      };

      const result = createWrappedTool(
        toolWithoutSchema,
        createMockClient(mockClient),
        'test-server'
      );

      expect(result.parameters).toBeDefined();
      expect(() => result.parameters.parse({})).not.toThrow();
    });

    it('should execute tool successfully with valid arguments', async () => {
      const mockCallResult: CallToolResult = {
        content: [{ type: 'text', text: 'Tool executed successfully' }],
        isError: false,
      };
      mockClient.callTool.mockResolvedValue(mockCallResult);

      const wrappedTool = createWrappedTool(
        mockTool,
        createMockClient(mockClient),
        'test-server'
      );
      const result = await wrappedTool.execute({ message: 'hello' });

      expect(result).toEqual({ result: 'Tool executed successfully' });
      expect(mockClient.callTool).toHaveBeenCalledWith(
        {
          name: 'test_tool',
          arguments: { message: 'hello' },
        },
        undefined,
        {
          timeout: TOOL_TIMEOUT_MS,
          resetTimeoutOnProgress: true,
        }
      );
      expect(mockLogMcpTool).toHaveBeenCalledWith(
        'test-server',
        'test_tool',
        'INFO',
        'Tool called',
        expect.objectContaining({
          args: { message: 'hello' },
        })
      );
    });

    it('should handle argument validation errors', async () => {
      const wrappedTool = createWrappedTool(
        mockTool,
        createMockClient(mockClient),
        'test-server'
      );
      const result = await wrappedTool.execute({ invalidArg: 'value' });

      expect(result.result).toContain(
        'Error: Invalid arguments for tool test_tool'
      );
      expect(mockClient.callTool).not.toHaveBeenCalled();
      expect(mockLogMcpTool).toHaveBeenCalledWith(
        'test-server',
        'test_tool',
        'ERROR',
        'Validation failed',
        expect.objectContaining({
          error: expect.stringContaining('Invalid arguments'),
        })
      );
    });

    it('should handle tool execution errors', async () => {
      const mockErrorResult: CallToolResult = {
        content: [{ type: 'text', text: 'Tool execution failed' }],
        isError: true,
      };
      mockClient.callTool.mockResolvedValue(mockErrorResult);

      const wrappedTool = createWrappedTool(
        mockTool,
        createMockClient(mockClient),
        'test-server'
      );
      const result = await wrappedTool.execute({ message: 'hello' });

      expect(result).toEqual({ result: 'Error: Tool execution failed' });
      expect(mockLogMcpTool).toHaveBeenCalledWith(
        'test-server',
        'test_tool',
        'ERROR',
        'Tool execution failed',
        expect.objectContaining({
          error: 'Tool execution failed',
        })
      );
    });

    describe('timeout handling', () => {
      beforeAll(() => {
        vi.useFakeTimers();
      });

      afterAll(() => {
        vi.useRealTimers();
      });

      it('should handle timeout errors', async () => {
        // Mock a long-running operation that would timeout
        mockClient.callTool.mockImplementation(
          () =>
            new Promise(resolve => setTimeout(resolve, TOOL_TIMEOUT_MS + 1000))
        );

        const wrappedTool = createWrappedTool(
          mockTool,
          createMockClient(mockClient),
          'test-server'
        );

        const executePromise = wrappedTool.execute({ message: 'hello' });

        // Advance time to trigger timeout
        vi.advanceTimersByTime(TOOL_TIMEOUT_MS + 1000);

        const result = await executePromise;

        expect(result.result).toContain('Error: Tool execution timeout');
        expect(mockLogMcpTool).toHaveBeenCalledWith(
          'test-server',
          'test_tool',
          'ERROR',
          'Tool execution exception',
          expect.objectContaining({
            error: 'Tool execution timeout',
          })
        );
      });
    });

    it('should handle different content types in results', async () => {
      const mockResults = [
        { type: 'text' as const, text: 'Text content' },
        { type: 'image' as const, data: 'base64data', mimeType: 'image/png' },
        {
          type: 'resource' as const,
          resource: { uri: 'file://test.txt', text: 'content' },
        },
        {
          type: 'audio' as const,
          data: 'base64audiodata',
          mimeType: 'audio/mp3',
        },
      ];

      const mockCallResult: CallToolResult = {
        content: mockResults,
        isError: false,
      };
      mockClient.callTool.mockResolvedValue(mockCallResult);

      const wrappedTool = createWrappedTool(
        mockTool,
        createMockClient(mockClient),
        'test-server'
      );
      const result = await wrappedTool.execute({ message: 'hello' });

      expect(result.result).toBe(
        [
          'Text content',
          '[Image: base64data]',
          '[Resource: file://test.txt]',
          '[Unknown content type]',
        ].join('\n')
      );
    });

    it('should handle empty content in results', async () => {
      const mockCallResult: CallToolResult = {
        content: [],
        isError: false,
      };
      mockClient.callTool.mockResolvedValue(mockCallResult);

      const wrappedTool = createWrappedTool(
        mockTool,
        createMockClient(mockClient),
        'test-server'
      );
      const result = await wrappedTool.execute({ message: 'hello' });

      expect(result.result).toBe('');
    });

    it('should handle client connection errors', async () => {
      mockClient.callTool.mockRejectedValue(new Error('Connection failed'));

      const wrappedTool = createWrappedTool(
        mockTool,
        createMockClient(mockClient),
        'test-server'
      );
      const result = await wrappedTool.execute({ message: 'hello' });

      expect(result.result).toContain('Error: Connection failed');
      expect(mockLogMcpTool).toHaveBeenCalledWith(
        'test-server',
        'test_tool',
        'ERROR',
        'Tool execution exception',
        expect.objectContaining({
          error: 'Connection failed',
        })
      );
    });

    it('should handle empty/null arguments', async () => {
      const simpleToolSchema: Tool = {
        name: 'simple_tool',
        description: 'Tool with no required params',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      };

      const mockCallResult: CallToolResult = {
        content: [{ type: 'text', text: 'Success' }],
        isError: false,
      };
      mockClient.callTool.mockResolvedValue(mockCallResult);

      const wrappedTool = createWrappedTool(
        simpleToolSchema,
        createMockClient(mockClient),
        'test-server'
      );

      // Test with null
      let result = await wrappedTool.execute(null);
      expect(result.result).toBe('Success');

      // Test with undefined
      result = await wrappedTool.execute(undefined);
      expect(result.result).toBe('Success');
    });

    it('should log successful execution with result length', async () => {
      const mockCallResult: CallToolResult = {
        content: [{ type: 'text', text: 'Success message' }],
        isError: false,
      };
      mockClient.callTool.mockResolvedValue(mockCallResult);

      const wrappedTool = createWrappedTool(
        mockTool,
        createMockClient(mockClient),
        'test-server'
      );
      await wrappedTool.execute({ message: 'hello' });

      expect(mockLogMcpTool).toHaveBeenCalledWith(
        'test-server',
        'test_tool',
        'INFO',
        'Tool executed successfully',
        expect.objectContaining({
          resultLength: 'Success message'.length,
        })
      );
    });

    it('should handle error result with missing content', async () => {
      const mockErrorResult: CallToolResult = {
        content: [], // Empty content array
        isError: true,
      };
      mockClient.callTool.mockResolvedValue(mockErrorResult);

      const wrappedTool = createWrappedTool(
        mockTool,
        createMockClient(mockClient),
        'test-server'
      );
      const result = await wrappedTool.execute({ message: 'hello' });

      expect(result.result).toBe('Error: Tool execution failed');
    });
  });
});
