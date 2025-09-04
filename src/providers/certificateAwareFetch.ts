/**
 * Certificate-aware fetch implementation that automatically handles NODE_EXTRA_CA_CERTS
 * This enables support for corporate proxies with self-signed certificates across all AI providers
 */

import { Agent } from 'undici';
import { readFileSync } from 'fs';
import { logger } from '../logger.js';

/**
 * Creates an undici Agent with CA certificates from NODE_EXTRA_CA_CERTS
 * Returns undefined if no certificates are needed
 */
function createGlobalAgent(): Agent | undefined {
  if (!process.env.NODE_EXTRA_CA_CERTS) {
    return undefined;
  }

  try {
    const caCerts = readFileSync(process.env.NODE_EXTRA_CA_CERTS, 'utf-8');
    logger.debug('Creating certificate-aware agent with NODE_EXTRA_CA_CERTS', {
      filePath: process.env.NODE_EXTRA_CA_CERTS,
    });

    return new Agent({
      connect: {
        ca: [caCerts],
      },
    });
  } catch (error) {
    logger.warn('Failed to read NODE_EXTRA_CA_CERTS', {
      filePath: process.env.NODE_EXTRA_CA_CERTS,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Creates a fetch function that automatically handles NODE_EXTRA_CA_CERTS
 * This works for all providers and corporate proxies with self-signed certificates
 */
export function createCertificateAwareFetch() {
  const agent = createGlobalAgent();

  if (agent) {
    return (input: string | URL | Request, init?: RequestInit) => {
      return fetch(input, {
        ...init,
        dispatcher: agent as unknown as RequestInit['dispatcher'], // Use unknown cast for undici compatibility
      });
    };
  }

  return fetch; // Use default fetch if no certificates needed
}
