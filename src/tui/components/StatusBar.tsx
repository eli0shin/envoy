import { fg } from '@opentui/core';

type Status = 'READY' | 'PROCESSING';

type StatusBarProps = {
  status: Status;
};

export function StatusBar({ status }: StatusBarProps) {
  const statusText = status === 'PROCESSING' ? 'Processing...' : 'Ready';
  const statusColor = status === 'PROCESSING' ? 'yellow' : 'green';

  return (
    <box 
      height={1} 
      padding={1} 
      justifyContent="space-between"
    >
      <text>
        {fg(statusColor)(statusText)}
      </text>
      <text>
        {fg('gray')('Ctrl+C to exit')}
      </text>
    </box>
  );
}