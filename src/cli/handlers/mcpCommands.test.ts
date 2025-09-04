/**
 * Tests for mcpCommands.ts module
 * Tests MCP prompt and resource command functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import inquirer from 'inquirer';
import {
  handleListPrompts,
  handleListResources,
  handleExecutePrompt,
  handleInteractivePrompt,
  handleResourceInclusion,
  handleAutoResourceDiscovery,
  calculateResourceRelevance,
  formatResourceContent,
} from './mcpCommands.js';
import type {
  MCPClientWrapper,
  MCPPrompt,
  MCPResource,
  ResourceContent,
} from '../../types/index.js';
import { createMockMCPClientWrapper } from '../../test/helpers/createMocks.js';

// Mock dependencies
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
};

Object.defineProperty(global, 'console', {
  value: mockConsole,
  writable: true,
});

describe('mcpCommands', () => {
  let mockClientWrapper: MCPClientWrapper;
  let mockPrompts: MCPPrompt[];
  let mockResources: MCPResource[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsole.log.mockClear();
    mockConsole.error.mockClear();

    mockPrompts = [
      {
        name: 'analyze-code',
        description: 'Analyze code for issues',
        arguments: [
          { name: 'file', required: true, description: 'File to analyze' },
          { name: 'severity', required: false, description: 'Severity level' },
        ],
      },
      {
        name: 'generate-docs',
        description: 'Generate documentation',
        arguments: [],
      },
    ];

    mockResources = [
      {
        uri: 'file:///project/config.json',
        name: 'config',
        description: 'Project configuration',
        mimeType: 'application/json',
      },
      {
        uri: 'file:///project/debug.log',
        name: 'debug-log',
        description: 'Debug log file',
        mimeType: 'text/plain',
      },
    ];

    mockClientWrapper = createMockMCPClientWrapper({
      serverName: 'test-server',
      listPrompts: vi.fn().mockResolvedValue(mockPrompts),
      listResources: vi.fn().mockResolvedValue(mockResources),
      getPrompt: vi.fn(),
      readResource: vi.fn(),
    });
  });

  describe('handleListPrompts', () => {
    it('should list prompts in JSON mode', async () => {
      await handleListPrompts([mockClientWrapper], true);

      expect(mockConsole.log).toHaveBeenCalledWith(
        JSON.stringify(
          [
            {
              server: 'test-server',
              name: 'analyze-code',
              description: 'Analyze code for issues',
              arguments: mockPrompts[0].arguments,
            },
            {
              server: 'test-server',
              name: 'generate-docs',
              description: 'Generate documentation',
              arguments: [],
            },
          ],
          null,
          2
        )
      );
    });

    it('should list prompts in regular mode', async () => {
      await handleListPrompts([mockClientWrapper], false);

      expect(mockConsole.log).toHaveBeenCalledWith(
        '\nAvailable Prompts (2):\n'
      );
      expect(mockConsole.log).toHaveBeenCalledWith('test-server:analyze-code');
      expect(mockConsole.log).toHaveBeenCalledWith(
        '  Description: Analyze code for issues'
      );
      expect(mockConsole.log).toHaveBeenCalledWith('  Arguments:');
      expect(mockConsole.log).toHaveBeenCalledWith(
        '    - file (required): File to analyze'
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        '    - severity: Severity level'
      );
    });

    it('should handle empty prompts list', async () => {
      mockClientWrapper.listPrompts = vi.fn().mockResolvedValue([]);

      await handleListPrompts([mockClientWrapper], false);

      expect(mockConsole.log).toHaveBeenCalledWith(
        'No prompts available from any MCP server.'
      );
    });

    it('should handle server errors gracefully', async () => {
      mockClientWrapper.listPrompts = vi
        .fn()
        .mockRejectedValue(new Error('Server error'));

      await handleListPrompts([mockClientWrapper], false);

      expect(mockConsole.log).toHaveBeenCalledWith(
        'No prompts available from any MCP server.'
      );
    });

    it('should handle multiple client wrappers', async () => {
      const mockClientWrapper2 = createMockMCPClientWrapper({
        serverName: 'test-server-2',
        listPrompts: vi
          .fn()
          .mockResolvedValue([
            { name: 'test-prompt', description: 'Test prompt', arguments: [] },
          ]),
      });

      await handleListPrompts([mockClientWrapper, mockClientWrapper2], false);

      expect(mockConsole.log).toHaveBeenCalledWith(
        '\nAvailable Prompts (3):\n'
      );
      expect(mockConsole.log).toHaveBeenCalledWith('test-server-2:test-prompt');
    });
  });

  describe('handleListResources', () => {
    it('should list resources in JSON mode', async () => {
      await handleListResources([mockClientWrapper], true);

      expect(mockConsole.log).toHaveBeenCalledWith(
        JSON.stringify(
          [
            {
              server: 'test-server',
              uri: 'file:///project/config.json',
              name: 'config',
              description: 'Project configuration',
              mimeType: 'application/json',
            },
            {
              server: 'test-server',
              uri: 'file:///project/debug.log',
              name: 'debug-log',
              description: 'Debug log file',
              mimeType: 'text/plain',
            },
          ],
          null,
          2
        )
      );
    });

    it('should list resources in regular mode', async () => {
      await handleListResources([mockClientWrapper], false);

      expect(mockConsole.log).toHaveBeenCalledWith(
        '\nAvailable Resources (2):\n'
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        'test-server: file:///project/config.json'
      );
      expect(mockConsole.log).toHaveBeenCalledWith('  Name: config');
      expect(mockConsole.log).toHaveBeenCalledWith(
        '  Description: Project configuration'
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        '  MIME Type: application/json'
      );
    });

    it('should handle empty resources list', async () => {
      mockClientWrapper.listResources = vi.fn().mockResolvedValue([]);

      await handleListResources([mockClientWrapper], false);

      expect(mockConsole.log).toHaveBeenCalledWith(
        'No resources available from any MCP server.'
      );
    });

    it('should handle server errors gracefully', async () => {
      mockClientWrapper.listResources = vi
        .fn()
        .mockRejectedValue(new Error('Server error'));

      await handleListResources([mockClientWrapper], false);

      expect(mockConsole.log).toHaveBeenCalledWith(
        'No resources available from any MCP server.'
      );
    });

    it('should handle resources without optional fields', async () => {
      const minimalResource = {
        uri: 'file:///project/minimal.txt',
      };
      mockClientWrapper.listResources = vi
        .fn()
        .mockResolvedValue([minimalResource]);

      await handleListResources([mockClientWrapper], false);

      expect(mockConsole.log).toHaveBeenCalledWith(
        'test-server: file:///project/minimal.txt'
      );
    });
  });

  describe('handleExecutePrompt', () => {
    it('should execute prompt and return success', async () => {
      const mockResult = {
        description: 'Analysis complete',
        messages: [
          { role: 'user', content: { text: 'Analyze this code' } },
          { role: 'assistant', content: { text: 'Code looks good' } },
        ],
      };
      mockClientWrapper.getPrompt = vi.fn().mockResolvedValue(mockResult);

      const result = await handleExecutePrompt(
        [mockClientWrapper],
        'analyze-code',
        '{"file": "test.js"}',
        false
      );

      expect(result).toBe(true);
      expect(mockClientWrapper.getPrompt).toHaveBeenCalledWith('analyze-code', {
        file: 'test.js',
      });
      expect(mockConsole.log).toHaveBeenCalledWith(
        '\nPrompt: test-server:analyze-code'
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        'Description: Analysis complete\n'
      );
      expect(mockConsole.log).toHaveBeenCalledWith('[user] Analyze this code');
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[assistant] Code looks good'
      );
    });

    it('should execute prompt in JSON mode', async () => {
      const mockResult = {
        messages: [{ role: 'assistant', content: { text: 'Result' } }],
      };
      mockClientWrapper.getPrompt = vi.fn().mockResolvedValue(mockResult);

      const result = await handleExecutePrompt(
        [mockClientWrapper],
        'analyze-code',
        undefined,
        true
      );

      expect(result).toBe(true);
      expect(mockConsole.log).toHaveBeenCalledWith(
        JSON.stringify(
          {
            server: 'test-server',
            prompt: 'analyze-code',
            result: mockResult,
          },
          null,
          2
        )
      );
    });

    it('should handle invalid JSON arguments', async () => {
      const result = await handleExecutePrompt(
        [mockClientWrapper],
        'analyze-code',
        '{invalid json}',
        false
      );

      expect(result).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON in --prompt-args')
      );
    });

    it('should handle prompt not found', async () => {
      mockClientWrapper.listPrompts = vi.fn().mockResolvedValue([]);

      const result = await handleExecutePrompt(
        [mockClientWrapper],
        'nonexistent-prompt',
        undefined,
        false
      );

      expect(result).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith(
        "Prompt 'nonexistent-prompt' not found in any MCP server"
      );
    });

    it('should handle prompt execution error', async () => {
      mockClientWrapper.getPrompt = vi
        .fn()
        .mockRejectedValue(new Error('Execution failed'));

      const result = await handleExecutePrompt(
        [mockClientWrapper],
        'analyze-code',
        undefined,
        false
      );

      expect(result).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to execute prompt')
      );
    });
  });

  describe('handleInteractivePrompt', () => {
    it('should handle interactive prompt selection', async () => {
      const mockInquirer = vi.mocked(inquirer);

      vi.mocked(mockInquirer.prompt)
        .mockResolvedValueOnce({
          selectedPrompt: {
            name: 'analyze-code',
            serverName: 'test-server',
            displayName: 'Analyze Code',
            prompt: mockPrompts[0],
          },
        })
        .mockResolvedValueOnce({ value: 'test.js' })
        .mockResolvedValueOnce({ value: 'high' });

      const mockResult = {
        description: 'Analysis complete',
        messages: [{ role: 'assistant', content: { text: 'Code analyzed' } }],
      };
      mockClientWrapper.getPrompt = vi.fn().mockResolvedValue(mockResult);

      const result = await handleInteractivePrompt([mockClientWrapper], false);

      expect(result).toBe(true);
      expect(mockClientWrapper.getPrompt).toHaveBeenCalledWith('analyze-code', {
        file: 'test.js',
        severity: 'high',
      });
    });

    it('should handle empty prompts list', async () => {
      mockClientWrapper.listPrompts = vi.fn().mockResolvedValue([]);

      const result = await handleInteractivePrompt([mockClientWrapper], false);

      expect(result).toBe(false);
      expect(mockConsole.log).toHaveBeenCalledWith(
        'No prompts available from any MCP server.'
      );
    });

    it('should handle JSON mode with available prompts', async () => {
      const result = await handleInteractivePrompt([mockClientWrapper], true);

      expect(result).toBe(true);
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Interactive mode not available in JSON output')
      );
    });

    it('should handle TTY error', async () => {
      const mockInquirer = vi.mocked(inquirer);

      const ttyError = new Error('TTY Error') as Error & {
        isTtyError: boolean;
      };
      ttyError.isTtyError = true;
      vi.mocked(mockInquirer.prompt).mockRejectedValueOnce(ttyError);

      const result = await handleInteractivePrompt([mockClientWrapper], false);

      expect(result).toBe(true);
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Interactive mode requires a TTY terminal')
      );
    });
  });

  describe('handleResourceInclusion', () => {
    it('should include specified resources', async () => {
      const mockContent: ResourceContent = {
        contents: [
          { uri: 'file:///project/config.json', text: 'Config content here' },
        ],
      };
      mockClientWrapper.readResource = vi.fn().mockResolvedValue(mockContent);

      const result = await handleResourceInclusion(
        'file:///project/config.json',
        [mockClientWrapper]
      );

      expect(result).toContain('## Included Resources:');
      expect(result).toContain('### Resource: file:///project/config.json');
      expect(result).toContain('Config content here');
    });

    it('should handle multiple resources', async () => {
      const mockContent: ResourceContent = {
        contents: [{ uri: 'file:///project/test.txt', text: 'Content' }],
      };
      mockClientWrapper.readResource = vi.fn().mockResolvedValue(mockContent);

      const result = await handleResourceInclusion(
        'file:///project/config.json,file:///project/debug.log',
        [mockClientWrapper]
      );

      expect(result).toContain('### Resource: file:///project/config.json');
      expect(result).toContain('### Resource: file:///project/debug.log');
      expect(mockClientWrapper.readResource).toHaveBeenCalledTimes(2);
    });

    it('should handle resource not found', async () => {
      mockClientWrapper.listResources = vi.fn().mockResolvedValue([]);

      const result = await handleResourceInclusion('file:///nonexistent.txt', [
        mockClientWrapper,
      ]);

      expect(result).toContain('Resource not found: file:///nonexistent.txt');
    });

    it('should handle empty resource list', async () => {
      mockClientWrapper.readResource = vi
        .fn()
        .mockRejectedValue(new Error('Not found'));

      const result = await handleResourceInclusion(
        'file:///project/config.json',
        [mockClientWrapper]
      );

      expect(result).toContain(
        'Resource not found: file:///project/config.json'
      );
    });
  });

  describe('handleAutoResourceDiscovery', () => {
    it('should discover relevant resources', async () => {
      const mockContent: ResourceContent = {
        contents: [{ uri: 'file:///project/debug.log', text: 'Log content' }],
      };
      mockClientWrapper.readResource = vi.fn().mockResolvedValue(mockContent);

      const result = await handleAutoResourceDiscovery('analyze debug log', [
        mockClientWrapper,
      ]);

      expect(result).toContain('## Auto-Discovered Resources:');
      expect(result).toContain('### Resource: file:///project/debug.log');
    });

    it('should return empty string when no relevant resources found', async () => {
      mockClientWrapper.listResources = vi.fn().mockResolvedValue([]);

      const result = await handleAutoResourceDiscovery('unrelated message', [
        mockClientWrapper,
      ]);

      expect(result).toBe('');
    });

    it('should limit to top 5 resources', async () => {
      const manyResources = Array.from({ length: 10 }, (_, i) => ({
        uri: `file:///project/log${i}.txt`,
        name: `log${i}`,
        description: 'Log file',
        mimeType: 'text/plain',
      }));
      mockClientWrapper.listResources = vi
        .fn()
        .mockResolvedValue(manyResources);

      const mockContent: ResourceContent = {
        contents: [{ uri: 'file:///project/debug.log', text: 'Log content' }],
      };
      mockClientWrapper.readResource = vi.fn().mockResolvedValue(mockContent);

      const _result = await handleAutoResourceDiscovery('log analysis', [
        mockClientWrapper,
      ]);

      expect(mockClientWrapper.readResource).toHaveBeenCalledTimes(5);
    });
  });

  describe('calculateResourceRelevance', () => {
    it('should calculate relevance score for keyword matches', () => {
      const resource = {
        uri: 'file:///project/config.json',
        name: 'config',
        description: 'Configuration file',
      };

      const score = calculateResourceRelevance('check config file', resource, [
        'config',
      ]);

      expect(score).toBeGreaterThan(0);
    });

    it('should give bonus for exact name matches', () => {
      const resource = {
        uri: 'file:///project/authentication.json',
        name: 'authentication',
        description: 'Auth configuration',
      };

      const score = calculateResourceRelevance(
        'authentication setup',
        resource,
        ['auth']
      );

      expect(score).toBeGreaterThan(3);
    });

    it('should handle file extension matches', () => {
      const resource = {
        uri: 'file:///project/app.log',
        name: 'app-log',
        description: 'Application log',
      };

      const score = calculateResourceRelevance('check log file', resource, [
        'log',
      ]);

      expect(score).toBeGreaterThan(0);
    });

    it('should return 0 for no matches', () => {
      const resource = {
        uri: 'file:///project/unrelated.txt',
        name: 'unrelated',
        description: 'Unrelated file',
      };

      const score = calculateResourceRelevance('database query', resource, [
        'log',
        'config',
      ]);

      expect(score).toBe(0);
    });
  });

  describe('formatResourceContent', () => {
    it('should format text content', () => {
      const content: ResourceContent = {
        contents: [{ uri: 'file:///test.txt', text: 'Sample text content' }],
      };

      const formatted = formatResourceContent(content, 'file:///test.txt');

      expect(formatted).toContain('### Resource: file:///test.txt');
      expect(formatted).toContain('```');
      expect(formatted).toContain('Sample text content');
    });

    it('should handle binary content', () => {
      const content: ResourceContent = {
        contents: [
          {
            uri: 'file:///image.png',
            blob: 'binary-data',
            mimeType: 'image/png',
          },
        ],
      };

      const formatted = formatResourceContent(content, 'file:///image.png');

      expect(formatted).toContain('### Resource: file:///image.png');
      expect(formatted).toContain('[Binary content: image/png]');
    });

    it('should handle empty content', () => {
      const content: ResourceContent = {
        contents: [{ uri: 'file:///empty.txt' }],
      };

      const formatted = formatResourceContent(content, 'file:///empty.txt');

      expect(formatted).toContain('### Resource: file:///empty.txt');
      expect(formatted).toContain('[No content available]');
    });

    it('should handle mixed content types', () => {
      const content: ResourceContent = {
        contents: [
          { uri: 'file:///mixed.txt', text: 'Text content' },
          {
            uri: 'file:///mixed.txt',
            blob: 'binary',
            mimeType: 'application/octet-stream',
          },
          { uri: 'file:///mixed.txt' },
        ],
      };

      const formatted = formatResourceContent(content, 'file:///mixed.txt');

      expect(formatted).toContain('Text content');
      expect(formatted).toContain('[Binary content: application/octet-stream]');
      expect(formatted).toContain('[No content available]');
    });
  });
});
