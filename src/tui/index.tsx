import { render } from '@opentui/react';
import { TUIApp } from './components/TUIApp.js';
import type { AgentSession } from '../agentSession.js';
import type { RuntimeConfiguration } from '../config/types.js';

export async function launchTUI(
  config: RuntimeConfiguration,
  agentSession: AgentSession
): Promise<void> {
  // Remove opentui's SIGINT handler and install a no-op to prevent process.exit()
  // This allows Ctrl+C to be handled by our keyboard event system
  process.removeAllListeners('SIGINT');
  process.on('SIGINT', () => {
    // No-op: let the keypress handler (from stdin \x03) handle Ctrl+C
  });

  // Initialize TUI with existing session
  // exitOnCtrlC: false allows Ctrl+C keypress (\x03) to reach our handlers
  render(<TUIApp config={config} session={agentSession} />, {
    exitOnCtrlC: false,
  });
}
