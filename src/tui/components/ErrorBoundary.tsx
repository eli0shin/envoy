import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { fg, bold } from '@opentui/core';
import { error as errorColor, filePath } from '../theme.js';
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
      borderColor={errorColor}
    >
      <text>{bold(fg(errorColor)('Error: Component Crashed'))}</text>
      <text paddingTop={1}>
        {fg(errorColor)(error.message || 'Unknown error')}
      </text>
      <text paddingTop={1}>
        {fg(filePath)(error.stack || 'No stack trace')}
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