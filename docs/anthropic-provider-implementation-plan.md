# Anthropic Provider Implementation Plan

## Overview

This document outlines the implementation plan for adding Anthropic provider support to the CLI AI Agent. The agent currently supports OpenAI and OpenRouter providers, and this plan details the steps needed to add Anthropic (Claude) models as a third provider option.

## Current Provider Architecture

### Existing Setup

- **Supported Providers**: OpenAI, OpenRouter
- **Provider Packages**: `@ai-sdk/openai`, `@openrouter/ai-sdk-provider`
- **Configuration**: File-based configuration with provider-specific settings
- **Environment Variables**: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`
- **Default Provider**: OpenRouter with Gemini 2.5 Flash model

### Key Components

- **Configuration Types**: `src/configTypes.ts` - `ProvidersConfig` interface
- **Provider Creation**: `src/agentSession.ts` - `createModelProvider()` function
- **Schema Validation**: `src/configSchema.ts` - Provider validation rules
- **Environment Validation**: `src/agent.ts` - `validateEnvironment()` function

## Anthropic Provider Requirements

### Package Dependencies

- **Main Package**: `@ai-sdk/anthropic` version `1.2.12` (latest)
- **Compatibility**: ✅ Compatible with AI SDK `4.2.0` (uses shared `@ai-sdk/provider` 1.1.3)
- **Installation**: `npm install @ai-sdk/anthropic`
- **Peer Dependencies**: Only requires `zod ^3.0.0` (already satisfied)

### Configuration Support

- **API Key**: `ANTHROPIC_API_KEY` environment variable
- **Base URL**: Optional custom base URL support (defaults to https://api.anthropic.com/v1)
- **Model Selection**: Support for Claude 3, 3.5, 3.7, and 4 model variants
- **Advanced Features**: Optional support for reasoning, web search, computer use tools

### Anthropic-Specific Features

- **Reasoning**: Advanced reasoning capabilities with token budgets (Claude 4 & 3.7 models)
- **Web Search**: Built-in web search functionality with domain filtering
- **Computer Use**: Screen interaction and automation tools (`computer_20241022`)
- **Text Editor**: File editing operations (`textEditor_20241022`)
- **Bash Tool**: Command execution (`bash_20241022`)
- **Prompt Caching**: Ephemeral caching for improved performance
- **Multi-modal**: Support for images, PDFs, and other file types

## Implementation Steps

### Phase 1: Basic Provider Support

#### Step 1: Install Dependencies

```bash
npm install @ai-sdk/anthropic
```

#### Step 2: Update Configuration Types

**File**: `src/configTypes.ts`

- Add `anthropic?: ProviderConfig` to `ProvidersConfig` interface
- The existing `ProviderConfig` interface should work for basic Anthropic configuration

#### Step 3: Update Configuration Schema

**File**: `src/configSchema.ts`

- Add `'anthropic'` to the enum in the providers default validation
- Add `anthropic: ProviderConfigSchema.optional()` to the providers object schema

#### Step 4: Update Default Configuration

**File**: `src/config.ts` (in `getDefaultConfiguration()`)

- Add default Anthropic configuration:

```typescript
anthropic: {
  model: 'claude-4-sonnet-0',
},
```

#### Step 5: Update Provider Creation Logic

**File**: `src/agentSession.ts` (in `createModelProvider()`)

- Import: `import { anthropic } from '@ai-sdk/anthropic';`
- Add case for Anthropic provider:

```typescript
case 'anthropic':
  return anthropic(model as any);
