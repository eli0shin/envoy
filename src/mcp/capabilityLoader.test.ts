/**
 * Tests for Capability Loader Module
 * Following strict TDD - tests written first before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZodType, ZodTypeDef } from 'zod/v3';
import { ChildProcess } from 'child_process';
import { loadCapabilitiesAndCreateWrapper } from './capabilityLoader.js';
import type {
  ServerInitResult,
  WrappedTool,
  MCPPrompt,
  MCPResource,
} from '../types/index.js';
import {
  createMockClient,
  createMockMCPClientWrapper,
  createMockChildProcess,
} from '../test/helpers/createMocks.js';
import { logger } from '../logger.js';

vi.mock('./capabilities/capabilityLoader.js', () => ({
  loadToolsFromServer: vi.fn(),
  loadPromptsFromServer: vi.fn(),
  loadResourcesFromServer: vi.fn(),
}));

vi.mock('./clientWrapperFactory.js', () => ({
  createMCPClientWrapperFromData: vi.fn(),
}));

import {
  loadToolsFromServer,
  loadPromptsFromServer,
  loadResourcesFromServer,
} from './capabilities/capabilityLoader.js';
import { createMCPClientWrapperFromData } from './clientWrapperFactory.js';

function createMockTool(name: string): WrappedTool {
  return {
    toolName: name,
    serverName: 'test-server',
    description: `Test tool ${name}`,
    inputSchema: {} as ZodType<unknown, ZodTypeDef, unknown>,
    execute: vi.fn(),
  };
}

function createMockPrompt(name: string): MCPPrompt {
  return {
    name,
    description: `Test prompt ${name}`,
  };
}

function createMockResource(uri: string): MCPResource {
  return {
    uri,
    name: `Test resource ${uri}`,
  };
}

describe('Capability Loader Module', () => {
  const mockLoadToolsFromServer = vi.mocked(loadToolsFromServer);
  const mockLoadPromptsFromServer = vi.mocked(loadPromptsFromServer);
  const mockLoadResourcesFromServer = vi.mocked(loadResourcesFromServer);
  const mockCreateMCPClientWrapperFromData = vi.mocked(
    createMCPClientWrapperFromData
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadCapabilitiesAndCreateWrapper', () => {
    const mockChildProcess = createMockChildProcess() as ChildProcess;
    const baseServerInit: ServerInitResult = {
      client: createMockClient(),
      capabilities: {},
      config: {
        name: 'test-server',
        type: 'stdio',
        command: 'test-command',
      },
      childProcess: mockChildProcess,
      serverInfo: {
        name: 'test-server',
        version: '1.0.0',
      },
    };

    it('should load all capabilities when server declares them all', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      };

      const mockTools = [createMockTool('tool1'), createMockTool('tool2')];
      const mockPrompts = [createMockPrompt('prompt1')];
      const mockResources = [createMockResource('resource1')];
      const mockWrapper = createMockMCPClientWrapper();

      mockLoadToolsFromServer.mockResolvedValue({ tools: mockTools });
      mockLoadPromptsFromServer.mockResolvedValue({ prompts: mockPrompts });
      mockLoadResourcesFromServer.mockResolvedValue({
        resources: mockResources,
      });
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.tools).toEqual(mockTools);
      expect(result.wrapper).toBe(mockWrapper);
      expect(result.errors).toEqual([]);

      expect(mockLoadToolsFromServer).toHaveBeenCalledWith(serverInit.config);
      expect(mockLoadPromptsFromServer).toHaveBeenCalledWith(
        serverInit.client,
        'test-server'
      );
      expect(mockLoadResourcesFromServer).toHaveBeenCalledWith(
        serverInit.client,
        'test-server'
      );
      expect(mockCreateMCPClientWrapperFromData).toHaveBeenCalledWith(
        serverInit.client,
        serverInit.config,
        serverInit.capabilities,
        mockTools,
        mockPrompts,
        mockResources,
        mockChildProcess
      );
    });

    it('should skip capabilities that server does not declare', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          tools: {},
          // No prompts or resources capabilities
        },
      };

      const mockTools = [createMockTool('tool1')];
      const mockWrapper = createMockMCPClientWrapper();

      mockLoadToolsFromServer.mockResolvedValue({ tools: mockTools });
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.tools).toEqual(mockTools);
      expect(result.wrapper).toBe(mockWrapper);
      expect(result.errors).toEqual([]);

      expect(mockLoadToolsFromServer).toHaveBeenCalledWith(serverInit.config);
      expect(mockLoadPromptsFromServer).not.toHaveBeenCalled();
      expect(mockLoadResourcesFromServer).not.toHaveBeenCalled();
      expect(mockCreateMCPClientWrapperFromData).toHaveBeenCalledWith(
        serverInit.client,
        serverInit.config,
        serverInit.capabilities,
        mockTools,
        [], // empty prompts
        [], // empty resources
        mockChildProcess
      );
    });

    it('should handle tools loading error and continue with other capabilities', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      };

      const mockPrompts = [createMockPrompt('prompt1')];
      const mockResources = [createMockResource('resource1')];
      const mockWrapper = createMockMCPClientWrapper();

      mockLoadToolsFromServer.mockResolvedValue({
        tools: [],
        error: 'Failed to load tools',
      });
      mockLoadPromptsFromServer.mockResolvedValue({ prompts: mockPrompts });
      mockLoadResourcesFromServer.mockResolvedValue({
        resources: mockResources,
      });
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.tools).toEqual([]);
      expect(result.wrapper).toBe(mockWrapper);
      expect(result.errors).toEqual(['Tools: Failed to load tools']);

      expect(mockCreateMCPClientWrapperFromData).toHaveBeenCalledWith(
        serverInit.client,
        serverInit.config,
        serverInit.capabilities,
        [], // empty tools due to error
        mockPrompts,
        mockResources,
        mockChildProcess
      );
    });

    it('should handle prompts loading error', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      };

      const mockTools = [createMockTool('tool1')];
      const mockResources = [createMockResource('resource1')];
      const mockWrapper = createMockMCPClientWrapper();

      mockLoadToolsFromServer.mockResolvedValue({ tools: mockTools });
      mockLoadPromptsFromServer.mockResolvedValue({
        prompts: [],
        error: 'Failed to load prompts',
      });
      mockLoadResourcesFromServer.mockResolvedValue({
        resources: mockResources,
      });
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.errors).toEqual(['Prompts: Failed to load prompts']);
      expect(mockCreateMCPClientWrapperFromData).toHaveBeenCalledWith(
        serverInit.client,
        serverInit.config,
        serverInit.capabilities,
        mockTools,
        [], // empty prompts due to error
        mockResources,
        mockChildProcess
      );
    });

    it('should handle resources loading error', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      };

      const mockTools = [createMockTool('tool1')];
      const mockPrompts = [createMockPrompt('prompt1')];
      const mockWrapper = createMockMCPClientWrapper();

      mockLoadToolsFromServer.mockResolvedValue({ tools: mockTools });
      mockLoadPromptsFromServer.mockResolvedValue({ prompts: mockPrompts });
      mockLoadResourcesFromServer.mockResolvedValue({
        resources: [],
        error: 'Failed to load resources',
      });
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.errors).toEqual(['Resources: Failed to load resources']);
      expect(mockCreateMCPClientWrapperFromData).toHaveBeenCalledWith(
        serverInit.client,
        serverInit.config,
        serverInit.capabilities,
        mockTools,
        mockPrompts,
        [], // empty resources due to error
        mockChildProcess
      );
    });

    it('should handle multiple loading errors', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      };

      const mockWrapper = createMockMCPClientWrapper();

      mockLoadToolsFromServer.mockResolvedValue({
        tools: [],
        error: 'Tools failed',
      });
      mockLoadPromptsFromServer.mockResolvedValue({
        prompts: [],
        error: 'Prompts failed',
      });
      mockLoadResourcesFromServer.mockResolvedValue({
        resources: [],
        error: 'Resources failed',
      });
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.errors).toEqual([
        'Tools: Tools failed',
        'Prompts: Prompts failed',
        'Resources: Resources failed',
      ]);
    });

    it('should handle exception during tools loading', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          tools: {},
        },
      };

      const mockWrapper = createMockMCPClientWrapper();

      mockLoadToolsFromServer.mockRejectedValue(new Error('Connection failed'));
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.errors).toEqual(['Tools: Connection failed']);
      expect(mockCreateMCPClientWrapperFromData).toHaveBeenCalledWith(
        serverInit.client,
        serverInit.config,
        serverInit.capabilities,
        [], // empty tools due to exception
        [],
        [],
        mockChildProcess
      );
    });

    it('should handle exception during prompts loading', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          prompts: {},
        },
      };

      const mockWrapper = createMockMCPClientWrapper();

      mockLoadPromptsFromServer.mockRejectedValue(new Error('Network error'));
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.errors).toEqual(['Prompts: Network error']);
    });

    it('should handle exception during resources loading', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          resources: {},
        },
      };

      const mockWrapper = createMockMCPClientWrapper();

      mockLoadResourcesFromServer.mockRejectedValue(new Error('Timeout error'));
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.errors).toEqual(['Resources: Timeout error']);
    });

    it('should handle non-Error exceptions', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          tools: {},
        },
      };

      const mockWrapper = createMockMCPClientWrapper();

      mockLoadToolsFromServer.mockRejectedValue('String error');
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.errors).toEqual(['Tools: Unknown error']);
    });

    it('should load capabilities in parallel', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      };

      const mockTools = [createMockTool('tool1')];
      const mockPrompts = [createMockPrompt('prompt1')];
      const mockResources = [createMockResource('resource1')];
      const mockWrapper = createMockMCPClientWrapper();

      // Track call order
      const callOrder: string[] = [];

      mockLoadToolsFromServer.mockImplementation(async () => {
        callOrder.push('tools-start');
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push('tools-end');
        return { tools: mockTools };
      });

      mockLoadPromptsFromServer.mockImplementation(async () => {
        callOrder.push('prompts-start');
        await new Promise((resolve) => setTimeout(resolve, 5));
        callOrder.push('prompts-end');
        return { prompts: mockPrompts };
      });

      mockLoadResourcesFromServer.mockImplementation(async () => {
        callOrder.push('resources-start');
        await new Promise((resolve) => setTimeout(resolve, 15));
        callOrder.push('resources-end');
        return { resources: mockResources };
      });

      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      // All should start before any end (parallel execution)
      expect(callOrder).toEqual([
        'tools-start',
        'prompts-start',
        'resources-start',
        'prompts-end', // shortest delay finishes first
        'tools-end',
        'resources-end',
      ]);

      expect(result.tools).toEqual(mockTools);
      expect(result.wrapper).toBe(mockWrapper);
      expect(result.errors).toEqual([]);
    });

    it('should log debug messages appropriately', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {
          tools: {},
          // No prompts capability
        },
      };

      const mockTools = [createMockTool('tool1')];
      const mockWrapper = createMockMCPClientWrapper();

      mockLoadToolsFromServer.mockResolvedValue({ tools: mockTools });
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(logger.debug).toHaveBeenCalledWith(
        'Server test-server declares tools capability - loading tools'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Server test-server does not declare prompts capability - skipping prompts'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Server test-server does not declare resources capability - skipping resources'
      );
    });

    it('should work with empty capabilities object', async () => {
      const serverInit: ServerInitResult = {
        ...baseServerInit,
        capabilities: {}, // No capabilities declared
      };

      const mockWrapper = createMockMCPClientWrapper();
      mockCreateMCPClientWrapperFromData.mockReturnValue(mockWrapper);

      const result = await loadCapabilitiesAndCreateWrapper(serverInit);

      expect(result.tools).toEqual([]);
      expect(result.wrapper).toBe(mockWrapper);
      expect(result.errors).toEqual([]);

      expect(mockLoadToolsFromServer).not.toHaveBeenCalled();
      expect(mockLoadPromptsFromServer).not.toHaveBeenCalled();
      expect(mockLoadResourcesFromServer).not.toHaveBeenCalled();

      expect(mockCreateMCPClientWrapperFromData).toHaveBeenCalledWith(
        serverInit.client,
        serverInit.config,
        serverInit.capabilities,
        [],
        [],
        [],
        mockChildProcess
      );
    });
  });
});
