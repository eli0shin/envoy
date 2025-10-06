import { lightGray, success, error } from '../../theme.js';
import { extractResultText } from '../../utils/toolFormatting.js';
import type { ToolMessageComponentProps } from '../types.js';

export function SpawnAgentToolMessage({
  displayName,
  args,
  output,
  error: errorPayload,
  isError,
}: ToolMessageComponentProps) {
  // Extract the result text
  const successText = extractResultText(output);
  const errorText = extractResultText(
    errorPayload ?? (isError ? output : undefined)
  );

  // Parse the JSON response
  let parsedResult: {
    success?: boolean;
    response?: string;
    error?: string;
    toolCallsCount?: number;
    executionTime?: number;
  } | null = null;

  try {
    if (successText) {
      parsedResult = JSON.parse(successText);
    }
  } catch {
    // If parsing fails, fall back to raw text
  }

  // Extract message from args
  const message =
    typeof args === 'object' && args !== null && 'message' in args ?
      (args as { message: string }).message
    : '';

  return (
    <box flexDirection="column">
      <text>
        <b>
          <span fg={lightGray}>{displayName || 'Spawn Agent'}</span>
        </b>
      </text>
      {message ?
        <text paddingLeft={2}>
          <span fg={lightGray}>Task: {message}</span>
        </text>
      : null}
      {parsedResult ?
        <box flexDirection="column" paddingLeft={2}>
          {parsedResult.success ?
            <>
              {parsedResult.response ?
                <text>
                  <span fg={success}>✓ {parsedResult.response}</span>
                </text>
              : null}
              {parsedResult.toolCallsCount !== undefined ?
                <text>
                  <span fg={lightGray}>
                    Tools used: {parsedResult.toolCallsCount}
                  </span>
                </text>
              : null}
              {parsedResult.executionTime !== undefined ?
                <text>
                  <span fg={lightGray}>
                    Time: {Math.round(parsedResult.executionTime / 1000)}s
                  </span>
                </text>
              : null}
            </>
          : <text>
              <span fg={error}>✗ {parsedResult.error || 'Failed'}</span>
            </text>
          }
        </box>
      : isError && errorText ?
        <text paddingLeft={2}>
          <span fg={error}>✗ {errorText}</span>
        </text>
      : null}
    </box>
  );
}
