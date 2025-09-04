/**
 * Tests for Anthropic OAuth functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as AnthropicOAuth from './anthropicOAuth.js';
import * as CredentialStore from './credentialStore.js';
import { generatePKCE } from '@openauthjs/openauth/pkce';
import {
  createMockFetch,
  createMockResponse,
} from '../test/helpers/createMocks.js';

// Mock dependencies
vi.mock('./credentialStore.js');
vi.mock('@openauthjs/openauth/pkce');

// Mock fetch globally
const mockFetch = createMockFetch();

describe('AnthropicOAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('authorize', () => {
    it('should generate authorization URL with correct parameters', async () => {
      const mockPKCE = {
        challenge: 'test-challenge',
        verifier: 'test-verifier',
        method: 'S256',
      };

      // Mock the PKCE generation
      vi.mocked(generatePKCE).mockResolvedValue(mockPKCE);

      const result = await AnthropicOAuth.authorize();

      expect(result.verifier).toBe('test-verifier');
      expect(result.url).toContain('claude.ai/oauth/authorize');
      expect(result.url).toContain(
        'client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e'
      );
      expect(result.url).toContain('code_challenge=test-challenge');
      expect(result.url).toContain('code_challenge_method=S256');
      expect(result.url).toContain('scope=org%3Acreate_api_key');
    });
  });

  describe('exchange', () => {
    it('should exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
      };

      mockFetch.mockResolvedValue(createMockResponse(mockTokenResponse));

      const mockCredentialStoreSet = vi.mocked(CredentialStore.set);

      await AnthropicOAuth.exchange('test-code#test-state', 'test-verifier');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://console.anthropic.com/v1/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"code":"test-code"'),
        })
      );

      expect(mockCredentialStoreSet).toHaveBeenCalledWith('anthropic', {
        type: 'oauth',
        access: 'test-access-token',
        refresh: 'test-refresh-token',
        expires: expect.any(Number),
      });
    });

    it('should throw error on failed token exchange', async () => {
      mockFetch.mockResolvedValue(createMockResponse('Invalid code', 400));

      await expect(
        AnthropicOAuth.exchange('invalid-code', 'test-verifier')
      ).rejects.toThrow('Token exchange failed: "Invalid code"');
    });
  });

  describe('getAccessToken', () => {
    it('should return valid access token', async () => {
      const mockCredentials = {
        type: 'oauth' as const,
        access: 'valid-token',
        refresh: 'refresh-token',
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes from now
      };

      vi.mocked(CredentialStore.get).mockResolvedValue(mockCredentials);

      const token = await AnthropicOAuth.getAccessToken();
      expect(token).toBe('valid-token');
    });

    it('should refresh expired token', async () => {
      const expiredCredentials = {
        type: 'oauth' as const,
        access: 'expired-token',
        refresh: 'refresh-token',
        expires: Date.now() - 1000, // 1 second ago
      };

      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      };

      vi.mocked(CredentialStore.get)
        .mockResolvedValueOnce(expiredCredentials)
        .mockResolvedValueOnce(expiredCredentials); // Called again in refreshToken

      mockFetch.mockResolvedValue(createMockResponse(mockTokenResponse));

      const token = await AnthropicOAuth.getAccessToken();
      expect(token).toBe('new-access-token');
    });

    it('should return undefined for non-oauth credentials', async () => {
      const apiKeyCredentials = {
        type: 'api' as const,
        key: 'api-key',
      };

      vi.mocked(CredentialStore.get).mockResolvedValue(apiKeyCredentials);

      const token = await AnthropicOAuth.getAccessToken();
      expect(token).toBeUndefined();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when valid OAuth token exists', async () => {
      const mockCredentials = {
        type: 'oauth' as const,
        access: 'valid-token',
        refresh: 'refresh-token',
        expires: Date.now() + 10 * 60 * 1000,
      };

      vi.mocked(CredentialStore.get).mockResolvedValue(mockCredentials);

      const isAuth = await AnthropicOAuth.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it('should return false when no credentials exist', async () => {
      vi.mocked(CredentialStore.get).mockResolvedValue(undefined);

      const isAuth = await AnthropicOAuth.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  describe('hasOAuthCredentials', () => {
    it('should return true when OAuth credentials exist', async () => {
      const mockCredentials = {
        type: 'oauth' as const,
        access: 'access-token',
        refresh: 'refresh-token',
        expires: Date.now() + 3600000,
      };

      vi.mocked(CredentialStore.get).mockResolvedValue(mockCredentials);

      const result = await AnthropicOAuth.hasOAuthCredentials();
      expect(result).toBe(true);
    });

    it('should return false when no credentials exist', async () => {
      vi.mocked(CredentialStore.get).mockResolvedValue(undefined);

      const result = await AnthropicOAuth.hasOAuthCredentials();
      expect(result).toBe(false);
    });

    it('should return false when non-oauth credentials exist', async () => {
      const apiKeyCredentials = {
        type: 'api' as const,
        key: 'api-key',
      };

      vi.mocked(CredentialStore.get).mockResolvedValue(apiKeyCredentials);

      const result = await AnthropicOAuth.hasOAuthCredentials();
      expect(result).toBe(false);
    });
  });

  describe('logout', () => {
    it('should remove stored credentials and affect authentication status', async () => {
      // Set up initial authenticated state
      const initialCredentials = {
        type: 'oauth' as const,
        access: 'test-token',
        refresh: 'refresh-token',
        expires: Date.now() + 3600000,
      };

      vi.mocked(CredentialStore.get).mockResolvedValue(initialCredentials);

      // Verify initially authenticated
      const initialAuth = await AnthropicOAuth.isAuthenticated();
      expect(initialAuth).toBe(true);

      // Mock the removal and subsequent get calls
      const mockCredentialStoreRemove = vi.mocked(CredentialStore.remove);
      vi.mocked(CredentialStore.get).mockResolvedValue(undefined);

      await AnthropicOAuth.logout();

      // Verify credentials were removed
      expect(mockCredentialStoreRemove).toHaveBeenCalledWith('anthropic');

      // Verify authentication status after logout
      const postLogoutAuth = await AnthropicOAuth.isAuthenticated();
      expect(postLogoutAuth).toBe(false);
    });

    it('should handle logout when no credentials exist', async () => {
      vi.mocked(CredentialStore.get).mockResolvedValue(undefined);
      const mockCredentialStoreRemove = vi.mocked(CredentialStore.remove);

      await AnthropicOAuth.logout();

      expect(mockCredentialStoreRemove).toHaveBeenCalledWith('anthropic');
    });
  });
});
