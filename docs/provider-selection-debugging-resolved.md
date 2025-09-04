# Provider Selection Debugging - Issue Resolution

## Problem Summary

The user's `.envoy.json` config file specified `"default": "anthropic"` but the system was selecting OpenRouter instead. The investigation revealed the root cause and implemented comprehensive debug logging.

## Root Cause Found

The issue was **configuration schema validation failure**. The user's config file contained:

```json
{
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "authType": "oauth" // ← This was causing validation failure
    }
  }
}
```

The configuration schema (`configSchema.ts`) only allowed `authType: z.enum(['x-api-key', 'bearer'])` but the user had `"oauth"` which caused the entire config file to be rejected during validation.

## Solution Implemented

### 1. **Fixed Configuration Schema**

Updated `src/configSchema.ts` to include `'oauth'` in the allowed enum:

```typescript
authType: z.enum(['x-api-key', 'bearer', 'oauth']).optional(),
```

Also added missing OAuth-related fields:

```typescript
enableOAuth: z.boolean().optional(),
preferOAuth: z.boolean().optional(),
oauthHeaders: z.record(z.string()).optional(),
```

### 2. **Added Comprehensive Debug Logging**

Enhanced debug logging throughout the provider selection pipeline to trace exactly how providers are chosen:

#### **Configuration Loading** (`src/config.ts`):

- Configuration file search paths
- File loading success/failure
- Configuration validation results
- Configuration merging process
- CLI override application

#### **Provider Selection** (`src/cli.ts`):

- Final provider configuration analysis
- Provider selection reasoning
- Model resolution logic

#### **Model Provider Creation** (`src/agentSession.ts`):

- Provider-specific initialization details
- Authentication strategy analysis for Anthropic
- Model and authentication configuration

#### **Authentication Flow** (`src/providers/anthropicAuth.ts`):

- Authentication method selection (OAuth vs API key)
- Header construction and management
- OAuth token status and refresh logic

#### **OAuth Token Management** (`src/auth/anthropicOAuth.ts`):

- Token validity checking
- Token refresh operations
- OAuth credential availability

## Debug Logging Hierarchy

The debug logging now shows provider selection reasoning at multiple levels:

### **Level 1: Configuration Source Identification**

```
DEBUG: Configuration loading started
DEBUG: Configuration file loaded successfully
DEBUG: Configurations merged
DEBUG: Final configuration resolved
```

### **Level 2: Provider Selection Reasoning**

```
DEBUG: Provider configuration analysis
DEBUG: Provider fallback resolution
INFO: Provider and model selected
```

### **Level 3: Provider Implementation Details**

```
DEBUG: Model provider configuration analysis
DEBUG: Anthropic provider authentication analysis
INFO: Anthropic provider created successfully
```

### **Level 4: Runtime Authentication Details**

```
DEBUG: Anthropic auth fetch initialization
DEBUG: OAuth token status check
DEBUG: OAuth authentication successful
DEBUG: Final authentication headers prepared
```

## Provider Selection Decision Flow

The enhanced logging now clearly shows the decision-making process:

1. **Configuration Source**: Which config files were loaded and their precedence
2. **Merge Result**: How multiple configurations were combined
3. **CLI Overrides**: Whether CLI arguments override config file settings
4. **Fallback Logic**: When and why defaults are applied
5. **Final Selection**: The resolved provider and reasoning

## Key Debug Information Available

### **Provider Selection Reasoning**

```typescript
logger.debug('Provider configuration analysis', {
  defaultProvider,
  hasProviderConfig: !!providerConfig,
  configuredModel: providerConfig?.model || null,
  resolvedModel: model,
  configSources: configResult.loadedFrom || [],
  source: cliOverrides.provider
    ? 'CLI override'
    : loadedFrom.length > 0
      ? `config file (${loadedFrom[loadedFrom.length - 1]})`
      : 'default',
});
```

### **Authentication Strategy Analysis**

```typescript
logger.debug('Anthropic provider authentication analysis', {
  authType,
  enableOAuth,
  preferOAuth,
  hasOAuthToken,
  hasApiKey,
  authStrategy: hasOAuthToken ? 'OAuth' : 'API Key',
});
```

### **OAuth Flow Details**

```typescript
logger.debug('OAuth token status check', {
  hasAccessToken: !!credentials.access,
  timeUntilExpiry,
  isExpired,
  expiresAt: new Date(credentials.expires).toISOString(),
});
```

## Resolution Verification

After fixing the schema validation issue:

✅ **Configuration file loads successfully**  
✅ **Anthropic selected as default provider**  
✅ **OAuth authentication works correctly**  
✅ **Debug logging provides complete visibility**

The comprehensive debug logging now enables easy troubleshooting of:

- Configuration loading issues
- Provider selection logic
- Authentication method selection
- OAuth token management
- Runtime request authentication

## Usage

Enable detailed provider selection debugging with:

```bash
npx . --log-level DEBUG "your message"
```

This provides complete visibility into the provider, model, and authentication selection process.
