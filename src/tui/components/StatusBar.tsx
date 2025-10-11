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

const EMPTY_QUEUED_MESSAGES: (ModelMessage & { id: string })[] = [];

export function StatusBar({
  status,
  session,
  exitConfirmation,
  queuedMessages = EMPTY_QUEUED_MESSAGES,
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
    <box flexDirection="column" flexShrink={0} minHeight={2}>
      <box
        height={1}
        flexDirection="row"
        justifyContent="space-between"
        flexShrink={0}
      >
        <text>
          {exitConfirmation ?
            <span fg={colors.warning}> Press Ctrl+C again to exit</span>
          : <span fg={statusColor}> {statusText}</span>}
        </text>
        <text><span fg={colors.muted}>{sessionInfo} </span></text>
      </box>
      {/* Bottom padding line */}
      <box height={1}>
        <text> </text>
      </box>
    </box>
  );
}
