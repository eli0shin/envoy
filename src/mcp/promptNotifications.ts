/**
 * MCP Prompt Notification Handler
 * Handles notifications when prompt lists change and updates the prompt registry
 */

import type { MCPClientWrapper } from "../types/index.js";
// PromptRegistry removed with UI - notifications disabled
import { logger } from "../logger.js";

/**
 * Sets up prompt list change notifications for a single MCP client
 */
export function setupPromptNotificationsForClient(
  wrapper: MCPClientWrapper,
): void {
  try {
    // Access the underlying MCP client to set up notification handlers
    const client = wrapper.client as unknown as {
      setNotificationHandler: (schema: unknown, handler: unknown) => void;
    };

    // Skip if no client (failed wrapper)
    if (!client) return;

    // Set up handler for prompt list changes
    client.setNotificationHandler(
      {
        method: "notifications/prompts/list_changed",
        params: {
          _meta: {},
        },
      },
      async (_notification: unknown) => {
        logger.debug(`Prompts list changed for server: ${wrapper.serverName}`);

        // Prompt registry removed with UI - just log the change
        logger.debug(
          `Prompts list changed for server: ${wrapper.serverName} (no action taken)`,
        );
      },
    );
  } catch (error) {
    logger.warn(
      `Failed to set up notification handlers for ${wrapper.serverName}: ${error}`,
    );
  }
}

/**
 * Sets up prompt notifications for all MCP clients
 */
export function setupPromptNotificationsForAllClients(
  mcpClients: MCPClientWrapper[],
): void {
  for (const wrapper of mcpClients) {
    setupPromptNotificationsForClient(wrapper);
  }
}
