/**
 * MCP command handlers
 * Handles MCP prompt and resource operations
 */

import inquirer from 'inquirer';
import { logger } from '../../logger.js';
import type {
  MCPClientWrapper,
  MCPPrompt,
  MCPResource,
  ResourceContent,
} from '../../types/index.js';

/**
 * Handles the --list-prompts command
 */
export async function handleListPrompts(
  clientWrappers: MCPClientWrapper[],
  jsonMode: boolean
): Promise<void> {
  const allPrompts = [];

  for (const wrapper of clientWrappers) {
    try {
      const prompts = await wrapper.listPrompts();
      for (const prompt of prompts) {
        allPrompts.push({
          server: wrapper.serverName,
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
        });
      }
    } catch (error) {
      logger.warn(
        `Failed to list prompts from ${wrapper.serverName}: ${error}`
      );
    }
  }

  if (jsonMode) {
    process.stdout.write(JSON.stringify(allPrompts, null, 2) + '\n');
  } else {
    if (allPrompts.length === 0) {
      process.stdout.write('No prompts available from any MCP server.\n');
    } else {
      process.stdout.write(`\nAvailable Prompts (${allPrompts.length}):\n\n`);
      for (const prompt of allPrompts) {
        process.stdout.write(`${prompt.server}:${prompt.name}\n`);
        if (prompt.description) {
          process.stdout.write(`  Description: ${prompt.description}\n`);
        }
        if (prompt.arguments && prompt.arguments.length > 0) {
          process.stdout.write(`  Arguments:\n`);
          for (const arg of prompt.arguments) {
            const required = arg.required ? ' (required)' : '';
            process.stdout.write(
              `    - ${arg.name}${required}: ${arg.description || 'No description'}\n`
            );
          }
        }
        process.stdout.write('\n');
      }
    }
  }
}

/**
 * Handles the --list-resources command
 */
export async function handleListResources(
  clientWrappers: MCPClientWrapper[],
  jsonMode: boolean
): Promise<void> {
  const allResources = [];

  for (const wrapper of clientWrappers) {
    try {
      const resources = await wrapper.listResources();
      for (const resource of resources) {
        allResources.push({
          server: wrapper.serverName,
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
        });
      }
    } catch (error) {
      logger.warn(
        `Failed to list resources from ${wrapper.serverName}: ${error}`
      );
    }
  }

  if (jsonMode) {
    process.stdout.write(JSON.stringify(allResources, null, 2) + '\n');
  } else {
    if (allResources.length === 0) {
      process.stdout.write('No resources available from any MCP server.\n');
    } else {
      process.stdout.write(`\nAvailable Resources (${allResources.length}):\n\n`);
      for (const resource of allResources) {
        process.stdout.write(`${resource.server}: ${resource.uri}\n`);
        if (resource.name) {
          process.stdout.write(`  Name: ${resource.name}\n`);
        }
        if (resource.description) {
          process.stdout.write(`  Description: ${resource.description}\n`);
        }
        if (resource.mimeType) {
          process.stdout.write(`  MIME Type: ${resource.mimeType}\n`);
        }
        process.stdout.write('\n');
      }
    }
  }
}

/**
 * Handles the --prompt command
 */
export async function handleExecutePrompt(
  clientWrappers: MCPClientWrapper[],
  promptName: string,
  promptArgsJson?: string,
  jsonMode: boolean = false
): Promise<boolean> {
  // Parse prompt arguments if provided
  let promptArgs: Record<string, unknown> = {};
  if (promptArgsJson) {
    try {
      promptArgs = JSON.parse(promptArgsJson);
    } catch (error) {
      const message = `Invalid JSON in --prompt-args: ${error instanceof Error ? error.message : String(error)}`;
      if (jsonMode) {
        process.stdout.write(JSON.stringify({ error: message }, null, 2) + '\n');
      } else {
        process.stderr.write(message + '\n');
      }
      return false;
    }
  }

  // Find the prompt across all servers
  for (const wrapper of clientWrappers) {
    try {
      const prompts = await wrapper.listPrompts();
      const prompt = prompts.find(p => p.name === promptName);

      if (prompt) {
        try {
          const result = await wrapper.getPrompt(promptName, promptArgs);

          if (jsonMode) {
            process.stdout.write(
              JSON.stringify(
                {
                  server: wrapper.serverName,
                  prompt: promptName,
                  result: result,
                },
                null,
                2
              ) + '\n'
            );
          } else {
            process.stdout.write(`\nPrompt: ${wrapper.serverName}:${promptName}\n`);
            if (result.description) {
              process.stdout.write(`Description: ${result.description}\n\n`);
            }

            for (const message of result.messages) {
              process.stdout.write(
                `[${message.role}] ${message.content.text || JSON.stringify(message.content)}\n`
              );
            }
          }
          return true;
        } catch (error) {
          const message = `Failed to execute prompt '${promptName}': ${error instanceof Error ? error.message : String(error)}`;
          if (jsonMode) {
            process.stdout.write(JSON.stringify({ error: message }, null, 2) + '\n');
          } else {
            process.stderr.write(message + '\n');
          }
          return false;
        }
      }
    } catch (error) {
      logger.warn(
        `Failed to check prompts from ${wrapper.serverName}: ${error}`
      );
    }
  }

  const message = `Prompt '${promptName}' not found in any MCP server`;
  if (jsonMode) {
    process.stdout.write(JSON.stringify({ error: message }, null, 2) + '\n');
  } else {
    process.stderr.write(message + '\n');
  }
  return false;
}

