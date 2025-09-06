import { render } from '@opentui/react';
import { TUIApp } from './components/TUIApp.js';
import type { AgentSession } from '../agentSession.js';
import type { RuntimeConfiguration } from '../config/types.js';

export async function launchTUI(
  config: RuntimeConfiguration,
  agentSession: AgentSession
): Promise<void> {
  // Initialize TUI with existing session
  render(
    <TUIApp
      config={config}
      session={agentSession}
    />
  );
}