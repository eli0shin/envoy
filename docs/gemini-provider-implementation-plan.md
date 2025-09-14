# Gemini Provider Implementation Plan

## Overview

This document outlines the plan to add the official Google Gemini provider to the CLI AI Agent application and set it as the default provider with Gemini 2.5 Pro as the default model.

## Current State Analysis

### Existing Provider Setup

The application currently supports three providers:

- **OpenAI**: Uses `@ai-sdk/openai` with GPT-4.1 as default model
- **OpenRouter**: Uses `@openrouter/ai-sdk-provider` with `google/gemini-2.5-flash-preview-05-20` as default
- **Anthropic**: Uses `@ai-sdk/anthropic` with `claude-sonnet-4-20250514` as default

### Current Default Configuration

- Default provider: `openrouter`
- Default model: `google/gemini-2.5-flash-preview-05-20` (Gemini via OpenRouter)

### Architecture Patterns

1. **Configuration**: Provider settings defined in `configTypes.ts` with `ProvidersConfig` interface
2. **Provider Creation**: Switch statement in `agentSession.ts` `createModelProvider()` function
3. **Environment Variables**: Provider-specific API keys validated in `agent.ts`
4. **Dependencies**: Provider-specific AI SDK packages in `package.json`

## Goals

1. Add direct Google Gemini provider support using `@ai-sdk/google`
2. Set Gemini as the default provider
3. Use Gemini 2.5 Pro as the default model
4. Maintain backward compatibility with existing configurations
5. Follow established patterns for consistency

## Implementation Plan

### Phase 1: Add Dependencies

Add the official Google Generative AI provider package:

```json
{
  "dependencies": {
    "@ai-sdk/google": "^1.0.0"
  }
}
```

### Phase 2: Update Configuration Types

**File: `src/configTypes.ts`**

Add extended Google provider configuration interface:

```typescript
/**
 * Extended Google provider configuration with authentication options
 */
export interface GoogleProviderConfig extends ProviderConfig {
  authType?: 'api-key' | 'bearer'; // Default: 'api-key'
  customHeaders?: Record<string, string>; // Additional headers
  disableDefaultAuth?: boolean; // Skip default auth headers
}
```

Add Google provider to the `ProvidersConfig` interface:

```typescript
export interface ProvidersConfig {
  default?: string;
  openai?: ProviderConfig;
  openrouter?: ProviderConfig;
  anthropic?: AnthropicProviderConfig;
  google?: GoogleProviderConfig; // New addition with extended config
}
```

### Phase 3: Update Default Configuration

**File: `src/config.ts`**

Update the `getDefaultConfiguration()` function:

```typescript
return {
  mcpServers,
  providers: {
    default: 'google', // Changed from 'openrouter'
    openrouter: {
      model: 'google/gemini-2.5-flash-preview-05-20',
    },
    openai: {
      model: 'gpt-4.1',
    },
    anthropic: {
      model: 'claude-sonnet-4-20250514',
      authType: 'x-api-key',
    },
    google: {
      // New provider configuration
      model: 'gemini-2.5-pro',
    },
  },
  // ... rest of config
};
```

Update the runtime configuration defaults:

```typescript
providers: {
  default: (() => {
    const configProvider = configResult.config.providers?.default;
    const resolvedProvider = configProvider || 'google'; // Changed from 'anthropic'
    // ... logging
    return resolvedProvider;
  })(),
  // ... existing providers
  google: { // New provider defaults
    model: 'gemini-2.5-pro',
    ...configResult.config.providers?.google,
  },
  // ... rest of providers
},
```

### Phase 4: Create Google Authentication Module

**File: `src/providers/googleAuth.ts`** (New file)

Create Google-specific authentication wrapper similar to Anthropic:

```typescript
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
```

### Phase 5: Add Provider Creation Logic

**File: `src/agentSession.ts`**

Add imports for Google provider and auth:

```typescript
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGoogleAuthConfig } from './providers/googleAuth.js';
```

Add Google case to the `createModelProvider()` switch statement:

```typescript
case 'google':
  const googleConfig = config.providers.google;

  // Determine authentication strategy
  const apiKey = googleConfig?.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const authType = googleConfig?.authType || 'api-key';

  logger.debug('Google provider authentication analysis', {
    model,
    authType,
    hasApiKey: !!apiKey,
    hasConfigApiKey: !!googleConfig?.apiKey,
    hasEnvApiKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    disableDefaultAuth: !!googleConfig?.disableDefaultAuth,
    hasCustomHeaders: !!googleConfig?.customHeaders,
    baseURL: googleConfig?.baseURL || 'default',
  });

  // Create authentication configuration
  const authConfig = createGoogleAuthConfig({
    apiKey,
    authType,
    customHeaders: googleConfig?.customHeaders,
    disableDefaultAuth: googleConfig?.disableDefaultAuth,
  });

  // Create Google provider with authentication
  const googleProvider = createGoogleGenerativeAI({
    apiKey: authConfig.apiKey,
    baseURL: googleConfig?.baseURL,
    headers: Object.keys(authConfig.headers).length > 0 ? authConfig.headers : undefined,
  });

  logger.info('Google Gemini provider created successfully', {
    model,
    authStrategy: authType === 'bearer' ? 'Bearer Token' : 'API Key',
    baseURL: googleConfig?.baseURL || 'default',
    hasCustomHeaders: !!googleConfig?.customHeaders,
  });

  return googleProvider(model);
```

