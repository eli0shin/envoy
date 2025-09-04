# Anthropic Alternative Authentication Headers Implementation Plan

## Overview

This document outlines the implementation plan for supporting configurable API key headers for the Anthropic provider. Currently, the `@ai-sdk/anthropic` package hardcodes the `x-api-key` header for authentication, but some users need to use `Authorization: Bearer` headers for proxy/gateway compatibility.

## Current State Analysis

### Anthropic SDK Limitations

- The `@ai-sdk/anthropic` package hardcodes `x-api-key` header
- Built-in `loadApiKey()` function always sets `x-api-key`
- Custom headers can be added but don't replace the default auth header

### Current Provider Integration

- Generic `ProviderConfig` interface used for all providers
- Hard-coded environment variable names
- No custom authentication header support
- Configuration fields like `apiKey` and `baseURL` are defined but not used

## Implementation Plan

### Phase 1: Enhanced Provider Configuration Types

#### Step 1: Create Extended Anthropic Configuration

**File**: `src/configTypes.ts`

```typescript
export interface AnthropicProviderConfig extends ProviderConfig {
  authType?: 'x-api-key' | 'bearer'; // Default: 'x-api-key'
  customHeaders?: Record<string, string>; // Additional headers
  disableDefaultAuth?: boolean; // Skip x-api-key header
}

// Update ProvidersConfig to use specific type
export interface ProvidersConfig {
  default?: string;
  openai?: ProviderConfig;
  openrouter?: ProviderConfig;
  anthropic?: AnthropicProviderConfig; // Use specific type
}
```

#### Step 2: Update Configuration Schema

**File**: `src/configSchema.ts`

```typescript
const AnthropicProviderConfigSchema = z
  .object({
    apiKey: z.string().optional(),
    model: z.string().optional(),
    baseURL: z.string().url().optional(),
    authType: z.enum(['x-api-key', 'bearer']).optional(),
    customHeaders: z.record(z.string()).optional(),
    disableDefaultAuth: z.boolean().optional(),
  })
  .strict();

export const CONFIG_SCHEMA = z
  .object({
    // ... existing config
    providers: z
      .object({
        // ... existing providers
        anthropic: AnthropicProviderConfigSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
```

### Phase 2: Custom Fetch Implementation

#### Step 3: Create Authentication Wrapper

**File**: `src/providers/anthropicAuth.ts` (new file)

```typescript
interface AuthOptions {
  apiKey: string;
  authType: 'x-api-key' | 'bearer';
  customHeaders?: Record<string, string>;
  disableDefaultAuth?: boolean;
}

export function createAnthropicAuthFetch(options: AuthOptions): FetchFunction {
  return async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);

    // Handle authentication based on type
    if (!options.disableDefaultAuth) {
      if (options.authType === 'bearer') {
        headers.set('Authorization', `Bearer ${options.apiKey}`);
      } else {
        headers.set('x-api-key', options.apiKey);
      }
    }

    // Add custom headers
    if (options.customHeaders) {
      Object.entries(options.customHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    return fetch(url, {
      ...init,
      headers,
    });
  };
}
```

#### Step 4: Update Provider Creation Logic

**File**: `src/agentSession.ts`

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAnthropicAuthFetch } from './providers/anthropicAuth.js';

