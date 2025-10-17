/**
 * Mock for Bun's $ shell function for testing
 * Uses Node.js spawn since tests run in Node environment
 */

import { spawn } from 'child_process';

type ShellResult = {
  exitCode: number;
  stdout: Buffer;
  stderr: Buffer;
};

type ShellCommand = {
  cwd(dir: string): ShellCommand;
  nothrow(): Promise<ShellResult>;
};

export function $(
  _strings: TemplateStringsArray,
  ...values: unknown[]
): ShellCommand {
  //  Extract raw command string
  const commandString =
    values[0] && typeof values[0] === 'object' && 'raw' in values[0] ?
      (values[0] as { raw: string }).raw
    : '';

  // Extract stdin Response if provided
  const stdinResponse = values.find((v) => v instanceof Response) as
    | Response
    | undefined;

  let cwdPath = process.cwd();

  const command: ShellCommand = {
    cwd(dir: string) {
      cwdPath = dir;
      return command;
    },
    async nothrow(): Promise<ShellResult> {
      return new Promise((resolve) => {
        // Use shell: true to let the shell handle argument parsing
        const proc = spawn(commandString, {
          cwd: cwdPath,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        proc.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
        proc.stderr.on('data', (chunk) => stderrChunks.push(chunk));

        // Write stdin if provided
        if (stdinResponse) {
          stdinResponse.text().then((text) => {
            proc.stdin.write(text);
            proc.stdin.end();
          });
        } else {
          proc.stdin.end();
        }

        proc.on('close', (code) => {
          resolve({
            exitCode: code ?? 1,
            stdout: Buffer.concat(stdoutChunks),
            stderr: Buffer.concat(stderrChunks),
          });
        });

        proc.on('error', () => {
          resolve({
            exitCode: 1,
            stdout: Buffer.concat(stdoutChunks),
            stderr: Buffer.concat(stderrChunks),
          });
        });
      });
    },
  };

  return command;
}
