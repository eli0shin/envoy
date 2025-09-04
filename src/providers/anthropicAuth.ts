/**
 * Anthropic authentication wrapper for flexible header handling
 * Supports x-api-key, Bearer token, and OAuth authentication methods
 */

import { AnthropicOAuth } from '../auth/index.js';
import { logger } from '../logger.js';

type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type AuthOptions = {
  apiKey?: string;
  authType: 'x-api-key' | 'bearer' | 'oauth';
  customHeaders?: Record<string, string>;
  disableDefaultAuth?: boolean;
  enableOAuth?: boolean;
  preferOAuth?: boolean;
  oauthHeaders?: Record<string, string>;
  baseFetch?: typeof fetch;
};

/**
 * Creates a custom fetch function that handles different authentication methods
 * for the Anthropic API, including Bearer tokens, OAuth, and custom headers
 */
export function createAnthropicAuthFetch(options: AuthOptions): FetchFunction {
  const baseFetch = options.baseFetch || fetch;

  return async (input: string | URL | Request, init: RequestInit = {}) => {
    // Preserve existing headers from AI SDK (including anthropic-version)
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };

    logger.debug('Anthropic auth fetch initialization', {
      url: typeof input === 'string' ? input : input.toString(),
      authType: options.authType,
      enableOAuth: options.enableOAuth,
      preferOAuth: options.preferOAuth,
      disableDefaultAuth: options.disableDefaultAuth,
      hasApiKey: !!options.apiKey,
      hasCustomHeaders: !!options.customHeaders,
      hasOauthHeaders: !!options.oauthHeaders,
      initialHeaders: Object.keys(headers),
    });

    // Handle authentication based on type and preferences
    if (!options.disableDefaultAuth) {
      let authHandled = false;

      // Try OAuth first if enabled or preferred
      if (
        options.authType === 'oauth' ||
        options.enableOAuth ||
        options.preferOAuth
      ) {
        try {
          const oauthToken = await AnthropicOAuth.getAccessToken();
          if (oauthToken) {
            headers.authorization = `Bearer ${oauthToken}`;

            // Handle anthropic-beta header with comma-separated values
            const existingBeta = headers['anthropic-beta'];
            const oauthBeta = 'oauth-2025-04-20';
            if (existingBeta && existingBeta !== oauthBeta) {
              // Append OAuth beta to existing beta headers
              headers['anthropic-beta'] = `${existingBeta},${oauthBeta}`;
            } else {
              headers['anthropic-beta'] = oauthBeta;
            }

            // Remove x-api-key when using OAuth
            delete headers['x-api-key'];
            authHandled = true;

            logger.debug('OAuth authentication successful', {
              hasToken: true,
              tokenLength: oauthToken.length,
              hasOauthHeaders: !!options.oauthHeaders,
            });

            // Add OAuth-specific headers
            if (options.oauthHeaders) {
              Object.entries(options.oauthHeaders).forEach(([key, value]) => {
                headers[key] = value;
              });
            }
          } else {
            logger.debug('OAuth token not available', {
              reason: 'getAccessToken returned undefined',
            });
          }
        } catch (error) {
          // OAuth failed - log error and continue to fallback logic
          logger.warn('OAuth authentication failed', {
            error: error instanceof Error ? error.message : String(error),
            hasApiKeyFallback: !!options.apiKey,
          });
        }
      }

      // Fall back to API key if OAuth didn't work or wasn't preferred
      if (!authHandled && options.apiKey) {
        if (options.authType === 'bearer') {
          headers.Authorization = `Bearer ${options.apiKey}`;
          logger.debug('Using Bearer token authentication', {
            authType: 'bearer',
            keyLength: options.apiKey.length,
          });
        } else if (
          options.authType === 'x-api-key' ||
          options.authType === 'oauth'
        ) {
          // Use x-api-key for explicit x-api-key type or as OAuth fallback
          headers['x-api-key'] = options.apiKey;
          logger.debug('Using x-api-key authentication', {
            authType: options.authType,
            keyLength: options.apiKey.length,
            fallbackFromOAuth: options.authType === 'oauth',
          });
        }
        authHandled = true;
      }

      // Error if no authentication method worked
      if (!authHandled) {
        logger.error('No valid authentication method available', {
          hasApiKey: !!options.apiKey,
          authType: options.authType,
          enableOAuth: options.enableOAuth,
          preferOAuth: options.preferOAuth,
          disableDefaultAuth: options.disableDefaultAuth,
        });

        // If no API key was provided AND authType is oauth, show OAuth-specific error
        if (!options.apiKey && options.authType === 'oauth') {
          throw new Error(
            'OAuth authentication failed. Please run: npx . auth login'
          );
        } else {
          throw new Error(
            'No valid authentication found. Please run: npx . auth login'
          );
        }
      }
    } else {
      logger.debug('Default authentication disabled', {
        disableDefaultAuth: options.disableDefaultAuth,
      });
    }

    // Add custom headers (excluding OAuth headers which are handled above)
    if (options.customHeaders) {
      logger.debug('Adding custom headers', {
        customHeaderCount: Object.keys(options.customHeaders).length,
        customHeaderKeys: Object.keys(options.customHeaders),
      });
      Object.entries(options.customHeaders).forEach(([key, value]) => {
        headers[key] = value;
      });
    }

    logger.debug('Final authentication headers prepared', {
      finalHeaderKeys: Object.keys(headers),
      hasAuthHeader: !!(headers.authorization || headers['x-api-key']),
      hasAnthropicBeta: !!headers['anthropic-beta'],
    });

    return baseFetch(input, {
      ...init,
      headers,
    });
  };
}
