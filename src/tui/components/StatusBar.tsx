import { fg } from '@opentui/core';
import { statusColors, colors } from '../theme.js';
import type { AgentSession } from '../../agentSession.js';
import type { ModelMessage } from 'ai';

type Status = 'READY' | 'PROCESSING';

type StatusBarProps = {
  status: Status;
  session: AgentSession;
  exitConfirmation?: boolean;
  queuedMessages?: (ModelMessage & { id: string })[];
};

export function StatusBar({
  status,
  session,
  exitConfirmation,
  queuedMessages = [],
}: StatusBarProps) {
  const queuedCount = queuedMessages.length;
  let statusText = status === 'PROCESSING' ? 'Working...' : 'Ready';

  if (status === 'PROCESSING' && queuedCount > 0) {
    statusText = `Working... (${queuedCount} message${queuedCount > 1 ? 's' : ''} queued)`;
  }

  const statusColor = statusColors[status];

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
    <box style={{ flexDirection: 'column' }}>
      <box
        style={{
          height: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <text>
          {exitConfirmation ?
            fg(colors.warning)(` Press Ctrl+C again to exit`)
          : fg(statusColor)(` ${statusText}`)}
        </text>
        <text>{fg(colors.muted)(`${sessionInfo} `)}</text>
      </box>
      {/* Bottom padding line */}
      <box style={{ height: 1 }}>
        <text> </text>
      </box>
    </box>
  );
}
