import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGoogleAuthConfig } from './googleAuth.js';
import { logger } from '../logger.js';

describe('googleAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGoogleAuthConfig', () => {
    it('should create API key configuration', () => {
      const options = {
        apiKey: 'test-api-key',
        authType: 'api-key' as const,
      };

      const config = createGoogleAuthConfig(options);

      expect(config).toEqual({
        apiKey: 'test-api-key',
        headers: {},
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Google auth configuration setup',
        {
          authType: 'api-key',
          hasApiKey: true,
          disableDefaultAuth: undefined,
          hasCustomHeaders: false,
        }
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'Using API key authentication',
        {
          authType: 'api-key',
          keyLength: 12,
        }
      );
    });

    it('should create Bearer token configuration', () => {
      const options = {
        apiKey: 'test-bearer-token',
        authType: 'bearer' as const,
      };

      const config = createGoogleAuthConfig(options);

      expect(config).toEqual({
        headers: {
          Authorization: 'Bearer test-bearer-token',
        },
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Using Bearer token authentication',
        {
          authType: 'bearer',
          keyLength: 17, // Correct length
        }
      );
    });

    it('should handle disabled default auth', () => {
      const options = {
        apiKey: 'test-api-key',
        authType: 'api-key' as const,
        disableDefaultAuth: true,
      };

      const config = createGoogleAuthConfig(options);

      expect(config).toEqual({
        headers: {},
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Google auth configuration setup',
        {
          authType: 'api-key',
          hasApiKey: true,
          disableDefaultAuth: true,
          hasCustomHeaders: false,
        }
      );

      // Should not call authentication setup methods when disabled
      expect(logger.debug).not.toHaveBeenCalledWith(
        'Using API key authentication',
        expect.any(Object)
      );
    });

    it('should add custom headers', () => {
      const options = {
        apiKey: 'test-api-key',
        authType: 'api-key' as const,
        customHeaders: {
          'X-Custom-Header': 'custom-value',
          'X-Another-Header': 'another-value',
        },
      };

      const config = createGoogleAuthConfig(options);

      expect(config).toEqual({
        apiKey: 'test-api-key',
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-Another-Header': 'another-value',
        },
      });

      expect(logger.debug).toHaveBeenCalledWith('Adding custom headers', {
        customHeaderCount: 2,
        customHeaderKeys: ['X-Custom-Header', 'X-Another-Header'],
      });
    });

    it('should combine Bearer auth with custom headers', () => {
      const options = {
        apiKey: 'test-bearer-token',
        authType: 'bearer' as const,
        customHeaders: {
          'X-Custom-Header': 'custom-value',
        },
      };

      const config = createGoogleAuthConfig(options);

      expect(config).toEqual({
        headers: {
          Authorization: 'Bearer test-bearer-token',
          'X-Custom-Header': 'custom-value',
        },
      });
    });

    it('should handle missing API key', () => {
      const options = {
        authType: 'api-key' as const,
      };

      const config = createGoogleAuthConfig(options);

      expect(config).toEqual({
        headers: {},
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Google auth configuration setup',
        {
          authType: 'api-key',
          hasApiKey: false,
          disableDefaultAuth: undefined,
          hasCustomHeaders: false,
        }
      );
    });

    it('should handle Bearer auth with missing API key', () => {
      const options = {
        authType: 'bearer' as const,
      };

      const config = createGoogleAuthConfig(options);

      expect(config).toEqual({
        headers: {},
      });

      // Should not add Authorization header without API key
      expect(config.headers?.Authorization).toBeUndefined();
    });

    it('should allow custom headers to override auth headers', () => {
      const options = {
        apiKey: 'test-bearer-token',
        authType: 'bearer' as const,
        customHeaders: {
          Authorization: 'Bearer old-token', // Will override the auth header
          'X-Custom-Header': 'custom-value',
        },
      };

      const config = createGoogleAuthConfig(options);

      // Custom headers come last and override auth headers
      expect(config.headers?.['X-Custom-Header']).toBe('custom-value');
      expect(config.headers?.['Authorization']).toBe('Bearer old-token');
    });

    it('should log configuration completion', () => {
      const options = {
        apiKey: 'test-api-key',
        authType: 'api-key' as const,
        customHeaders: {
          'X-Custom-Header': 'custom-value',
        },
      };

      createGoogleAuthConfig(options);

      expect(logger.debug).toHaveBeenCalledWith(
        'Google auth configuration complete',
        {
          hasApiKey: true,
          headerCount: 1,
          headerKeys: ['X-Custom-Header'],
        }
      );
    });
  });
});
