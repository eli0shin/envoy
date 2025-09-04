# Debug Logging Enhancement Summary

This document summarizes the comprehensive debug logging added to improve visibility into provider, model, and authentication selection logic.

## Files Enhanced with Debug Logging

### 1. `/src/agentSession.ts` - Model Provider Creation

- **Provider Configuration Analysis**: Shows which provider is selected and why
- **Model Resolution**: Shows configured vs resolved model names
- **Provider-Specific Logging**:
  - OpenAI: API key availability
  - OpenRouter: API key availability
  - Anthropic: Comprehensive auth analysis

### 2. `/src/providers/anthropicAuth.ts` - Authentication Flow

- **Auth Fetch Initialization**: Shows all auth options and settings
- **OAuth Flow**: Token status, validity, and acquisition
- **API Key Fallback**: When and why fallback occurs
- **Header Management**: Shows final authentication headers

### 3. `/src/cli.ts` - Configuration Loading

- **Provider Selection**: Shows provider configuration analysis
- **Model Selection**: Shows configured vs resolved models

### 4. `/src/auth/anthropicOAuth.ts` - OAuth Token Management

- **Token Status**: Validity, expiration times, refresh needs
- **Token Refresh**: Success/failure of refresh operations
- **Credential Management**: Availability of OAuth vs API key credentials

## Debug Logging Patterns Used

### 1. **Structured Logging**

All debug logs include structured data objects for easy parsing:

```typescript
logger.debug('OAuth token status check', {
  hasAccessToken: !!credentials.access,
  hasRefreshToken: !!credentials.refresh,
  timeUntilExpiry,
  isExpired,
  expiresAt: new Date(credentials.expires).toISOString(),
});
```

### 2. **Consistent Log Levels**

- `logger.debug()` - Internal state and decision-making details
- `logger.info()` - Major milestones and successful operations
- `logger.warn()` - Recoverable issues and fallbacks
- `logger.error()` - Failures and error conditions

### 3. **Security-Conscious Logging**

- Never log actual tokens or API keys
- Log token/key lengths instead of values
- Log boolean flags for credential availability

## Key Debug Information Now Available

### Provider Selection Debugging

```
DEBUG: Model provider configuration analysis
{
  "defaultProvider": "anthropic",
  "configuredModel": "claude-sonnet-4",
  "resolvedModel": "claude-sonnet-4",
  "hasProviderConfig": true,
  "providerConfigType": "object"
}
```

### Authentication Strategy Debugging

```
DEBUG: Anthropic provider authentication analysis
{
  "model": "claude-sonnet-4",
  "authType": "oauth",
  "enableOAuth": true,
  "preferOAuth": true,
  "hasOAuthToken": true,
  "hasApiKey": false,
  "disableDefaultAuth": false
}
```

### OAuth Flow Debugging

```
DEBUG: OAuth authentication successful
{
  "hasToken": true,
  "tokenLength": 108,
  "hasOauthHeaders": false
}
```

### Request Header Debugging

```
DEBUG: Final authentication headers prepared
{
  "finalHeaderKeys": ["authorization", "anthropic-beta", "anthropic-version"],
  "hasAuthHeader": true,
  "hasAnthropicBeta": true
}
```

## Benefits for Troubleshooting

### 1. **Provider Issues**

- Quickly identify which provider is being selected
- See if model configuration is working correctly
- Understand provider-specific setup

### 2. **Authentication Issues**

- See exact auth strategy being used
- Track OAuth token status and refresh cycles
- Identify header configuration problems

### 3. **Configuration Issues**

- Verify configuration loading and parsing
- See which settings are taking effect
- Understand default vs configured values

### 4. **Runtime Issues**

- Track request-level authentication decisions
- See when fallbacks occur
- Monitor token refresh patterns

## Usage

Enable debug logging with:

```bash
npx . --log-level DEBUG "your message"
```

The enhanced logging provides complete visibility into the provider, model, and authentication selection process, making it much easier to diagnose configuration and authentication issues.
