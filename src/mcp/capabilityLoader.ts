/**
 * Capability Loader Module
 * Handles parallel loading of server capabilities (tools, prompts, resources)
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  ServerInitResult,
  WrappedTool,
  MCPClientWrapper,
  MCPPrompt,
  MCPResource,
} from '../types/index.js';
import { logger } from '../logger.js';
import {
  loadToolsFromServer,
  loadPromptsFromServer,
  loadResourcesFromServer,
} from './capabilities/capabilityLoader.js';
import { createMCPClientWrapperFromData } from './clientWrapperFactory.js';

/**
 * Loads capabilities selectively and creates an MCPClientWrapper
 */
export async function loadCapabilitiesAndCreateWrapper(
  serverInit: ServerInitResult
): Promise<{
  tools: WrappedTool[];
  wrapper: MCPClientWrapper;
  errors: string[];
}> {
  const { client, capabilities, config, childProcess } = serverInit;
  const errors: string[] = [];
  let tools: WrappedTool[] = [];
  let prompts: MCPPrompt[] = [];
  let resources: MCPResource[] = [];

  const loadPromises: Promise<void>[] = [];

  // Load tools if server declares support
  if (capabilities.tools) {
    logger.debug(
      `Server ${config.name} declares tools capability - loading tools`
    );
    loadPromises.push(
      (async () => {
        try {
          const toolsResult = await loadToolsFromServer(config);
          if (toolsResult.error) {
            errors.push(`Tools: ${toolsResult.error}`);
          } else {
            tools = toolsResult.tools;
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Tools: ${errorMsg}`);
        }
      })()
    );
  } else {
    logger.debug(
      `Server ${config.name} does not declare tools capability - skipping tools`
    );
  }

  // Load prompts if server declares support
  if (capabilities.prompts) {
    logger.debug(
      `Server ${config.name} declares prompts capability - loading prompts`
    );
    loadPromises.push(
      (async () => {
        try {
          const promptsResult = await loadPromptsFromServer(
            client as Client,
            config.name
          );
          if (promptsResult.error) {
            errors.push(`Prompts: ${promptsResult.error}`);
          } else {
            prompts = promptsResult.prompts;
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Prompts: ${errorMsg}`);
        }
      })()
    );
  } else {
    logger.debug(
      `Server ${config.name} does not declare prompts capability - skipping prompts`
    );
  }

  // Load resources if server declares support
  if (capabilities.resources) {
    logger.debug(
      `Server ${config.name} declares resources capability - loading resources`
    );
    loadPromises.push(
      (async () => {
        try {
          const resourcesResult = await loadResourcesFromServer(
            client as Client,
            config.name
          );
          if (resourcesResult.error) {
            errors.push(`Resources: ${resourcesResult.error}`);
          } else {
            resources = resourcesResult.resources;
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Resources: ${errorMsg}`);
        }
      })()
    );
  } else {
    logger.debug(
      `Server ${config.name} does not declare resources capability - skipping resources`
    );
  }

  // Execute all capability loading in parallel
  await Promise.all(loadPromises);

  // Create the wrapper with pre-populated data (including child process for cleanup)
  const wrapper = await createMCPClientWrapperFromData(
    client as Client,
    config,
    capabilities,
    tools,
    prompts,
    resources,
    childProcess
  );

  return { tools, wrapper, errors };
}
