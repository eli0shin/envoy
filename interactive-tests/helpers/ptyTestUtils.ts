import * as pty from 'node-pty';
import { resolve } from 'path';
import stripAnsi from 'strip-ansi';

export type PTYTestEnvironment = {
  spawn: (command: string, args: string[]) => Promise<PTYProcess>;
  cleanup: () => Promise<void>;
};

export type PTYProcess = {
  write: (text: string) => void;
  typeText: (
    text: string,
    charDelay?: number,
    terminalDelay?: number
  ) => Promise<void>;
  sendEnter: () => void;
  sendAltEnter: () => Promise<void>;
  sendArrowUp: () => void;
  sendArrowDown: () => void;
  sendBackspace: () => void;
  waitForText: (text: string, timeout?: number) => Promise<void>;
  getOutput: () => string;
  getCleanOutput: () => string;
  kill: () => void;
  onExit: () => Promise<number>;
  platform: string;
};

export async function createPTYTestEnvironment(): Promise<PTYTestEnvironment> {
  const processes: pty.IPty[] = [];

  return {
    spawn: async (command: string, args: string[]) => {
      const ptyProcess = pty.spawn(command, args, {
        name: 'xterm-color',
        cols: 80,
        rows: 100,
        cwd: process.cwd(),
        env: {
          ...process.env,
          ENABLE_INTERACTIVE_E2E_TESTING: 'true',
          FORCE_COLOR: '0', // Disable colors for easier testing
        },
      });

      processes.push(ptyProcess);

      let output = '';
      let cleanOutput = '';

      ptyProcess.onData(data => {
        output += data;
        cleanOutput = stripAnsi(output);
      });

      return {
        write: (text: string) => {
          ptyProcess.write(text);
        },

        typeText: async (text: string, charDelay = 10, terminalDelay = 100) => {
          for (const char of text) {
            ptyProcess.write(char);
            await new Promise(resolve => setTimeout(resolve, charDelay));
          }

          await new Promise(resolve => setTimeout(resolve, terminalDelay));
        },

        sendEnter: () => {
          ptyProcess.write('\r');
        },

        sendAltEnter: async () => {
          ptyProcess.write('\u000d'); // Ctrl+M (Ctrl+Return)
          await new Promise(resolve => setTimeout(resolve, 100));
        },

        sendArrowUp: () => {
          ptyProcess.write('\u001b[A');
        },

        sendArrowDown: () => {
          ptyProcess.write('\u001b[B');
        },

        sendBackspace: () => {
          ptyProcess.write('\u007f');
        },

        waitForText: (text: string, timeout = 10000) => {
          return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkOutput = () => {
              if (cleanOutput.includes(text)) {
                resolve();
                return;
              }

              if (Date.now() - startTime > timeout) {
                reject(
                  new Error(
                    `Timeout waiting for text: "${text}". Got: "${cleanOutput}"`
                  )
                );
                return;
              }

              setTimeout(checkOutput, 100);
            };

            checkOutput();
          });
        },

        getOutput: () => output,
        getCleanOutput: () => cleanOutput,

        kill: () => {
          ptyProcess.kill();
        },

        onExit: () => {
          return new Promise(resolve => {
            ptyProcess.onExit(({ exitCode }) => {
              resolve(exitCode);
            });
          });
        },

        platform: process.platform,
      };
    },

    cleanup: async () => {
      processes.forEach(proc => {
        try {
          proc.kill();
        } catch (_e) {
          void _e;
        }
      });
      processes.length = 0;
    },
  };
}

export const CLI_PATHS = {
  built: resolve(process.cwd(), 'dist/cli/index.js'),
  source: resolve(process.cwd(), 'src/cli/index.ts'),
} as const;

export const TEST_TIMEOUTS = {
  startup: 5000,
  interaction: 3000,
  response: 35000, // Increased to handle agent processing time (up to 30s)
  shutdown: 2000,
} as const;