/**
 * Handles the --interactive-prompt command
 */
export async function handleInteractivePrompt(
  clientWrappers: MCPClientWrapper[],
  jsonMode: boolean
): Promise<boolean> {
  // Collect all available prompts
  const allPrompts: Array<{
    name: string;
    serverName: string;
    displayName: string;
    description?: string;
    prompt: MCPPrompt;
  }> = [];

  for (const wrapper of clientWrappers) {
    try {
      const prompts = await wrapper.listPrompts();
      for (const prompt of prompts) {
        allPrompts.push({
          name: prompt.name,
          serverName: wrapper.serverName,
          displayName: `${wrapper.serverName}:${prompt.name}`,
          description: prompt.description,
          prompt: prompt,
        });
      }
    } catch (error) {
      logger.warn(
        `Failed to list prompts from ${wrapper.serverName}: ${error}`
      );
    }
  }

  if (allPrompts.length === 0) {
    const message = 'No prompts available from any MCP server.';
    if (jsonMode) {
      process.stdout.write(JSON.stringify({ error: message }, null, 2) + '\n');
    } else {
      process.stdout.write(message + '\n');
    }
    return false;
  }

  if (jsonMode) {
    // In JSON mode, we can't do interactive selection, so return the prompts
    process.stdout.write(
      JSON.stringify(
        {
          message:
            'Interactive mode not available in JSON output. Available prompts:',
          prompts: allPrompts.map(p => ({
            server: p.serverName,
            name: p.name,
            description: p.description,
            displayName: p.displayName,
          })),
        },
        null,
        2
      ) + '\n'
    );
    return true;
  }

  try {
    // Interactive prompt selection
    const { selectedPrompt } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedPrompt',
        message: 'Select a prompt to execute:',
        choices: allPrompts.map(p => ({
          name: `${p.displayName} - ${p.description}`,
          value: p,
        })),
        pageSize: 10,
      },
    ]);

    // Collect prompt arguments if needed
    const args: Record<string, unknown> = {};
    if (
      selectedPrompt.prompt.arguments &&
      selectedPrompt.prompt.arguments.length > 0
    ) {
      process.stdout.write(
        `\nPrompt "${selectedPrompt.displayName}" requires arguments:\n`
      );

      for (const arg of selectedPrompt.prompt.arguments) {
        const questions = [];

        const questionConfig = {
          type: 'input' as const,
          name: 'value',
          message: `${arg.name}${arg.required ? ' (required)' : ' (optional)'}:`,
          validate: undefined as
            | ((input: string) => boolean | string)
            | undefined,
        };

        if (arg.description) {
          questionConfig.message += ` ${arg.description}`;
        }

        if (arg.required) {
          questionConfig.validate = (input: string) => {
            if (!input || input.trim().length === 0) {
              return 'This field is required';
            }
            return true;
          };
        }

        questions.push(questionConfig);

        const { value } = await inquirer.prompt(questions);

        if (value && value.trim().length > 0) {
          // Try to parse as JSON first, fallback to string
          try {
            args[arg.name] = JSON.parse(value);
          } catch {
            args[arg.name] = value;
          }
        }
      }
    }

    // Find the wrapper and execute the prompt
    const wrapper = clientWrappers.find(
      w => w.serverName === selectedPrompt.serverName
    );
    if (!wrapper) {
      process.stderr.write(`Error: Server ${selectedPrompt.serverName} not found\n`);
      return false;
    }

    try {
      process.stdout.write(`\nExecuting prompt: ${selectedPrompt.displayName}\n\n`);

      const result = await wrapper.getPrompt(selectedPrompt.name, args);

      process.stdout.write(`Prompt: ${selectedPrompt.displayName}\n`);
      if (result.description) {
        process.stdout.write(`Description: ${result.description}\n\n`);
      }

      for (const message of result.messages) {
        process.stdout.write(
          `[${message.role}] ${message.content.text || JSON.stringify(message.content)}\n`
        );
      }

      return true;
    } catch (error) {
      process.stderr.write(
        `Failed to execute prompt '${selectedPrompt.displayName}': ${error instanceof Error ? error.message : String(error)}\n`
      );
      return false;
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'isTtyError' in error) {
      process.stdout.write(
        'Interactive mode requires a TTY terminal. Use --list-prompts to see available prompts, then use --prompt <name> to execute one.\n'
      );
      return true;
    }
    process.stderr.write(
      `Interactive prompt error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return false;
  }
}

/**
 * Handles resource inclusion for --resources flag
 */
export async function handleResourceInclusion(
  resourceUris: string,
  clientWrappers: MCPClientWrapper[]
): Promise<string> {
  const uris = resourceUris.split(',').map(uri => uri.trim());
  const resourceContents: string[] = [];

  for (const uri of uris) {
    let found = false;

    for (const wrapper of clientWrappers) {
      try {
        const resources = await wrapper.listResources();
        const resource = resources.find(r => r.uri === uri);

        if (resource) {
          const content = await wrapper.readResource(uri);
          const formattedContent = formatResourceContent(content, uri);
          resourceContents.push(formattedContent);
          found = true;
          break;
        }
      } catch (error) {
        logger.warn(
          `Failed to read resource ${uri} from ${wrapper.serverName}: ${error}`
        );
      }
    }

    if (!found) {
      logger.warn(`Resource not found: ${uri}`);
      resourceContents.push(`Resource not found: ${uri}`);
    }
  }

  if (resourceContents.length === 0) {
    return '';
  }

  return `\n\n## Included Resources:\n\n${resourceContents.join('\n\n')}`;
}