Update the default model fallback logic:

```typescript
const model =
  typeof providerConfig === 'object' && providerConfig.model ?
    providerConfig.model
  : defaultProvider === 'openrouter' ? 'google/gemini-2.5-flash-preview-05-20'
  : defaultProvider === 'anthropic' ? 'claude-sonnet-4-20250514'
  : defaultProvider === 'openai' ? 'o4-mini'
  : defaultProvider === 'google' ?
    'gemini-2.5-pro' // New fallback
  : 'gemini-2.5-pro'; // New default fallback
```

Update supported providers error message:

```typescript
logger.error('Unsupported provider specified', {
  provider: defaultProvider,
  supportedProviders: ['openai', 'openrouter', 'anthropic', 'google'],
});
throw new Error(
  `Unsupported provider: ${defaultProvider}. Supported providers are 'openai', 'openrouter', 'anthropic', and 'google'.`
);
```

### Phase 6: Add Environment Variable Validation

**File: `src/agent.ts`**

Add Google provider to the `validateEnvironment()` function:

```typescript
export function validateEnvironment(
  provider: string,
  config?: RuntimeConfiguration
): {
  valid: boolean;
  missingVars: string[];
} {
  const requiredVars: string[] = [];

  // Add required environment variables based on provider
  if (provider.toLowerCase() === 'openai') {
    requiredVars.push('OPENAI_API_KEY');
  } else if (provider.toLowerCase() === 'openrouter') {
    requiredVars.push('OPENROUTER_API_KEY');
  } else if (provider.toLowerCase() === 'anthropic') {
    const anthropicConfig = config?.providers?.anthropic;
    // Only require env var if not provided in config
    if (!anthropicConfig?.apiKey) {
      requiredVars.push('ANTHROPIC_API_KEY');
    }
  } else if (provider.toLowerCase() === 'google') {
    // New validation for Google provider
    const googleConfig = config?.providers?.google;
    if (!googleConfig?.apiKey && !googleConfig?.disableDefaultAuth) {
      requiredVars.push('GOOGLE_GENERATIVE_AI_API_KEY');
    }
  }

  // ... rest of validation logic
}
```

### Phase 7: Update Documentation

**File: `CLAUDE.md`**

Update the environment variables section:

```markdown
### Environment Variables

Required based on provider:

- `OPENAI_API_KEY` - For OpenAI models
- `OPENROUTER_API_KEY` - For OpenRouter models
- `ANTHROPIC_API_KEY` - For Anthropic models
- `GOOGLE_GENERATIVE_AI_API_KEY` - For Google Gemini models

Optional configuration:

- `AGENT_SPAWNING_DISABLED` - Set to 'true' to disable agent spawning capabilities
```

Update the architecture section to reflect the new default:

```markdown
**Multi-Model Support**: Supports OpenAI, OpenRouter, Anthropic, and Google providers with configurable models. Default is Gemini 2.5 Pro via Google Generative AI.
```

## Supported Models

Based on the Google Generative AI provider documentation, these models will be supported:

### Latest Models (Recommended)

- `gemini-2.5-pro` - Most capable model (default)
- `gemini-2.5-flash` - Fast and efficient
- `gemini-1.5-pro-latest` - Stable pro model
- `gemini-1.5-flash` - Stable flash model

### Advanced Features

- Multi-modal support (text, images, PDFs)
- Search grounding capabilities
- Tool calling support
- Cost-effective caching for repeated requests

## Migration Strategy

### Backward Compatibility

- Existing configurations will continue to work unchanged
- Users with explicit provider settings won't be affected
- OpenRouter remains available for users who prefer it

### Gradual Rollout

1. **Phase 1**: Add Google provider support while keeping OpenRouter as default
2. **Phase 2**: Switch default to Google after testing
3. **Phase 3**: Update documentation and examples

### User Communication

- Update CLI help text to reflect new default
- Provide migration guidance for users wanting to stay with OpenRouter
- Document the benefits of using direct Google provider vs OpenRouter

## Testing Strategy

### Unit Tests

- Test provider creation with Google configuration
- Test environment variable validation
- Test default configuration resolution

### Integration Tests

- Test actual API calls with test API key
- Test error handling for invalid API keys
- Test model fallback behavior

### E2E Tests

- Test full CLI workflow with Google provider
- Test configuration file loading with Google settings
- Test interactive mode with new provider

## Authentication Configuration Examples

### API Key Authentication (Default)

```json
{
  "providers": {
    "default": "google",
    "google": {
      "model": "gemini-2.5-pro",
      "authType": "api-key"
    }
  }
}
```

### Bearer Token Authentication

