/**
 * Tests for thinking integration header setup in anthropicAuth
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAnthropicAuthFetch } from './anthropicAuth.js';
import { AnthropicOAuth } from '../auth/index.js';
import {
  createMockFetch,
  createMockResponse,
} from '../test/helpers/createMocks.js';

// Mock the AnthropicOAuth module
vi.mock('../auth/index.js', () => ({
  AnthropicOAuth: {
    getAccessToken: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = createMockFetch();

describe('Anthropic Auth Thinking Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(createMockResponse({}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('anthropic-beta header handling', () => {
    it('should preserve existing anthropic-beta header when using API key', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-api-key',
        authType: 'x-api-key',
      });

      const requestInit = {
        headers: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
          'content-type': 'application/json',
        },
      };

      await authFetch('https://api.anthropic.com/v1/messages', requestInit);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'interleaved-thinking-2025-05-14',
            'x-api-key': 'test-api-key',
            'content-type': 'application/json',
          }),
        })
      );
    });

    it('should handle comma-separated anthropic-beta headers with OAuth', async () => {
      vi.mocked(AnthropicOAuth.getAccessToken).mockResolvedValue(
        'oauth-token-123'
      );

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'fallback-key',
        authType: 'oauth',
        enableOAuth: true,
      });

      const requestInit = {
        headers: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
      };

      await authFetch('https://api.anthropic.com/v1/messages', requestInit);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta':
              'interleaved-thinking-2025-05-14,oauth-2025-04-20',
            authorization: 'Bearer oauth-token-123',
          }),
        })
      );

      // Should not have x-api-key when using OAuth
      const calledHeaders = mockFetch.mock.calls[0][1].headers;
      expect(calledHeaders).not.toHaveProperty('x-api-key');
    });

    it('should handle OAuth-only anthropic-beta header when no existing header', async () => {
      vi.mocked(AnthropicOAuth.getAccessToken).mockResolvedValue(
        'oauth-token-456'
      );

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'fallback-key',
        authType: 'oauth',
        enableOAuth: true,
      });

      const requestInit = {
        headers: {
          'content-type': 'application/json',
        },
      };

      await authFetch('https://api.anthropic.com/v1/messages', requestInit);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'oauth-2025-04-20',
            authorization: 'Bearer oauth-token-456',
            'content-type': 'application/json',
          }),
        })
      );
    });

    it('should not duplicate OAuth beta header if already present', async () => {
      vi.mocked(AnthropicOAuth.getAccessToken).mockResolvedValue(
        'oauth-token-789'
      );

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'fallback-key',
        authType: 'oauth',
        enableOAuth: true,
      });

      const requestInit = {
        headers: {
          'anthropic-beta': 'oauth-2025-04-20',
        },
      };

      await authFetch('https://api.anthropic.com/v1/messages', requestInit);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'oauth-2025-04-20',
            authorization: 'Bearer oauth-token-789',
          }),
        })
      );
    });

    it('should handle multiple comma-separated beta headers correctly', async () => {
      vi.mocked(AnthropicOAuth.getAccessToken).mockResolvedValue(
        'oauth-token-multi'
      );

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'fallback-key',
        authType: 'oauth',
        enableOAuth: true,
      });

      const requestInit = {
        headers: {
          'anthropic-beta':
            'interleaved-thinking-2025-05-14,some-other-feature-2024-12-01',
        },
      };

      await authFetch('https://api.anthropic.com/v1/messages', requestInit);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta':
              'interleaved-thinking-2025-05-14,some-other-feature-2024-12-01,oauth-2025-04-20',
            authorization: 'Bearer oauth-token-multi',
          }),
        })
      );
    });

    it('should fall back to API key when OAuth fails and preserve thinking headers', async () => {
      vi.mocked(AnthropicOAuth.getAccessToken).mockRejectedValue(
        new Error('OAuth failed')
      );

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'fallback-api-key',
        authType: 'oauth',
        enableOAuth: true,
      });

      const requestInit = {
        headers: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
      };

      await authFetch('https://api.anthropic.com/v1/messages', requestInit);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'interleaved-thinking-2025-05-14',
            'x-api-key': 'fallback-api-key',
          }),
        })
      );

      // Should not have authorization header when OAuth failed
      const calledHeaders = mockFetch.mock.calls[0][1].headers;
      expect(calledHeaders).not.toHaveProperty('authorization');
    });
  });

  describe('custom headers with thinking integration', () => {
    it('should merge custom headers with thinking headers', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'test-key',
        authType: 'x-api-key',
        customHeaders: {
          'x-custom-thinking': 'enabled',
          'x-request-id': 'req-123',
        },
      });

      const requestInit = {
        headers: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
      };

      await authFetch('https://api.anthropic.com/v1/messages', requestInit);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'interleaved-thinking-2025-05-14',
            'x-api-key': 'test-key',
            'x-custom-thinking': 'enabled',
            'x-request-id': 'req-123',
          }),
        })
      );
    });

    it('should handle OAuth headers alongside thinking headers', async () => {
      vi.mocked(AnthropicOAuth.getAccessToken).mockResolvedValue('oauth-token');

      const authFetch = createAnthropicAuthFetch({
        apiKey: 'fallback-key',
        authType: 'oauth',
        enableOAuth: true,
        oauthHeaders: {
          'x-oauth-scope': 'thinking',
        },
      });

      const requestInit = {
        headers: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
      };

      await authFetch('https://api.anthropic.com/v1/messages', requestInit);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta':
              'interleaved-thinking-2025-05-14,oauth-2025-04-20',
            authorization: 'Bearer oauth-token',
            'x-oauth-scope': 'thinking',
          }),
        })
      );
    });
  });

  describe('error handling with thinking headers', () => {
    it('should throw error when no auth and thinking headers are present', async () => {
      const authFetch = createAnthropicAuthFetch({
        authType: 'x-api-key',
      });

      const requestInit = {
        headers: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
      };

      await expect(
        authFetch('https://api.anthropic.com/v1/messages', requestInit)
      ).rejects.toThrow(
        'No valid authentication found. Please run: npx . auth login'
      );
    });

    it('should not fail when disableDefaultAuth is true with thinking headers', async () => {
      const authFetch = createAnthropicAuthFetch({
        authType: 'x-api-key',
        disableDefaultAuth: true,
      });

      const requestInit = {
        headers: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
      };

      await authFetch('https://api.anthropic.com/v1/messages', requestInit);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'interleaved-thinking-2025-05-14',
          }),
        })
      );

      // Should not add any auth headers
      const calledHeaders = mockFetch.mock.calls[0][1].headers;
      expect(calledHeaders).not.toHaveProperty('x-api-key');
      expect(calledHeaders).not.toHaveProperty('authorization');
    });
  });

  describe('bearer token authentication with thinking', () => {
    it('should use Bearer token with thinking headers', async () => {
      const authFetch = createAnthropicAuthFetch({
        apiKey: 'bearer-token-123',
        authType: 'bearer',
      });

      const requestInit = {
        headers: {
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
      };

      await authFetch('https://api.anthropic.com/v1/messages', requestInit);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'interleaved-thinking-2025-05-14',
            Authorization: 'Bearer bearer-token-123',
          }),
        })
      );
    });
  });
});
