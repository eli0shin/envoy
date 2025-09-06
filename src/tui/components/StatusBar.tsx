import { fg } from '@opentui/core';
import type { AgentSession } from '../../agentSession.js';

type Status = 'READY' | 'PROCESSING';

type StatusBarProps = {
  status: Status;
  session: AgentSession;
};

export function StatusBar({ status, session }: StatusBarProps) {
  const statusText = status === 'PROCESSING' ? 'Processing...' : 'Ready';
  const statusColor = status === 'PROCESSING' ? 'yellow' : 'green';

  // Extract provider, model, and auth info from session
  const modelId = session.model.modelId || 'unknown';
  const authMethod = session.authInfo.method;
  
  // Determine provider from model ID or auth info
  let provider = 'unknown';
  if (modelId.includes('claude')) {
    provider = 'anthropic';
  } else if (modelId.includes('gpt') || modelId.includes('o1')) {
    provider = 'openai';
  } else if (modelId.includes('gemini')) {
    provider = 'google';
  } else if (modelId.includes('/')) {
    provider = 'openrouter';
  }

  const sessionInfo = `${provider} | ${authMethod} | ${modelId}`;

  return (
    <box style={{ flexDirection: "column" }}>
      <box style={{ height: 1, flexDirection: "row", justifyContent: "space-between" }}>
        <text>
          {fg(statusColor)(` ${statusText}`)}
        </text>
        <text>
          {fg('gray')(`${sessionInfo} `)}
        </text>
      </box>
      {/* Bottom padding line */}
      <box style={{ height: 1 }}>
        <text> </text>
      </box>
    </box>
  );
}