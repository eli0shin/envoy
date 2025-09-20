/**
 * Unit tests for Anthropic authentication wrapper
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnthropicAuthFetch } from './anthropicAuth.js';
import { AnthropicOAuth } from '../auth/index.js';
import {
  createMockFetch,
  createMockResponse,
} from '../test/helpers/createMocks.js';

// Mock dependencies
const mockFetch = createMockFetch();

// Mock AnthropicOAuth
vi.mock('../auth/index.js', () => ({
  AnthropicOAuth: {
    getAccessToken: vi.fn(),
  },
}));

describe('createAnthropicAuthFetch', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue(createMockResponse({}));
    vi.clearAllMocks();
  });

  describe('x-api-key authentication (default)', () => {
    it('should use x-api-key header by default', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
          }),
        })
      );

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('x-api-key')).toBe('test-api-key');
      expect(headers.get('Authorization')).toBeNull();
    });

    it('should preserve existing headers while adding x-api-key', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
      });

      await authFetch('https://api.anthropic.com/v1/messages', {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'test-agent',
        },
      });

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('x-api-key')).toBe('test-api-key');
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('User-Agent')).toBe('test-agent');
    });
  });

  describe('Bearer token authentication', () => {
    it('should use Authorization header with Bearer token', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'bearer',
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('Authorization')).toBe('Bearer test-api-key');
      expect(headers.get('x-api-key')).toBeNull();
    });

    it('should preserve existing headers while adding Authorization', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'bearer',
      });

      await authFetch('https://api.anthropic.com/v1/messages', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('Authorization')).toBe('Bearer test-api-key');
      expect(headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('custom headers', () => {
    it('should add custom headers', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
        customHeaders: {
          'X-Custom-Header': 'custom-value',
          'X-Request-ID': 'request-123',
        },
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('x-api-key')).toBe('test-api-key');
      expect(headers.get('X-Custom-Header')).toBe('custom-value');
      expect(headers.get('X-Request-ID')).toBe('request-123');
    });

    it('should add custom headers with Bearer auth', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'bearer',
        customHeaders: {
          'X-Proxy-Token': 'proxy-token',
        },
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('Authorization')).toBe('Bearer test-api-key');
      expect(headers.get('X-Proxy-Token')).toBe('proxy-token');
      expect(headers.get('x-api-key')).toBeNull();
    });

    it('should override existing headers with custom headers', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
        customHeaders: {
          'Content-Type': 'application/custom',
        },
      });

      await authFetch('https://api.anthropic.com/v1/messages', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('Content-Type')).toBe('application/custom');
    });
  });

  describe('disable default auth', () => {
    it('should not add x-api-key when default auth is disabled', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
        disableDefaultAuth: true,
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('x-api-key')).toBeNull();
      expect(headers.get('Authorization')).toBeNull();
    });

    it('should not add Authorization when default auth is disabled', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'bearer',
        disableDefaultAuth: true,
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('Authorization')).toBeNull();
      expect(headers.get('x-api-key')).toBeNull();
    });

    it('should still add custom headers when default auth is disabled', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
        disableDefaultAuth: true,
        customHeaders: {
          'X-Custom-Auth': 'custom-auth-token',
        },
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('x-api-key')).toBeNull();
      expect(headers.get('Authorization')).toBeNull();
      expect(headers.get('X-Custom-Auth')).toBe('custom-auth-token');
    });
  });

  describe('request options preservation', () => {
    it('should preserve request method and body', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
      });

      const requestBody = JSON.stringify({ message: 'test' });
      await authFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        body: requestBody,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          body: requestBody,
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
          }),
        })
      );
    });

    it('should handle empty init object', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
      });

      await authFetch('https://api.anthropic.com/v1/messages', {});

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
          }),
        })
      );
    });

    it('should handle undefined init parameter', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
          }),
        })
      );
    });
  });

  describe('OAuth authentication', () => {
    it('should use OAuth token when available', async () => {
      const mockGetAccessToken = vi.mocked(AnthropicOAuth.getAccessToken);
      mockGetAccessToken.mockResolvedValue('oauth-access-token');

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'fallback-api-key',
        authType: 'oauth',
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('authorization')).toBe('Bearer oauth-access-token');
      expect(headers.get('Anthropic-Beta')).toBe(
        'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'
      );
      expect(headers.get('x-api-key')).toBeNull();
    });

    it('should fallback to API key when OAuth token not available', async () => {
      const mockGetAccessToken = vi.mocked(AnthropicOAuth.getAccessToken);
      mockGetAccessToken.mockResolvedValue(undefined);

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'fallback-api-key',
        authType: 'oauth',
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('x-api-key')).toBe('fallback-api-key');
      expect(headers.get('authorization')).toBeNull();
    });

    it('should handle OAuth errors gracefully and fallback to API key', async () => {
      const mockGetAccessToken = vi.mocked(AnthropicOAuth.getAccessToken);
      mockGetAccessToken.mockRejectedValue(new Error('OAuth failed'));

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'fallback-api-key',
        authType: 'oauth',
      });

      await authFetch('https://api.anthropic.com/v1/messages');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('x-api-key')).toBe('fallback-api-key');
      expect(headers.get('authorization')).toBeNull();
    });

    it('should merge anthropic-beta headers when using OAuth', async () => {
      const mockGetAccessToken = vi.mocked(AnthropicOAuth.getAccessToken);
      mockGetAccessToken.mockResolvedValue('oauth-token');

      const authFetch = createAnthropicAuthFetch({
        authType: 'oauth',
      });

      await authFetch('https://api.anthropic.com/v1/messages', {
        headers: {
          'anthropic-beta': 'existing-feature-2024-01-01',
        },
      });

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('authorization')).toBe('Bearer oauth-token');
      // OAuth should merge the original anthropic-beta header with OAuth headers
      expect(headers.get('anthropic-beta')).toBe(
        'existing-feature-2024-01-01, claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'
      );
    });
  });

  describe('authentication failure scenarios', () => {
    it('should throw error when no API key and OAuth fails', async () => {
      const mockGetAccessToken = vi.mocked(AnthropicOAuth.getAccessToken);
      mockGetAccessToken.mockResolvedValue(undefined);

      const authFetch = createAnthropicAuthFetch({
        authType: 'oauth',
      });

      await expect(
        authFetch('https://api.anthropic.com/v1/messages')
      ).rejects.toThrow(
        'OAuth authentication failed. Please run: npx . auth login'
      );
    });

    it('should throw error when no authentication method available', async () => {
      const authFetch = createAnthropicAuthFetch({
        authType: 'x-api-key',
      });

      await expect(
        authFetch('https://api.anthropic.com/v1/messages')
      ).rejects.toThrow(
        'No valid authentication found. Please run: npx . auth login'
      );
    });
  });

  describe('error handling', () => {
    it('should propagate fetch errors', async () => {
      const error = new Error('Network error');
      mockFetch.mockRejectedValue(error);

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
      });

      await expect(
        authFetch('https://api.anthropic.com/v1/messages')
      ).rejects.toThrow('Network error');
    });

    it('should return responses as-is', async () => {
      const mockResponse = createMockResponse({ result: 'success' });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
      });

      const response = await authFetch('https://api.anthropic.com/v1/messages');
      expect(response).toBe(mockResponse);
    });
  });
});
