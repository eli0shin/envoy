import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { z } from 'zod';

// Create an MCP server
const server = new McpServer({
  name: 'demo-server',
  version: '1.0.0',
});

// ---- TOOLS ----

// Add an addition tool
server.registerTool(
  'add',
  {
    title: 'Addition Tool',
    description: 'Add two numbers',
    inputSchema: { a: z.number(), b: z.number() },
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: String(a + b) }],
  })
);

// ---- RESOURCES ----

// Add a simple resource
server.registerResource(
  'simple-resource',
  'simple://resource',
  {
    title: 'Simple',
    description: 'A simple resource',
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: `This resource is really simple`,
      },
    ],
  })
);

// Add a dynamic greeting resource
server.registerResource(
  'greeting',
  new ResourceTemplate('greeting://{name}', { list: undefined }),
  {
    title: 'Greeting Resource', // Display name for UI
    description: 'Dynamic greeting generator',
  },
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Hello, ${name}!`,
      },
    ],
  })
);

// ---- PROMPTS ----

server.registerPrompt(
  'simple-prompt',
  {
    title: 'Simple Prompt',
    description: 'Just a simple prompt to tests that prompts work',
  },
  () => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Read this simple prompt back to the user.`,
        },
      },
    ],
  })
);

server.registerPrompt(
  'review-code',
  {
    title: 'Code Review',
    description: 'Review code for best practices and potential issues',
    argsSchema: { code: z.string() },
  },
  ({ code }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please review this code:\n\n${code}`,
        },
      },
    ],
  })
);

// Prompt with context-aware completion
server.registerPrompt(
  'team-greeting',
  {
    title: 'Team Greeting',
    description: 'Generate a greeting for team members',
    argsSchema: {
      department: completable(z.string(), (value) => {
        // Department suggestions
        return ['engineering', 'sales', 'marketing', 'support'].filter((d) =>
          d.startsWith(value)
        );
      }),
      name: completable(z.string(), (value, context) => {
        // Name suggestions based on selected department
        const department = context?.arguments?.['department'];
        if (department === 'engineering') {
          return ['Alice', 'Bob', 'Charlie'].filter((n) => n.startsWith(value));
        } else if (department === 'sales') {
          return ['David', 'Eve', 'Frank'].filter((n) => n.startsWith(value));
        } else if (department === 'marketing') {
          return ['Grace', 'Henry', 'Iris'].filter((n) => n.startsWith(value));
        }
        return ['Guest'].filter((n) => n.startsWith(value));
      }),
    },
  },
  ({ department, name }) => ({
    messages: [
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `Hello ${name}, welcome to the ${department} team!`,
        },
      },
    ],
  })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
