import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { fg, bold } from '@opentui/core';
import type { ReactNode } from 'react';

type ErrorFallbackProps = {
  error: Error;
  resetErrorBoundary: () => void;
};

function ErrorFallback({ error }: ErrorFallbackProps) {
  return (
    <box
      flexDirection="column"
      padding={2}
      borderStyle="single"
      borderColor="#FF6B6B"
    >
      <text>{bold(fg('#FF6B6B')('Error: Component Crashed'))}</text>
      <text paddingTop={1}>
        {fg('#FF6B6B')(error.message || 'Unknown error')}
      </text>
      <text paddingTop={1}>
        {fg('#A0A0A0')(error.stack || 'No stack trace')}
      </text>
    </box>
  );
}

type ErrorBoundaryProps = {
  children: ReactNode;
};

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return (
    // @ts-expect-error - React 19 TypeScript compatibility issue with react-error-boundary
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}