function createModelProvider(config: RuntimeConfiguration): LanguageModel {
  // ... existing code ...

  switch (defaultProvider.toLowerCase()) {
    // ... existing cases ...

    case 'anthropic':
      const anthropicConfig = config.providers.anthropic;

      // Use custom configuration if provided
      if (
        anthropicConfig &&
        (anthropicConfig.authType === 'bearer' ||
          anthropicConfig.customHeaders ||
          anthropicConfig.disableDefaultAuth ||
          anthropicConfig.apiKey ||
          anthropicConfig.baseURL)
      ) {
        const apiKey = anthropicConfig.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error('ANTHROPIC_API_KEY is required');
        }

        const customFetch = createAnthropicAuthFetch({
          apiKey,
          authType: anthropicConfig.authType || 'x-api-key',
          customHeaders: anthropicConfig.customHeaders,
          disableDefaultAuth: anthropicConfig.disableDefaultAuth,
        });

        const anthropicProvider = createAnthropic({
          apiKey: anthropicConfig.disableDefaultAuth ? undefined : apiKey,
          baseURL: anthropicConfig.baseURL,
          fetch: customFetch,
        });

        return anthropicProvider(model);
      }

      // Default behavior
      return anthropic(model as any);
  }
}
```

### Phase 3: Environment Variable Flexibility

#### Step 5: Update Environment Validation

**File**: `src/agent.ts`

```typescript
export function validateEnvironment(
  provider: string,
  config?: Configuration
): {
  valid: boolean;
  missingVars: string[];
} {
  const requiredVars: string[] = [];

  if (provider.toLowerCase() === 'anthropic') {
    const anthropicConfig = config?.providers?.anthropic;

    // Only require env var if not provided in config
    if (!anthropicConfig?.apiKey) {
      requiredVars.push('ANTHROPIC_API_KEY');
    }
  }
  // ... other providers
}
```

#### Step 6: Update Default Configuration

**File**: `src/config.ts`

```typescript
anthropic: {
  model: 'claude-sonnet-4-20250514',
  authType: 'x-api-key',  // Default to standard auth
},
```

### Phase 4: Documentation and Examples

#### Step 7: Configuration Examples

**Standard Configuration (default):**

```json
{
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "model": "claude-sonnet-4-20250514"
    }
  }
}
```

**Bearer Token Configuration:**

```json
{
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "model": "claude-sonnet-4-20250514",
      "authType": "bearer",
      "apiKey": "${ANTHROPIC_API_KEY}"
    }
  }
}
```

**Proxy/Custom Headers Configuration:**

```json
{
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "model": "claude-sonnet-4-20250514",
      "baseURL": "https://api.proxy.com/v1/anthropic",
      "authType": "bearer",
      "customHeaders": {
        "X-Proxy-Token": "${PROXY_TOKEN}",
        "X-Request-ID": "agent-request"
      }
    }
  }
}
```

**Custom Authentication Configuration:**

```json
{
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "model": "claude-sonnet-4-20250514",
      "disableDefaultAuth": true,
      "customHeaders": {
        "Authorization": "Bearer ${ANTHROPIC_API_KEY}",
        "X-Custom-Auth": "${CUSTOM_TOKEN}"
      }
    }
  }
}
```

### Phase 5: Testing and Validation

#### Step 8: Add Tests

**File**: `src/providers/anthropicAuth.test.ts` (new file)

```typescript
describe('Anthropic Authentication', () => {
  test('should use x-api-key by default', () => {
    // Test default auth behavior
  });

  test('should use Bearer token when configured', () => {
    // Test bearer token auth
  });

  test('should add custom headers', () => {
    // Test custom headers
  });

  test('should disable default auth when requested', () => {
    // Test disabling default auth
  });
});
```

## Use Cases

### Use Case 1: API Gateway/Proxy Support

**Problem**: Corporate proxy requires `Authorization: Bearer` instead of `x-api-key`

**Solution**:

```json
{
  "providers": {
    "anthropic": {
      "authType": "bearer",
      "baseURL": "https://corporate-proxy.com/api/anthropic"
    }
  }
}
```

### Use Case 2: Custom Authentication Headers

**Problem**: Need additional authentication headers for multi-layered security

**Solution**:

```json
{
  "providers": {
    "anthropic": {
      "customHeaders": {
        "X-API-Gateway-Token": "${GATEWAY_TOKEN}",
        "X-Client-ID": "ai-agent"
      }
    }
  }
}
```

### Use Case 3: Completely Custom Authentication

**Problem**: Using custom authentication system that doesn't use standard headers

**Solution**:

```json
{
  "providers": {
    "anthropic": {
      "disableDefaultAuth": true,
      "customHeaders": {
        "X-Custom-Auth": "${CUSTOM_TOKEN}",
        "X-Session-ID": "${SESSION_ID}"
      }
    }
  }
}
```

## Migration Path

### Backward Compatibility

- Default behavior remains unchanged (`x-api-key` header)
- Existing configurations continue to work
- New features are opt-in through configuration

### Migration Steps for Users

1. **Proxy Users**: Add `"authType": "bearer"` to config
2. **Custom Headers**: Use `customHeaders` field
3. **Advanced Auth**: Use `disableDefaultAuth` + `customHeaders`

## Error Handling

### Configuration Validation

- Validate auth type enum values
- Ensure API key is available when needed
- Provide clear error messages for misconfiguration

### Runtime Errors

- Handle authentication failures gracefully
- Provide debugging information for auth issues
- Suggest configuration fixes in error messages

## Benefits

1. **Proxy Support**: Enables use with API gateways expecting Bearer tokens
2. **Flexibility**: Supports various authentication schemes
3. **Backward Compatibility**: No breaking changes
4. **Extensibility**: Pattern can be applied to other providers
5. **Configuration-Driven**: All options configurable via JSON files

## Implementation Timeline

### Phase 1 (Configuration Types): 1 day

- Steps 1-2: Enhanced configuration interfaces and schema validation

### Phase 2 (Custom Authentication): 2 days

- Steps 3-4: Custom fetch implementation and provider integration

### Phase 3 (Environment Flexibility): 1 day

- Steps 5-6: Updated environment validation and defaults

### Phase 4 (Documentation): 1 day

- Step 7: Configuration examples and user documentation

### Phase 5 (Testing): 1 day

- Step 8: Comprehensive test coverage

**Total Estimated Time**: 6 days

## Success Criteria

1. ✅ Support `Authorization: Bearer` authentication header
2. ✅ Support custom headers for proxy/gateway scenarios
3. ✅ Maintain backward compatibility with existing configurations
4. ✅ Provide clear configuration examples and documentation
5. ✅ Include comprehensive test coverage
6. ✅ Handle authentication errors gracefully
7. ✅ Support environment variable override flexibility
8. ✅ Follow existing codebase patterns and conventions

## Future Enhancements

### Potential Extensions

1. **Other Providers**: Apply similar authentication flexibility to OpenAI/OpenRouter
2. **Dynamic Headers**: Support for time-based or computed authentication headers
3. **Authentication Profiles**: Predefined authentication configurations for common proxies
4. **Header Templates**: Template system for complex authentication header patterns
5. **Credential Management**: Integration with credential management systems

This implementation provides a solid foundation for flexible authentication while maintaining the existing codebase's patterns and ensuring backward compatibility.
