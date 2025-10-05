import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { error as errorColor, filePath } from '../theme.js';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ProcessManager } from '../../mcp/processManager.js';

type ErrorFallbackProps = {
  error: Error;
  resetErrorBoundary: () => void;
};

function ErrorFallback({ error }: ErrorFallbackProps) {
  useEffect(() => {
    const handleKeyPress = (chunk: Buffer) => {
      const key = chunk.toString();
      // Check for Ctrl+C (ASCII code 3)
      if (key === '\u0003') {
        // Clean up MCP server processes before exiting
        const processManager = ProcessManager.getInstance();
        processManager.cleanupAll();

        // Move cursor to bottom left of terminal
        process.stdout.write('\x1b[999B\x1b[1G');
        process.exit(0);
      }
    };

    process.stdin.on('data', handleKeyPress);

    return () => {
      process.stdin.off('data', handleKeyPress);
    };
  }, []);

  return (
    <box
      flexDirection="column"
      padding={2}
      borderStyle="single"
      borderColor={errorColor}
    >
      <text><b><span fg={errorColor}>Error: Component Crashed</span></b></text>
      <text paddingTop={1}>
        <span fg={errorColor}>{error.message || 'Unknown error'}</span>
      </text>
      <text paddingTop={1}>
        <span fg={filePath}>{error.stack || 'No stack trace'}</span>
      </text>
      <text paddingTop={1}>
        <span fg={errorColor}>Press Ctrl+C to exit</span>
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