/**
 * Handles automatic resource discovery for --auto-resources flag
 */
export async function handleAutoResourceDiscovery(
  userMessage: string,
  clientWrappers: MCPClientWrapper[]
): Promise<string> {
  const relevantResources: Array<{
    uri: string;
    score: number;
    wrapper: MCPClientWrapper;
  }> = [];

  // Keywords that indicate resource relevance
  const keywords = [
    'log',
    'error',
    'config',
    'debug',
    'file',
    'doc',
    'readme',
    'data',
    'api',
    'auth',
  ];
  const messageLower = userMessage.toLowerCase();

  for (const wrapper of clientWrappers) {
    try {
      const resources = await wrapper.listResources();

      for (const resource of resources) {
        const score = calculateResourceRelevance(
          messageLower,
          resource,
          keywords
        );

        if (score > 0) {
          relevantResources.push({
            uri: resource.uri,
            score,
            wrapper,
          });
        }
      }
    } catch (error) {
      logger.warn(
        `Failed to list resources from ${wrapper.serverName}: ${error}`
      );
    }
  }

  // Sort by relevance score and take top 5
  relevantResources.sort((a, b) => b.score - a.score);
  const topResources = relevantResources.slice(0, 5);

  if (topResources.length === 0) {
    return '';
  }

  // Read content for top resources
  const resourceContents: string[] = [];
  for (const resource of topResources) {
    try {
      const content = await resource.wrapper.readResource(resource.uri);
      const formattedContent = formatResourceContent(content, resource.uri);
      resourceContents.push(formattedContent);
    } catch (error) {
      logger.warn(`Failed to read resource ${resource.uri}: ${error}`);
    }
  }

  logger.info(
    `Auto-discovered ${topResources.length} relevant resources: ${topResources.map(r => r.uri).join(', ')}`
  );

  return `\n\n## Auto-Discovered Resources:\n\n${resourceContents.join('\n\n')}`;
}

/**
 * Calculates relevance score for a resource based on user message
 */
export function calculateResourceRelevance(
  messageLower: string,
  resource: MCPResource,
  keywords: string[]
): number {
  let score = 0;

  const resourceText = [
    resource.uri,
    resource.name || '',
    resource.description || '',
  ]
    .join(' ')
    .toLowerCase();

  // Check for keyword matches
  for (const keyword of keywords) {
    if (messageLower.includes(keyword) && resourceText.includes(keyword)) {
      score += 2;
    }
  }

  // Check for special authentication matches
  if (
    (messageLower.includes('authentication') ||
      messageLower.includes('auth')) &&
    (resourceText.includes('auth') || resourceText.includes('authentication'))
  ) {
    score += 3;
  }

  // Check for file extension matches
  if (messageLower.includes('log') && resource.uri.includes('.log')) {
    score += 3;
  }
  if (
    messageLower.includes('config') &&
    (resource.uri.includes('.config') ||
      resource.uri.includes('.json') ||
      resource.uri.includes('.yaml'))
  ) {
    score += 3;
  }
  if (
    messageLower.includes('doc') &&
    (resource.uri.includes('.md') ||
      resource.uri.includes('.txt') ||
      resource.uri.includes('readme'))
  ) {
    score += 3;
  }

  // Bonus for exact name matches
  const resourceName = (
    resource.name ||
    resource.uri.split('/').pop() ||
    ''
  ).toLowerCase();
  if (messageLower.includes(resourceName) && resourceName.length > 3) {
    score += 5;
  }

  return score;
}

/**
 * Formats resource content for inclusion in context
 */
export function formatResourceContent(
  content: ResourceContent,
  uri: string
): string {
  const parts: string[] = [`### Resource: ${uri}`];

  for (const item of content.contents) {
    if (item.text) {
      parts.push('```');
      parts.push(item.text);
      parts.push('```');
    } else if (item.blob) {
      parts.push(`[Binary content: ${item.mimeType || 'unknown type'}]`);
    } else {
      parts.push('[No content available]');
    }
  }

  return parts.join('\n');
}