```

#### Step 6: Update Environment Validation

**File**: `src/agent.ts` (in `validateEnvironment()`)

- Add case for Anthropic:

```typescript
} else if (provider.toLowerCase() === 'anthropic') {
  requiredVars.push('ANTHROPIC_API_KEY');
}
```

#### Step 7: Update README and Documentation

- Add Anthropic to the list of supported providers
- Document required environment variables
- Add example configuration

### Phase 2: Advanced Configuration Support

#### Step 8: Enhanced Configuration Types

**File**: `src/configTypes.ts`

- Create `AnthropicProviderConfig` interface extending `ProviderConfig`:

```typescript
export interface AnthropicProviderConfig extends ProviderConfig {
  // Advanced Anthropic-specific options
  sendReasoning?: boolean;
  thinking?: {
    type: 'enabled';
    budgetTokens: number;
  };
  webSearch?: {
    maxUses: number;
    allowedDomains?: string[];
    blockedDomains?: string[];
    userLocation?: {
      type: 'approximate';
      country: string;
      region?: string;
      city?: string;
      timezone?: string;
    };
  };
  cacheControl?: {
    type: 'ephemeral';
  };
}
```

#### Step 9: Update Provider Creation for Advanced Features

**File**: `src/agentSession.ts`

- Import: `import { anthropic, createAnthropic } from '@ai-sdk/anthropic';`
- Support custom Anthropic configuration with `createAnthropic()`:

```typescript
case 'anthropic':
  const anthropicConfig = typeof providerConfig === 'object' ? providerConfig : {};
  if (anthropicConfig.apiKey || anthropicConfig.baseURL) {
    const anthropicProvider = createAnthropic({
      apiKey: anthropicConfig.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: anthropicConfig.baseURL,
    });
    return anthropicProvider(model);
  }
  return anthropic(model as any);
```

### Phase 3: Built-in Tools Integration

#### Step 10: Anthropic Built-in Tools Support

**File**: `src/constants.ts` or new `src/anthropicTools.ts`

- Add configuration for Anthropic's built-in tools:
  - Computer Use tool (`computer_20241022`)
  - Text Editor tool (`textEditor_20241022`)
  - Bash tool (`bash_20241022`)

#### Step 11: Tool Configuration in Agent Setup

- Allow enabling/disabling specific Anthropic tools through configuration
- Integrate with existing MCP tool loading system

### Phase 4: Testing and Validation

#### Step 12: Add Tests

**Files**: `src/agent.test.ts`, `src/config.test.ts`, `src/agentSession.test.ts`

- Unit tests for Anthropic provider configuration
- Integration tests for model creation
- Environment validation tests

#### Step 13: End-to-End Testing

**File**: `e2e/anthropic.test.ts`

- Test basic text generation with Claude models
- Test advanced features if implemented
- Test error handling for missing API keys

#### Step 14: Update Example Configuration

**File**: `example-config.json`

- Add Anthropic provider example:

```json
{
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "model": "claude-4-sonnet-0",
      "apiKey": "${ANTHROPIC_API_KEY}"
    }
  }
}
```

## Configuration Examples

### Basic Configuration

```json
{
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "model": "claude-4-sonnet-0"
    }
  }
}
```

### Advanced Configuration with Claude 4

```json
{
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "model": "claude-4-sonnet-0",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "baseURL": "https://api.anthropic.com/v1",
      "sendReasoning": true,
      "thinking": {
        "type": "enabled",
        "budgetTokens": 12000
      },
      "webSearch": {
        "maxUses": 5,
        "allowedDomains": ["wikipedia.org", "docs.anthropic.com"],
        "userLocation": {
          "type": "approximate",
          "country": "US",
          "region": "California"
        }
      }
    }
  }
}
```

### Performance-Optimized Configuration

```json
{
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "model": "claude-3-5-haiku-latest",
      "cacheControl": {
        "type": "ephemeral"
      }
    }
  }
}
```

### CLI Usage Examples

```bash
# Use Anthropic as default provider
npx . --provider anthropic "Explain quantum computing"

# Use specific Claude model (latest reasoning-capable model)
npx . --provider anthropic --model claude-4-opus-0 "Write a complex analysis with reasoning"

