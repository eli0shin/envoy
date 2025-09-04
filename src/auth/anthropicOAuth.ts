/**
 * Anthropic OAuth 2.0 PKCE implementation
 * Handles OAuth flow for Claude Pro/Max authentication
 */

import { generatePKCE } from '@openauthjs/openauth/pkce';
import * as CredentialStore from './credentialStore.js';
import { logger } from '../logger.js';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTHORIZATION_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const SCOPES = 'org:create_api_key user:profile user:inference';

/**
 * Initiate OAuth authorization flow
 * @returns Authorization URL and PKCE verifier
 */
export async function authorize(): Promise<{
  url: string;
  verifier: string;
}> {
  const pkce = await generatePKCE();
  const url = new URL(AUTHORIZATION_URL, import.meta.url);

  url.searchParams.set('code', 'true');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', pkce.verifier);

  return {
    url: url.toString(),
    verifier: pkce.verifier,
  };
}

/**
 * Exchange authorization code for tokens
 * @param code Authorization code from callback
 * @param verifier PKCE verifier from authorization step
 */
export async function exchange(code: string, verifier: string): Promise<void> {
  const splits = code.split('#');
  const authCode = splits[0];
  const state = splits[1];

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: authCode,
      state,
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ExchangeFailedError(`Token exchange failed: ${errorText}`);
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await CredentialStore.set('anthropic', {
    type: 'oauth',
    access: tokenData.access_token,
    refresh: tokenData.refresh_token,
    expires: Date.now() + tokenData.expires_in * 1000,
  });
}

/**
 * Get current valid access token
 * Automatically refreshes if expired
 * @returns Valid access token or undefined if not available
 */
export async function getAccessToken(): Promise<string | undefined> {
  const credentials = await CredentialStore.get('anthropic');

  if (!credentials || credentials.type !== 'oauth') {
    logger.debug('No OAuth credentials available', {
      hasCredentials: !!credentials,
      credentialType: credentials?.type || 'none',
    });
    return undefined;
  }

  const timeUntilExpiry = credentials.expires - Date.now();
  const isExpired = timeUntilExpiry <= 0;

  logger.debug('OAuth token status check', {
    hasAccessToken: !!credentials.access,
    hasRefreshToken: !!credentials.refresh,
    timeUntilExpiry,
    isExpired,
    expiresAt: new Date(credentials.expires).toISOString(),
  });

  // Return current token if still valid (no expiration buffer)
  if (credentials.access && credentials.expires > Date.now()) {
    logger.debug('Using existing valid OAuth token');
    return credentials.access;
  }

  // Try to refresh the token
  logger.debug('Attempting token refresh');
  return await refreshToken();
}

/**
 * Refresh access token using refresh token
 * @returns New access token or undefined if refresh failed
 */
export async function refreshToken(): Promise<string | undefined> {
  const credentials = await CredentialStore.get('anthropic');

  if (!credentials || credentials.type !== 'oauth') {
    logger.debug('Cannot refresh token', {
      hasCredentials: !!credentials,
      credentialType: credentials?.type || 'none',
      reason: 'no oauth credentials',
    });
    return undefined;
  }

  if (!credentials.refresh) {
    logger.debug('Cannot refresh token', {
      credentialType: credentials.type,
      hasRefreshToken: false,
      reason: 'no refresh token',
    });
    return undefined;
  }

  logger.debug('Starting token refresh process', {
    refreshTokenLength: credentials.refresh.length,
  });

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: credentials.refresh,
        client_id: CLIENT_ID,
      }),
    });

    if (!response.ok) {
      // Return undefined on failure, preserve stored credentials
      logger.warn('Token refresh failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return undefined;
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Update stored credentials
    await CredentialStore.set('anthropic', {
      type: 'oauth',
      access: tokenData.access_token,
      refresh: tokenData.refresh_token,
      expires: Date.now() + tokenData.expires_in * 1000,
    });

    logger.info('OAuth token refreshed successfully', {
      newTokenLength: tokenData.access_token.length,
      expiresIn: tokenData.expires_in,
      newExpiresAt: new Date(
        Date.now() + tokenData.expires_in * 1000
      ).toISOString(),
    });

    return tokenData.access_token;
  } catch (error) {
    // Return undefined on error, preserve stored credentials
    logger.warn('Token refresh error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Check if user has valid OAuth credentials
 * @returns True if OAuth credentials are available and valid
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== undefined;
}

/**
 * Check if user has OAuth credentials stored (regardless of validity)
 * @returns True if OAuth credentials exist in storage
 */
export async function hasOAuthCredentials(): Promise<boolean> {
  const credentials = await CredentialStore.get('anthropic');
  return credentials?.type === 'oauth';
}

/**
 * Remove OAuth credentials (logout)
 */
export async function logout(): Promise<void> {
  await CredentialStore.remove('anthropic');
}

export class ExchangeFailedError extends Error {
  constructor(message: string = 'OAuth token exchange failed') {
    super(message);
    this.name = 'ExchangeFailedError';
  }
}
