# Envoy

**An AI agent messenger** - A sophisticated command-line AI agent built with **Vercel AI SDK 4.2** and **Model Context Protocol (MCP)** that provides unified access to multiple AI models with advanced reasoning capabilities.

## Features

- **🤖 Multi-Provider Support**: OpenAI, Anthropic, OpenRouter, Google Gemini
- **💭 Advanced Reasoning**: Dynamic thinking allocation and interleaved thinking
- **🔧 MCP Integration**: Native Model Context Protocol with tools, prompts, and resources
- **🖥️ Interactive Mode**: Real-time streaming UI with OpenTUI
- **🛡️ Secure Authentication**: OAuth and API key support with credential management
- **⚙️ Flexible Configuration**: File-based configuration with environment variable support
- **🚀 Agent Spawning**: Create and manage sub-agents for parallel processing

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in one-shot mode
npx envoy "What is quantum computing?"

# Run in interactive mode (no arguments)
npx envoy

# Use with JSON output
npx envoy --json "Calculate 15% of 250"

# Read from stdin
echo "Analyze this data" | npx envoy --stdin
```

## Usage Modes

### One-Shot Mode

Execute a single request and exit. Perfect for scripts and automation.

```bash
# Basic usage
npx envoy "Explain machine learning"

# With provider selection
npx envoy --provider anthropic --model claude-sonnet-4 "Debug this code"

# With JSON output for automation
npx envoy --json "What's 2+2?" | jq '.response'

# Reading from stdin
echo "Long prompt text here" | npx envoy --stdin

# With enhanced thinking
npx envoy "think deeply about the implications of AI" --log-progress all
```

### Interactive Mode

Persistent conversational interface with real-time streaming and visual feedback.

```bash
# Start interactive mode (automatically detected when no message provided)
npx envoy
```

**Interactive Mode Features:**

- Real-time message streaming
- Persistent conversation history
- Visual loading indicators
- Tool execution progress
- Thinking/reasoning display

## Authentication

Envoy supports multiple authentication methods including OAuth and API keys.

### Anthropic OAuth (Recommended)

```bash
# Login with OAuth flow (opens browser)
npx envoy auth login

# Check authentication status
npx envoy auth status

# List stored credentials
npx envoy auth list

# Logout
npx envoy auth logout
```

### Environment Variables

```bash
export ANTHROPIC_API_KEY="your-api-key"
export OPENAI_API_KEY="your-openai-key"
export OPENROUTER_API_KEY="your-openrouter-key"
export GOOGLE_GENERATIVE_AI_API_KEY="your-google-key"
```

## Advanced Reasoning

### Dynamic Thinking

Envoy automatically adjusts thinking budget based on user keywords:

```bash
# Low thinking (4,000 tokens)
npx envoy "think about this problem"

# Medium thinking (10,000 tokens)
npx envoy "think deeply about quantum mechanics"

# High thinking (31,999 tokens)
npx envoy "think harder about the philosophical implications"
```

**Thinking Keywords:**

- **Low**: `think`
- **Medium**: `think about it`, `think deeply`, `megathink`
- **High**: `think harder`, `think intensely`, `ultrathink`

### Interleaved Thinking

For step-by-step reasoning (Anthropic models):

```bash
npx envoy "solve this complex math problem think step by step"
```

## MCP Integration

### Built-in MCP Servers

- **Filesystem**: File operations and directory browsing
- **Shell**: Command execution with safety controls
- **Todo List**: Task management and tracking
- **Agent Spawner**: Sub-agent creation and management

### Using MCP Prompts

```bash
# List available prompts
npx envoy --list-prompts

# Execute a specific prompt
npx envoy --prompt "analyze-code" --prompt-args '{"language":"typescript"}'

# Interactive prompt selection
npx envoy --interactive-prompt
```

### Using MCP Resources

```bash
# List available resources
npx envoy --list-resources

# Include specific resources
npx envoy --resources "file:///path/to/doc.md,http://api.com/data" "Analyze this"

# Auto-discover relevant resources
npx envoy --auto-resources "Analyze the codebase"
```

## Configuration

### Configuration Files

Envoy supports flexible configuration via JSON files with this precedence:

1. **Project level**: `.envoy.json` (current directory)
2. **User level**: `~/.config/envoy/config.json` or `~/.envoy.json`
3. **CLI flags** (highest precedence)
4. **Environment variables** (lowest precedence)

### Example Configuration

Create `.envoy.json` in your project:

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "description": "Local filesystem access"
    },
    "shell": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-shell"],
      "description": "Shell command execution"
    }
  },
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "model": "claude-sonnet-4-20250514",
      "authType": "oauth",
      "customHeaders": {
        "X-Custom-Client": "envoy"
      }
    },
    "openai": {
      "apiKey": "${OPENAI_API_KEY}",
      "model": "gpt-4"
    }
  },
  "agent": {
    "maxSteps": 20,
    "timeout": 300000,
    "logLevel": "INFO",
    "logProgress": "assistant",
    "streaming": true
  },
  "tools": {
    "globalTimeout": 60000
  }
}
```

