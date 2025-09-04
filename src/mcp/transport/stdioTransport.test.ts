/**
 * Tests for Stdio Transport Module
 * Tests individual functions in isolation for meaningful verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Mock only dependencies we need to control
vi.mock('./commandResolver.js', () => ({
  resolveCommand: vi.fn(),
}));

vi.mock('../../logger.js', () => ({
  logMcpTool: vi.fn(),
}));

// Import after mocks
import {
  setupStderrLogging,
  createClientInfo,
  createClientCapabilities,
  createTransportConfig,
  extractChildProcess,
  createStdioClient,
} from './stdioTransport.js';
import type { StdioMCPServerConfig } from '../../types/index.js';
import { resolveCommand } from './commandResolver.js';
import { logMcpTool } from '../../logger.js';

describe('Stdio Transport', () => {
  const mockResolveCommand = vi.mocked(resolveCommand);
  const mockLogMcpTool = vi.mocked(logMcpTool);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setupStderrLogging', () => {
    it('should set up stderr logging for child process with stderr', () => {
      const mockStderr = new EventEmitter();
      const mockChildProcess = {
        stderr: mockStderr,
      } as unknown as ChildProcess;

      setupStderrLogging(mockChildProcess, 'test-server');

      // Verify listeners were attached
      expect(mockStderr.listenerCount('data')).toBe(1);
      expect(mockStderr.listenerCount('end')).toBe(1);
    });

    it('should handle stderr data and log complete lines', () => {
      const mockStderr = new EventEmitter();
      const mockChildProcess = {
        stderr: mockStderr,
      } as unknown as ChildProcess;

      setupStderrLogging(mockChildProcess, 'test-server');

      // Emit data with multiple lines
      mockStderr.emit('data', Buffer.from('Line 1\nLine 2\nPartial'));

      expect(mockLogMcpTool).toHaveBeenCalledWith(
        'test-server',
        'stderr',
        'INFO',
        'Line 1'
      );
      expect(mockLogMcpTool).toHaveBeenCalledWith(
        'test-server',
        'stderr',
        'INFO',
        'Line 2'
      );
      expect(mockLogMcpTool).toHaveBeenCalledTimes(2);
    });

    it('should flush buffer on end event', () => {
      const mockStderr = new EventEmitter();
      const mockChildProcess = {
        stderr: mockStderr,
      } as unknown as ChildProcess;

      setupStderrLogging(mockChildProcess, 'test-server');

      // Emit partial data, then end
      mockStderr.emit('data', Buffer.from('Partial line'));
      mockStderr.emit('end');

      expect(mockLogMcpTool).toHaveBeenCalledWith(
        'test-server',
        'stderr',
        'INFO',
        'Partial line'
      );
    });

    it('should ignore empty lines', () => {
      const mockStderr = new EventEmitter();
      const mockChildProcess = {
        stderr: mockStderr,
      } as unknown as ChildProcess;

      setupStderrLogging(mockChildProcess, 'test-server');

      mockStderr.emit('data', Buffer.from('\n   \n\n'));

      expect(mockLogMcpTool).not.toHaveBeenCalled();
    });

    it('should handle child process without stderr', () => {
      const mockChildProcess = {
        stderr: null,
      } as unknown as ChildProcess;

      // Should not throw
      expect(() =>
        setupStderrLogging(mockChildProcess, 'test-server')
      ).not.toThrow();

      expect(mockLogMcpTool).not.toHaveBeenCalled();
    });

    it('should handle undefined child process', () => {
      // Should not throw
      expect(() =>
        setupStderrLogging(undefined as unknown as ChildProcess, 'test-server')
      ).not.toThrow();

      expect(mockLogMcpTool).not.toHaveBeenCalled();
    });
  });

  describe('createClientInfo', () => {
    it('should create client info with server name', () => {
      const config: StdioMCPServerConfig = {
        type: 'stdio',
        name: 'my-server',
        command: 'node',
      };

      const result = createClientInfo(config);

      expect(result).toEqual({
        name: 'envoy-my-server',
        version: '1.0.0',
      });
    });
  });

  describe('createClientCapabilities', () => {
    it('should create standard client capabilities', () => {
      const result = createClientCapabilities();

      expect(result).toEqual({
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      });
    });
  });

  describe('createTransportConfig', () => {
    it('should create transport config with all options', () => {
      const config: StdioMCPServerConfig = {
        type: 'stdio',
        name: 'test-server',
        command: 'node',
        args: ['script.js', '--flag'],
        env: { NODE_ENV: 'test' },
        cwd: '/test/path',
      };

      const result = createTransportConfig(config, '/usr/bin/node');

      expect(result).toEqual({
        command: '/usr/bin/node',
        args: ['script.js', '--flag'],
        env: { NODE_ENV: 'test' },
        cwd: '/test/path',
        stderr: 'pipe',
      });
    });

    it('should create transport config with minimal options', () => {
      const config: StdioMCPServerConfig = {
        type: 'stdio',
        name: 'minimal-server',
        command: 'node',
      };

      const result = createTransportConfig(config, '/usr/bin/node');

      expect(result).toEqual({
        command: '/usr/bin/node',
        args: [],
        env: undefined,
        cwd: undefined,
        stderr: 'pipe',
      });
    });
  });

  describe('extractChildProcess', () => {
    it('should extract child process from transport', () => {
      const mockProcess = { pid: 12345 } as ChildProcess;
      const mockTransport = {
        _process: mockProcess,
      } as unknown as StdioClientTransport;

      const result = extractChildProcess(mockTransport);

      expect(result).toBe(mockProcess);
    });

    it('should return undefined when no process in transport', () => {
      const mockTransport = {} as unknown as StdioClientTransport;

      const result = extractChildProcess(mockTransport);

      expect(result).toBeUndefined();
    });
  });

  describe('createStdioClient - Command Resolution', () => {
    it('should call resolveCommand with correct parameters', async () => {
      const config: StdioMCPServerConfig = {
        type: 'stdio',
        name: 'test-server',
        command: 'node',
      };

      mockResolveCommand.mockResolvedValue('/usr/bin/node');

      // This will likely fail at the MCP SDK level, but we're testing command resolution
      try {
        await createStdioClient(config);
      } catch {
        // Expected to fail, we're testing the command resolution part
      }

      expect(mockResolveCommand).toHaveBeenCalledWith('node');
    });

    it('should propagate command resolution errors', async () => {
      const config: StdioMCPServerConfig = {
        type: 'stdio',
        name: 'test-server',
        command: 'nonexistent-command',
      };

      mockResolveCommand.mockRejectedValue(
        new Error('Command not found in PATH')
      );

      await expect(createStdioClient(config)).rejects.toThrow(
        'Command not found in PATH'
      );
    });
  });
});
