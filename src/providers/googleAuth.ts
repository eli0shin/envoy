/**
 * Google authentication wrapper for flexible header handling
 * Supports API key and Bearer token authentication methods
 */

import { logger } from '../logger.js';

type GoogleAuthOptions = {
  apiKey?: string;
  authType: 'api-key' | 'bearer';
  customHeaders?: Record<string, string>;
  disableDefaultAuth?: boolean;
};

/**
 * Creates Google provider configuration with custom authentication
 */
export function createGoogleAuthConfig(options: GoogleAuthOptions): {
  apiKey?: string;
  headers?: Record<string, string>;
} {
  const config: { apiKey?: string; headers: Record<string, string> } = {
    headers: {},
  };

  logger.debug('Google auth configuration setup', {
    authType: options.authType,
    hasApiKey: !!options.apiKey,
    disableDefaultAuth: options.disableDefaultAuth,
    hasCustomHeaders: !!options.customHeaders,
  });

  // Handle authentication based on type
  if (!options.disableDefaultAuth && options.apiKey) {
    if (options.authType === 'bearer') {
      config.headers.Authorization = `Bearer ${options.apiKey}`;
      logger.debug('Using Bearer token authentication', {
        authType: 'bearer',
        keyLength: options.apiKey.length,
      });
    } else {
      // Default to API key method
      config.apiKey = options.apiKey;
      logger.debug('Using API key authentication', {
        authType: 'api-key',
        keyLength: options.apiKey.length,
      });
    }
  }

  // Add custom headers
  if (options.customHeaders) {
    logger.debug('Adding custom headers', {
      customHeaderCount: Object.keys(options.customHeaders).length,
      customHeaderKeys: Object.keys(options.customHeaders),
    });
    Object.entries(options.customHeaders).forEach(([key, value]) => {
      config.headers[key] = value;
    });
  }

  logger.debug('Google auth configuration complete', {
    hasApiKey: !!config.apiKey,
    headerCount: Object.keys(config.headers).length,
    headerKeys: Object.keys(config.headers),
  });

  return config;
}
