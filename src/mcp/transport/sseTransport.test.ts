/**
 * Tests for SSE Transport Module
 * Following strict TDD - tests written first before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the MCP SDK FIRST - before any imports that use it
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn(),
}));

// Now import everything AFTER mocks are set up
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { createSSEClient } from './sseTransport.js';
import type { SSEMCPServerConfig } from '../../types/index.js';
import {
  createMockSSETransport,
  createMockClient,
} from '../../test/helpers/createMocks.js';

describe('SSE Transport', () => {
  const mockClient = vi.mocked(Client);
  const mockSSETransport = vi.mocked(SSEClientTransport);

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks for ALL tests to prevent real MCP servers from starting
    mockSSETransport.mockImplementation(() => createMockSSETransport());
    mockClient.mockImplementation(() => createMockClient());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSSEClient', () => {
    it('should create SSE client with valid URL', async () => {
      const config: SSEMCPServerConfig = {
        type: 'sse',
        name: 'test-sse-server',
        url: 'https://example.com/sse',
      };

      // Using default mocks from beforeEach

      const result = await createSSEClient(config);

      expect(mockSSETransport).toHaveBeenCalledWith(new URL(config.url));
      expect(mockClient).toHaveBeenCalledWith(
        {
          name: 'envoy-test-sse-server',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            prompts: {},
            resources: {},
          },
        }
      );
      expect(result).toBeDefined();
    });

    it('should create SSE client with localhost URL', async () => {
      const config: SSEMCPServerConfig = {
        type: 'sse',
        name: 'local-sse-server',
        url: 'http://localhost:3000/sse',
      };

      // Using default mocks from beforeEach

      const result = await createSSEClient(config);

      expect(mockSSETransport).toHaveBeenCalledWith(
        new URL('http://localhost:3000/sse')
      );
      expect(result).toBeDefined();
    });

    it('should create SSE client with HTTPS URL', async () => {
      const config: SSEMCPServerConfig = {
        type: 'sse',
        name: 'secure-sse-server',
        url: 'https://api.example.com/mcp/sse',
      };

      // Using default mocks from beforeEach

      await createSSEClient(config);

      expect(mockSSETransport).toHaveBeenCalledWith(
        new URL('https://api.example.com/mcp/sse')
      );
    });

    it('should handle connection errors gracefully', async () => {
      const config: SSEMCPServerConfig = {
        type: 'sse',
        name: 'error-sse-server',
        url: 'https://example.com/sse',
      };

      const connectionError = new Error('SSE connection failed');
      const mockClientInstance = createMockClient();
      vi.mocked(mockClientInstance.connect).mockRejectedValue(connectionError);
      mockClient.mockImplementation(() => mockClientInstance);

      await expect(createSSEClient(config)).rejects.toThrow(
        'SSE connection failed'
      );
    });

    it('should handle invalid URL format', async () => {
      const config: SSEMCPServerConfig = {
        type: 'sse',
        name: 'invalid-url-server',
        url: 'not-a-valid-url',
      };

      // URL constructor should throw for invalid URLs
      expect(() => new URL(config.url)).toThrow();

      await expect(createSSEClient(config)).rejects.toThrow();
    });

    it('should create client with proper capabilities configuration', async () => {
      const config: SSEMCPServerConfig = {
        type: 'sse',
        name: 'capabilities-test-server',
        url: 'https://example.com/sse',
      };

      // Using default mocks from beforeEach

      await createSSEClient(config);

      expect(mockClient).toHaveBeenCalledWith(
        {
          name: 'envoy-capabilities-test-server',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            prompts: {},
            resources: {},
          },
        }
      );
    });

    it('should use server name in client name prefix', async () => {
      const config: SSEMCPServerConfig = {
        type: 'sse',
        name: 'my-custom-server',
        url: 'https://example.com/sse',
      };

      // Using default mocks from beforeEach

      await createSSEClient(config);

      expect(mockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'envoy-my-custom-server',
        }),
        expect.any(Object)
      );
    });

    it('should handle URL constructor errors', async () => {
      const config: SSEMCPServerConfig = {
        type: 'sse',
        name: 'malformed-url-server',
        url: '',
      };

      await expect(createSSEClient(config)).rejects.toThrow();
    });
  });
});
