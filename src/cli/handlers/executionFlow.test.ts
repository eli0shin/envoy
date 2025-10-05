/**
 * Tests for executionFlow.ts module
 * Tests main CLI execution orchestration functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { parseArguments } from '../config/argumentParser.js';
import { readStdin } from '../io/inputHandler.js';
import { shouldActivateInteractiveMode } from '../handlers/interactiveMode.js';
import {
  createRuntimeConfiguration,
  getMCPServersFromConfig,
} from '../../config/index.js';
import { createMCPClientWrapper } from '../../mcp/loader.js';
import {
  createMockMCPClientWrapper,
  createMockAgentSession,
} from '../../test/helpers/createMocks.js';
import {
  initializeAgent,
  runAgent,
  formatExecutionSummary,
} from '../../agent/index.js';
import {
  initializeAgentSession,
  cleanupAgentSession,
} from '../../agentSession.js';

import {
  handleListPrompts,
  handleListResources,
  handleExecutePrompt,
  handleInteractivePrompt,
  handleResourceInclusion,
  handleAutoResourceDiscovery,
} from '../handlers/mcpCommands.js';

// Mock TUI modules to avoid React import issues
vi.mock('../../tui/index.js', () => ({
  launchTUI: vi.fn(),
}));

import {
  handleSessionListing,
  handlePromptResourceCommands,
  main,
} from './executionFlow.js';
import type { CLIOptions } from '../../types/index.js';
import type { Configuration } from '../../config/types.js';

// Pre-configured mock that avoids redundant assignment patterns
vi.mock('../../mcp/loader.js', () => ({
  createMCPClientWrapper: vi.fn().mockResolvedValue({
    serverName: 'test-server',
    serverConfig: {
      type: 'stdio',
      name: 'test-server',
      command: 'test-command',
      args: [],
    },
    tools: {},
    prompts: new Map(),
    resources: new Map(),
    isConnected: true,
    listPrompts: vi.fn().mockResolvedValue([]),
    getPrompt: vi.fn(),
    listResources: vi.fn().mockResolvedValue([]),
    readResource: vi.fn(),
  }),
}));

vi.mock('../../persistence/ConversationPersistence.js', () => ({
  ConversationPersistence: {
    getProjectIdentifier: vi.fn().mockReturnValue('mock-project-id'),
    isValidSessionId: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../config/index.js', () => ({
  createRuntimeConfiguration: vi.fn(),
  getMCPServersFromConfig: vi.fn().mockReturnValue([]),
}));

// Mock @opentui/react to avoid import issues
vi.mock('@opentui/react', () => ({
  useKeyboard: vi.fn(),
  render: vi.fn(),
  Text: vi.fn(() => null),
  Box: vi.fn(() => null),
}));

vi.mock('../../agent/index.js', () => ({
  runAgent: vi.fn(),
  formatExecutionSummary: vi.fn().mockReturnValue('Mock execution summary'),
  initializeAgent: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../agentSession.js', () => ({
  initializeAgentSession: vi.fn(),
  cleanupAgentSession: vi.fn(),
}));

vi.mock('../../ui/inkInteractiveMode.js', () => ({
  runInkInteractiveMode: vi.fn(),
}));

vi.mock('../config/argumentParser.js', () => ({
  parseArguments: vi.fn(),
}));

vi.mock('../io/inputHandler.js', () => ({
  readStdin: vi.fn(),
}));

vi.mock('../handlers/interactiveMode.js', () => ({
  shouldActivateInteractiveMode: vi.fn(),
}));

vi.mock('../handlers/mcpCommands.js', () => ({
  handleListPrompts: vi.fn(),
  handleListResources: vi.fn(),
  handleExecutePrompt: vi.fn(),
  handleInteractivePrompt: vi.fn(),
  handleResourceInclusion: vi.fn(),
  handleAutoResourceDiscovery: vi.fn(),
}));

// Mock process.stdout.write and process.stderr.write methods
const mockStdoutWrite = vi.fn();
const mockStderrWrite = vi.fn();
Object.defineProperty(process.stdout, 'write', {
  value: mockStdoutWrite,
  writable: true,
});
Object.defineProperty(process.stderr, 'write', {
  value: mockStderrWrite,
  writable: true,
});

// Mock process.exit
const mockExit = vi.fn();
Object.defineProperty(process, 'exit', {
  value: mockExit,
  writable: true,
});

describe('executionFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStdoutWrite.mockClear();
    mockStderrWrite.mockClear();
    mockExit.mockClear();
  });

  describe('handleSessionListing', () => {
    it('should return not handled when listSessions is false', async () => {
      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listSessions: false,
      };

      const result = await handleSessionListing(options);

      expect(result).toEqual({ handled: false, success: true });
    });

    it('should handle session listing when listSessions is true', async () => {
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      vi.mocked(fs.promises.readdir).mockResolvedValue([
        'session1.jsonl',
        'session2.jsonl',
        'other.txt',
      ] as never);

      const mockStats = { size: 1024 };
      vi.mocked(fs.promises.stat).mockResolvedValue(mockStats as fs.Stats);

      const mockFileContent = JSON.stringify({
        timestamp: '2023-01-01T00:00:00Z',
      });
      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listSessions: true,
      };

      const result = await handleSessionListing(options);

      expect(result).toEqual({ handled: true, success: true });
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Conversation Sessions')
      );
    });

    it('should handle empty session directory', async () => {
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);
      vi.mocked(fs.promises.readdir).mockResolvedValue([]);

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listSessions: true,
      };

      const result = await handleSessionListing(options);

      expect(result).toEqual({ handled: true, success: true });
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        'No conversation sessions found for this project.\n'
      );
    });

    it('should handle directory not found error', async () => {
      const error = new Error('Directory not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.promises.access).mockRejectedValue(error);

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listSessions: true,
      };

      const result = await handleSessionListing(options);

      expect(result).toEqual({ handled: true, success: true });
      expect(mockStdoutWrite).toHaveBeenCalledWith(
        'No conversation sessions found for this project.\n'
      );
    });

    it('should handle other errors', async () => {
      vi.mocked(fs.promises.access).mockRejectedValue(
        new Error('Permission denied')
      );

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listSessions: true,
      };

      const result = await handleSessionListing(options);

      expect(result).toEqual({ handled: true, success: false });
      expect(mockStderrWrite).toHaveBeenCalledWith(
        expect.stringContaining('Error listing sessions')
      );
    });
  });

  describe('handlePromptResourceCommands', () => {
    const mockConfig: Configuration = {
      providers: { default: 'anthropic' },
      agent: {
        maxSteps: 100,
        timeout: 30000,
        logLevel: 'INFO',
        logProgress: 'none',
        streaming: true,
      },
      tools: {
        globalTimeout: 60000,
        disabledInternalTools: [],
      },
    };

    it('should return not handled when no prompt/resource commands', async () => {
      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: false,
        listResources: false,

        interactivePrompt: false,
      };

      const result = await handlePromptResourceCommands(options, mockConfig);

      expect(result).toEqual({ handled: false, success: true });
    });

    it('should handle listPrompts command', async () => {
      vi.mocked(getMCPServersFromConfig).mockReturnValue([
        { name: 'test-server', command: 'test-command', type: 'stdio' },
      ]);

      // Override createMCPClientWrapper to ensure it returns a working mock
      const mockWrapper = createMockMCPClientWrapper({});

      vi.mocked(createMCPClientWrapper).mockResolvedValueOnce(mockWrapper);

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: true,
      };

      const result = await handlePromptResourceCommands(options, mockConfig);

      expect(result).toEqual({ handled: true, success: true });
      expect(handleListPrompts).toHaveBeenCalled();
    });

    it('should handle listResources command', async () => {
      vi.mocked(getMCPServersFromConfig).mockReturnValue([
        { name: 'test-server', command: 'test-command', type: 'stdio' },
      ]);

      // Override createMCPClientWrapper to ensure it returns a working mock
      const mockWrapper = createMockMCPClientWrapper({});

      vi.mocked(createMCPClientWrapper).mockResolvedValueOnce(mockWrapper);

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listResources: true,
      };

      const result = await handlePromptResourceCommands(options, mockConfig);

      expect(result).toEqual({ handled: true, success: true });
      expect(handleListResources).toHaveBeenCalled();
    });

    it('should handle execute prompt command', async () => {
      vi.mocked(getMCPServersFromConfig).mockReturnValue([
        { name: 'test-server', command: 'test-command', type: 'stdio' },
      ]);
      vi.mocked(handleExecutePrompt).mockResolvedValue(true);

      // Override createMCPClientWrapper to ensure it returns a working mock
      const mockWrapper = createMockMCPClientWrapper({});

      vi.mocked(createMCPClientWrapper).mockResolvedValueOnce(mockWrapper);

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        prompt: 'test-prompt',
      };

      const result = await handlePromptResourceCommands(options, mockConfig);

      expect(result).toEqual({ handled: true, success: true });
      expect(handleExecutePrompt).toHaveBeenCalled();
    });

    it('should handle interactive prompt command', async () => {
      vi.mocked(getMCPServersFromConfig).mockReturnValue([
        { name: 'test-server', command: 'test-command', type: 'stdio' },
      ]);
      vi.mocked(handleInteractivePrompt).mockResolvedValue(true);

      // Override createMCPClientWrapper to ensure it returns a working mock
      const mockWrapper = createMockMCPClientWrapper({});

      vi.mocked(createMCPClientWrapper).mockResolvedValueOnce(mockWrapper);

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        interactivePrompt: true,
      };

      const result = await handlePromptResourceCommands(options, mockConfig);

      expect(result).toEqual({ handled: true, success: true });
      expect(handleInteractivePrompt).toHaveBeenCalled();
    });

    it('should handle no MCP servers available', async () => {
      vi.mocked(getMCPServersFromConfig).mockReturnValue([]);

      const options: CLIOptions = {
        logLevel: 'SILENT',
        logProgress: 'none',
        json: false,
        stdin: false,
        maxSteps: 100,
        systemPromptMode: 'append',
        listPrompts: true,
      };

      const result = await handlePromptResourceCommands(options, mockConfig);

      expect(result).toEqual({ handled: true, success: false });
      expect(mockStderrWrite).toHaveBeenCalledWith(
        expect.stringContaining('No MCP servers available')
      );
    });
  });

  describe('main', () => {
    it('should handle basic execution flow', async () => {
      vi.mocked(parseArguments).mockResolvedValue({
        options: {
          logLevel: 'SILENT',
          logProgress: 'none',
          json: false,
          stdin: false,
          maxSteps: 100,
          systemPromptMode: 'append',
        },
        message: 'test message',
      });

      vi.mocked(createRuntimeConfiguration).mockResolvedValue({
        config: {
          message: 'test message',
          stdin: false,
          json: false,
          providers: {
            default: 'anthropic',
            openai: {},
            openrouter: {},
            anthropic: {},
            google: {},
          },
          agent: {
            maxSteps: 100,
            timeout: 30000,
            logLevel: 'INFO',
            logProgress: 'none',
            streaming: true,
          },
          tools: {
            globalTimeout: 60000,
            disabledInternalTools: [],
          },
        },
        errors: [],
        loadedFrom: [],
      });

      vi.mocked(shouldActivateInteractiveMode).mockReturnValue(false);
      vi.mocked(initializeAgent).mockResolvedValue(true);
      const mockAgentSession = createMockAgentSession({
        systemPrompt: 'test prompt',
      });
      vi.mocked(initializeAgentSession).mockResolvedValue(mockAgentSession);
      vi.mocked(runAgent).mockResolvedValue({
        success: true,
        toolCallsCount: 0,
        executionTime: 1000,
      });

      await main();

      expect(mockExit).toHaveBeenCalledWith(0);
      expect(parseArguments).toHaveBeenCalled();
      expect(createRuntimeConfiguration).toHaveBeenCalled();
      expect(initializeAgent).toHaveBeenCalled();
      expect(runAgent).toHaveBeenCalled();
      expect(cleanupAgentSession).toHaveBeenCalled();
    });

    it('should handle stdin input', async () => {
      vi.mocked(parseArguments).mockResolvedValue({
        options: {
          logLevel: 'SILENT',
          logProgress: 'none',
          json: false,
          stdin: true,
          maxSteps: 100,
          systemPromptMode: 'append',
        },
        message: undefined,
      });

      vi.mocked(readStdin).mockResolvedValue('stdin message');

      vi.mocked(createRuntimeConfiguration).mockResolvedValue({
        config: {
          message: undefined,
          stdin: true,
          json: false,
          providers: {
            default: 'anthropic',
            openai: {},
            openrouter: {},
            anthropic: {},
            google: {},
          },
          agent: {
            maxSteps: 100,
            timeout: 30000,
            logLevel: 'INFO',
            logProgress: 'none',
            streaming: true,
          },
          tools: {
            globalTimeout: 60000,
            disabledInternalTools: [],
          },
        },
        errors: [],
        loadedFrom: [],
      });

      vi.mocked(shouldActivateInteractiveMode).mockReturnValue(false);
      vi.mocked(initializeAgent).mockResolvedValue(true);
      const mockAgentSession = createMockAgentSession({
        systemPrompt: 'test prompt',
      });
      vi.mocked(initializeAgentSession).mockResolvedValue(mockAgentSession);
      vi.mocked(runAgent).mockResolvedValue({
        success: true,
        toolCallsCount: 0,
        executionTime: 1000,
      });

      await main();

      expect(readStdin).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle resource inclusion', async () => {
      vi.mocked(parseArguments).mockResolvedValue({
        options: {
          logLevel: 'SILENT',
          logProgress: 'none',
          json: false,
          stdin: false,
          maxSteps: 100,
          systemPromptMode: 'append',
          resources: 'file:///test.txt',
        },
        message: 'test message',
      });

      vi.mocked(createRuntimeConfiguration).mockResolvedValue({
        config: {
          message: 'test message',
          stdin: false,
          json: false,
          providers: {
            default: 'anthropic',
            openai: {},
            openrouter: {},
            anthropic: {},
            google: {},
          },
          agent: {
            maxSteps: 100,
            timeout: 30000,
            logLevel: 'INFO',
            logProgress: 'none',
            streaming: true,
          },
          tools: {
            globalTimeout: 60000,
            disabledInternalTools: [],
          },
        },
        errors: [],
        loadedFrom: [],
      });

      vi.mocked(shouldActivateInteractiveMode).mockReturnValue(false);
      vi.mocked(initializeAgent).mockResolvedValue(true);
      const mockAgentSession = createMockAgentSession({
        systemPrompt: 'test prompt',
      });
      vi.mocked(initializeAgentSession).mockResolvedValue(mockAgentSession);
      vi.mocked(getMCPServersFromConfig).mockReturnValue([
        { name: 'test-server', command: 'test-command', type: 'stdio' },
      ]);

      // Override createMCPClientWrapper to ensure it returns a working mock
      const mockWrapper = createMockMCPClientWrapper({});

      vi.mocked(createMCPClientWrapper).mockResolvedValue(mockWrapper);

      vi.mocked(handleResourceInclusion).mockResolvedValue(
        '\n\n## Resources:\nTest content'
      );
      vi.mocked(runAgent).mockResolvedValue({
        success: true,
        toolCallsCount: 0,
        executionTime: 1000,
      });

      await main();

      expect(handleResourceInclusion).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle auto resource discovery', async () => {
      vi.mocked(parseArguments).mockResolvedValue({
        options: {
          logLevel: 'SILENT',
          logProgress: 'none',
          json: false,
          stdin: false,
          maxSteps: 100,
          systemPromptMode: 'append',
          autoResources: true,
        },
        message: 'test message',
      });

      vi.mocked(createRuntimeConfiguration).mockResolvedValue({
        config: {
          message: 'test message',
          stdin: false,
          json: false,
          providers: {
            default: 'anthropic',
            openai: {},
            openrouter: {},
            anthropic: {},
            google: {},
          },
          agent: {
            maxSteps: 100,
            timeout: 30000,
            logLevel: 'INFO',
            logProgress: 'none',
            streaming: true,
          },
          tools: {
            globalTimeout: 60000,
            disabledInternalTools: [],
          },
        },
        errors: [],
        loadedFrom: [],
      });

      vi.mocked(shouldActivateInteractiveMode).mockReturnValue(false);
      vi.mocked(initializeAgent).mockResolvedValue(true);
      const mockAgentSession = createMockAgentSession({
        systemPrompt: 'test prompt',
      });
      vi.mocked(initializeAgentSession).mockResolvedValue(mockAgentSession);
      vi.mocked(getMCPServersFromConfig).mockReturnValue([
        { name: 'test-server', command: 'test-command', type: 'stdio' },
      ]);

      // Override createMCPClientWrapper to ensure it returns a working mock
      const mockWrapper = createMockMCPClientWrapper({});

      vi.mocked(createMCPClientWrapper).mockResolvedValue(mockWrapper);

      vi.mocked(handleAutoResourceDiscovery).mockResolvedValue(
        '\n\n## Auto Resources:\nAuto content'
      );
      vi.mocked(runAgent).mockResolvedValue({
        success: true,
        toolCallsCount: 0,
        executionTime: 1000,
      });

      await main();

      expect(handleAutoResourceDiscovery).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should handle fatal errors', async () => {
      vi.mocked(parseArguments).mockRejectedValue(new Error('Fatal error'));

      await main();

      expect(mockStderrWrite).toHaveBeenCalledWith(
        expect.stringContaining('Fatal error')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle agent initialization failure', async () => {
      vi.mocked(parseArguments).mockResolvedValue({
        options: {
          logLevel: 'SILENT',
          logProgress: 'none',
          json: false,
          stdin: false,
          maxSteps: 100,
          systemPromptMode: 'append',
        },
        message: 'test message',
      });

      vi.mocked(createRuntimeConfiguration).mockResolvedValue({
        config: {
          message: 'test message',
          stdin: false,
          json: false,
          providers: {
            default: 'anthropic',
            openai: {},
            openrouter: {},
            anthropic: {},
            google: {},
          },
          agent: {
            maxSteps: 100,
            timeout: 30000,
            logLevel: 'INFO',
            logProgress: 'none',
            streaming: true,
          },
          tools: {
            globalTimeout: 60000,
            disabledInternalTools: [],
          },
        },
        errors: [],
        loadedFrom: [],
      });

      vi.mocked(shouldActivateInteractiveMode).mockReturnValue(false);
      vi.mocked(initializeAgent).mockResolvedValue(false);

      await main();

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle agent execution failure', async () => {
      vi.mocked(parseArguments).mockResolvedValue({
        options: {
          logLevel: 'SILENT',
          logProgress: 'none',
          json: false,
          stdin: false,
          maxSteps: 100,
          systemPromptMode: 'append',
        },
        message: 'test message',
      });

      vi.mocked(createRuntimeConfiguration).mockResolvedValue({
        config: {
          message: 'test message',
          stdin: false,
          json: false,
          providers: {
            default: 'anthropic',
            openai: {},
            openrouter: {},
            anthropic: {},
            google: {},
          },
          agent: {
            maxSteps: 100,
            timeout: 30000,
            logLevel: 'INFO',
            logProgress: 'none',
            streaming: true,
          },
          tools: {
            globalTimeout: 60000,
            disabledInternalTools: [],
          },
        },
        errors: [],
        loadedFrom: [],
      });

      vi.mocked(shouldActivateInteractiveMode).mockReturnValue(false);
      vi.mocked(initializeAgent).mockResolvedValue(true);
      const mockAgentSession = createMockAgentSession({
        systemPrompt: 'test prompt',
      });
      vi.mocked(initializeAgentSession).mockResolvedValue(mockAgentSession);
      vi.mocked(runAgent).mockResolvedValue({
        success: false,
        toolCallsCount: 0,
        executionTime: 1000,
      });

      await main();

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should display execution summary when not in JSON mode', async () => {
      vi.mocked(parseArguments).mockResolvedValue({
        options: {
          logLevel: 'SILENT',
          logProgress: 'tool',
          json: false,
          stdin: false,
          maxSteps: 100,
          systemPromptMode: 'append',
        },
        message: 'test message',
      });

      vi.mocked(createRuntimeConfiguration).mockResolvedValue({
        config: {
          message: 'test message',
          stdin: false,
          json: false,
          providers: {
            default: 'anthropic',
            openai: {},
            openrouter: {},
            anthropic: {},
            google: {},
          },
          agent: {
            maxSteps: 100,
            timeout: 30000,
            logLevel: 'INFO',
            logProgress: 'tool',
            streaming: true,
          },
          tools: {
            globalTimeout: 60000,
            disabledInternalTools: [],
          },
        },
        errors: [],
        loadedFrom: [],
      });

      vi.mocked(shouldActivateInteractiveMode).mockReturnValue(false);
      vi.mocked(initializeAgent).mockResolvedValue(true);
      const mockAgentSession = createMockAgentSession({
        systemPrompt: 'test prompt',
      });
      vi.mocked(initializeAgentSession).mockResolvedValue(mockAgentSession);
      vi.mocked(runAgent).mockResolvedValue({
        success: true,
        toolCallsCount: 5,
        executionTime: 2000,
      });

      await main();

      expect(formatExecutionSummary).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });
});