### Disabling MCP Tools

Control which tools are available by disabling them globally or per-server:

```json
{
  "tools": {
    "disabledInternalTools": ["write_file", "shell_exec"]
  },
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "disabledTools": ["delete_file"]
    }
  }
}
```

### Provider Configuration

Configure multiple AI providers:

```json
{
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "model": "claude-sonnet-4-20250514",
      "authType": "oauth"
    },
    "openai": {
      "apiKey": "${OPENAI_API_KEY}",
      "model": "gpt-4"
    },
    "openrouter": {
      "apiKey": "${OPENROUTER_API_KEY}",
      "model": "google/gemini-2.5-flash-preview-05-20"
    },
    "google": {
      "apiKey": "${GOOGLE_GENERATIVE_AI_API_KEY}",
      "model": "gemini-2.5-pro"
    }
  }
}
```

## Command Line Reference

```
Usage: envoy [OPTIONS] [MESSAGE]

Options:
  --provider, -p         AI provider (openai, anthropic, openrouter, google)
  --model, -m           Model to use
  --json                Output in JSON format
  --stdin               Read message from stdin
  --log-level           Log level (DEBUG, INFO, WARN, ERROR, SILENT)
  --log-progress        Progress output (none, assistant, tool, all)
  --max-steps           Maximum conversation steps (default: 100)
  --system-prompt       Custom system prompt
  --system-prompt-file  Path to system prompt file
  --system-prompt-mode  How to handle custom prompts (replace, append, prepend)
  --list-prompts        List available MCP prompts
  --list-resources      List available MCP resources
  --prompt              Execute specific prompt by name
  --prompt-args         JSON arguments for prompt
  --resources           Comma-separated resource URIs
  --auto-resources      Auto-discover relevant resources
  --interactive-prompt  Interactive prompt selection menu
```

## Agent Spawning

Create sub-agents for parallel processing:

```bash
# Spawn agents automatically through conversation
npx envoy "Create two agents: one to analyze performance and another to check security"
```

## System Prompts

Customize behavior with system prompts:

```bash
# Inline system prompt
npx envoy --system-prompt "You are a helpful coding assistant" "Fix this bug"

# From file
npx envoy --system-prompt-file ./prompts/coding-expert.txt "Review this code"

# Prepend to default prompt
npx envoy --system-prompt-mode prepend --system-prompt "Be concise" "Explain AI"
```

## Logging and Debugging

### Log Levels

```bash
# Detailed debugging
npx envoy --log-level DEBUG --log-progress all "Debug this issue"

# Tool execution logs only
npx envoy --log-progress tool "Use the calculator"

# Assistant responses only
npx envoy --log-progress assistant "Analyze this"
```

### Log Files

Logs are stored in:

- **macOS**: `~/Library/Application Support/envoy/`
- **Linux**: `~/.local/share/envoy/`
- **Windows**: `%APPDATA%/envoy/`

Structure:

```
envoy/
├── sessions/     # Session conversation logs
└── mcp-tools/    # MCP tool execution logs
```

## Development

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Interactive tests (TTY emulation)
npm run test:interactive

# E2E tests
npm run test:e2e
```

### Code Quality

```bash
# Type checking
npm run type

# Format code
npm run format

# Check formatting
npm run format:check

# Complete check (type + test + format)
npm run check
```

## Examples

### Basic Usage

```bash
# Simple question
npx envoy "What's the capital of France?"

# Code analysis
npx envoy "Analyze this JavaScript function for potential bugs"

# Mathematical computation
npx envoy "Calculate compound interest: $1000 principal, 5% annual rate, 10 years"
```

### Advanced Features

```bash
# Multi-step reasoning with thinking
npx envoy "think deeply about the environmental impact of different energy sources"

# Using specific models
npx envoy --provider openai --model gpt-4 "Explain quantum entanglement"

# Automated resource discovery
npx envoy --auto-resources "Analyze the performance of our React components"

# JSON output for automation
npx envoy --json "What's 15% of 250?" | jq '.response'
```

### MCP Workflows

```bash
# List and execute prompts
npx envoy --list-prompts
npx envoy --prompt "code-review" --prompt-args '{"language":"python"}'

# Resource-based analysis
npx envoy --resources "file://./src/main.ts" "Review this code for security issues"

# Interactive prompt exploration
npx envoy --interactive-prompt
```

## Troubleshooting

### Authentication Issues

```bash
# Check auth status
npx envoy auth status

# Re-authenticate
npx envoy auth logout
npx envoy auth login
```

### Debug Mode

```bash
# Full debugging output
npx envoy --log-level DEBUG --log-progress all "debug command"
```

### Configuration Issues

```bash
# Validate configuration
npx envoy --log-level INFO "test" # Will show config loading messages
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run check`
5. Submit a pull request