```json
{
  "providers": {
    "default": "google",
    "google": {
      "model": "gemini-2.5-pro",
      "authType": "bearer",
      "apiKey": "your-bearer-token-here"
    }
  }
}
```

### Custom Headers with Bearer Token

```json
{
  "providers": {
    "default": "google",
    "google": {
      "model": "gemini-2.5-pro",
      "authType": "bearer",
      "apiKey": "your-bearer-token-here",
      "customHeaders": {
        "X-Custom-Client": "envoy",
        "X-Request-ID": "unique-request-id"
      }
    }
  }
}
```

### Environment Variable with Custom Headers

```json
{
  "providers": {
    "default": "google",
    "google": {
      "model": "gemini-2.5-pro",
      "authType": "api-key",
      "customHeaders": {
        "X-Custom-Client": "envoy"
      }
    }
  }
}
```

### Proxy Configuration with Bearer Token

```json
{
  "providers": {
    "default": "google",
    "google": {
      "model": "gemini-2.5-pro",
      "authType": "bearer",
      "apiKey": "your-bearer-token-here",
      "baseURL": "https://your-proxy-server.com/v1beta",
      "customHeaders": {
        "X-Proxy-Auth": "proxy-credentials"
      }
    }
  }
}
```

### Disable Default Authentication (Custom Headers Only)

```json
{
  "providers": {
    "default": "google",
    "google": {
      "model": "gemini-2.5-pro",
      "disableDefaultAuth": true,
      "customHeaders": {
        "Authorization": "Custom auth-scheme token",
        "X-Custom-Auth": "custom-auth-value"
      }
    }
  }
}
```

## Use Cases for Bearer Token Authentication

### Enterprise Authentication

- **OAuth 2.0 Integration**: Use bearer tokens obtained from enterprise OAuth flows
- **Service Account Tokens**: Use service account tokens for automated systems
- **Proxy Authentication**: Authenticate through enterprise proxies that require bearer tokens

### Custom Authentication Flows

- **Token Refresh**: Implement custom token refresh logic with bearer tokens
- **Multi-Environment**: Different authentication methods for dev/staging/prod environments
- **Security Compliance**: Meet security requirements that mandate bearer token usage

### API Gateway Integration

- **Rate Limiting**: Use bearer tokens for API gateway rate limiting and quotas
- **Request Routing**: Route requests based on bearer token metadata
- **Audit Logging**: Track API usage through bearer token identification

## Benefits of Direct Google Provider

### Performance

- Direct API access without proxy layer
- Lower latency compared to OpenRouter
- Better rate limiting control

### Features

- Access to latest Google-specific features
- Native support for Google's multimodal capabilities
- Direct access to safety ratings and metadata

### Cost

- Potential cost savings through direct billing
- Access to Google's promotional pricing
- Better cost tracking and analytics

### Reliability

- Reduced dependency chain
- Direct error reporting from Google
- Better support for Google-specific authentication methods

## Risks and Mitigation

### API Key Management

- **Risk**: Users need to manage another API key
- **Mitigation**: Clear documentation and error messages

### Model Compatibility

- **Risk**: Different model names between providers
- **Mitigation**: Maintain backward compatibility, provide migration guide

### Rate Limits

- **Risk**: Different rate limiting compared to OpenRouter
- **Mitigation**: Implement proper retry logic, document limits

## Success Criteria

1. **Functionality**: All existing features work with Google provider
2. **Authentication**: Both API key and bearer token authentication methods work correctly
3. **Custom Headers**: Custom headers and auth overrides function as expected
4. **Performance**: Response times are comparable or better than OpenRouter
5. **Reliability**: Error rates are minimal with proper auth error handling
6. **Usability**: Users can easily switch to and configure Google provider with different auth methods
7. **Documentation**: Clear setup and usage instructions for all authentication options
8. **Testing**: Comprehensive test coverage for new provider and all auth methods
9. **Security**: Authentication credentials are handled securely without exposure
10. **Backward Compatibility**: Existing configurations continue to work unchanged

## Implementation Timeline

- **Week 1**: Phases 1-3 (Dependencies, types, configuration)
- **Week 2**: Phases 4-5 (Authentication module, provider logic)
- **Week 3**: Phases 6-7 (Environment validation, documentation)
- **Week 4**: Testing, refinement, and release preparation

## Conclusion

Adding direct Google Gemini provider support with comprehensive authentication options will provide users with:

- **Enhanced Performance**: Direct API access without proxy layers
- **Flexible Authentication**: Support for both API key and bearer token authentication methods
- **Enterprise Integration**: Custom headers and bearer token support for enterprise OAuth flows
- **Security Compliance**: Meet organizational security requirements with configurable authentication
- **Advanced Features**: Access to latest Google-specific capabilities and multimodal support
- **Cost Efficiency**: Potential cost savings through direct billing and better rate management

The implementation follows established patterns in the codebase (similar to the Anthropic provider's authentication system) for consistency and maintainability, while maintaining full backward compatibility with existing configurations. Users can easily migrate from OpenRouter's Gemini proxy to direct Google access with enhanced authentication capabilities.