# Set environment variable
export ANTHROPIC_API_KEY=your_api_key_here
npx . --provider anthropic "Hello world"
```

## Available Claude Models

### Claude 4 Models (Latest - January 2025)

- **Claude 4 Opus**: `claude-4-opus-20250514` / `claude-4-opus-0` (alias) - Most capable
- **Claude 4 Sonnet**: `claude-4-sonnet-20250514` / `claude-4-sonnet-0` (alias) - Balanced performance
- **Reasoning Support**: ✅ Both Claude 4 models support advanced reasoning

### Claude 3.7 Models

- **Claude 3.7 Sonnet**: `claude-3-7-sonnet-20250219` / `claude-3-7-sonnet-latest` (alias)
- **Reasoning Support**: ✅ Enhanced reasoning capabilities

### Claude 3.5 Models

- **Claude 3.5 Sonnet**: `claude-3-5-sonnet-20241022` / `claude-3-5-sonnet-latest` (alias) - **Recommended default**
- **Claude 3.5 Sonnet (Previous)**: `claude-3-5-sonnet-20240620`
- **Claude 3.5 Haiku**: `claude-3-5-haiku-20241022` / `claude-3-5-haiku-latest` (alias) - Fastest

### Claude 3 Models (Legacy)

- **Claude 3 Opus**: `claude-3-opus-20240229` / `claude-3-opus-latest` (alias) - Most capable (legacy)
- **Claude 3 Sonnet**: `claude-3-sonnet-20240229` - Balanced (legacy)
- **Claude 3 Haiku**: `claude-3-haiku-20240307` - Fastest (legacy)

### Model Selection Guidelines

- **Default**: `claude-4-sonnet-0` (balanced performance with reasoning capabilities)
- **Highest Performance**: `claude-4-opus-0` (for most complex tasks, maximum reasoning power)
- **Alternative Balanced**: `claude-3-7-sonnet-latest` (good reasoning, lower cost than Claude 4)
- **Fast/Economic**: `claude-3-5-haiku-latest` (fastest response times, basic tasks)
- **Stable Alternative**: `claude-3-5-sonnet-latest` (proven performance, no reasoning)
- **Legacy Support**: Use specific dated versions for reproducibility

## Environment Variables

### Required

- `ANTHROPIC_API_KEY`: Your Anthropic API key

### Optional

- `ANTHROPIC_BASE_URL`: Custom base URL (defaults to https://api.anthropic.com/v1)

## Error Handling

### Common Issues

1. **Missing API Key**: Clear error message with setup instructions
2. **Invalid Model**: Fallback to default model with warning
3. **Rate Limiting**: Proper error handling with retry suggestions
4. **Network Issues**: Timeout handling and error reporting

### Error Messages

- Include helpful links to Anthropic documentation
- Provide clear steps to resolve configuration issues
- Suggest alternative models if current selection fails

## Migration Notes

### For Existing Users

- No breaking changes to existing OpenAI/OpenRouter configurations
- New optional provider that can be added to existing configs
- Backward compatibility maintained

### Configuration Migration

- Users can gradually migrate from OpenAI/OpenRouter to Anthropic
- Support for mixed provider usage in different scenarios
- Clear migration guide in updated documentation

## Future Enhancements

### Potential Features

1. **Model Aliases**: Simple names for complex model identifiers
2. **Cost Tracking**: Track API usage and costs per provider
3. **Performance Metrics**: Compare response times across providers
4. **Advanced Caching**: Implement Anthropic's prompt caching features
5. **Computer Use Integration**: Full support for Anthropic's computer use capabilities

### Provider Registry

- Consider implementing a provider registry system for easier management
- Support for custom provider configurations
- Dynamic provider loading based on use case

## Implementation Timeline

### Phase 1 (Basic Support): 1-2 days

- Steps 1-7: Core provider integration
- Basic testing and validation

### Phase 2 (Advanced Features): 2-3 days

- Steps 8-9: Enhanced configuration
- Advanced feature support

### Phase 3 (Tools Integration): 1-2 days

- Steps 10-11: Built-in tools support
- Integration testing

### Phase 4 (Testing & Polish): 1-2 days

- Steps 12-14: Comprehensive testing
- Documentation updates
- Final validation

**Total Estimated Time**: 5-9 days

## Success Criteria

1. ✅ Anthropic provider can be configured and used
2. ✅ All existing functionality continues to work
3. ✅ Environment validation includes Anthropic API key
4. ✅ Configuration schema accepts Anthropic settings
5. ✅ Tests pass for all provider types
6. ✅ Documentation updated with Anthropic examples
7. ✅ Error handling provides clear guidance
8. ✅ Performance is comparable to existing providers

## Notes

- This implementation follows the existing patterns in the codebase
- Maintains backward compatibility with current configurations
- Leverages the official `@ai-sdk/anthropic` package for reliability
- Provides foundation for future advanced Anthropic features
- Follows the project's TypeScript and configuration conventions
