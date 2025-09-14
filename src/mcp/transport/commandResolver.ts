/**
 * Command Resolver Module
 * Resolves commands to their full paths using the current shell environment
 * Handles aliases, functions, and PATH resolution
 */

import { spawn } from 'child_process';
import { logger } from '../../logger.js';

/**
 * Resolves a command to its full path using the current shell environment
 * Handles aliases, functions, and PATH resolution
 */
export async function resolveCommand(command: string): Promise<string> {
  // If command is already an absolute path, return as-is
  if (command.startsWith('/')) {
    return command;
  }

  return new Promise((resolve, _reject) => {
    // Use shell to resolve command - this handles aliases, functions, and PATH
    const shell = process.env.SHELL || '/bin/bash';
    const child = spawn(shell, ['-c', `command -v "${command}"`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (_data) => {});

    child.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        // If command -v fails, try which as fallback
        const whichChild = spawn('which', [command], {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: process.env,
        });

        let whichStdout = '';

        whichChild.stdout?.on('data', (data) => {
          whichStdout += data.toString();
        });

        whichChild.on('close', async (whichCode) => {
          if (whichCode === 0 && whichStdout.trim()) {
            resolve(whichStdout.trim());
          } else {
            // If both fail, return original command (let the system handle it)
            logger.warn(`Could not resolve command '${command}', using as-is`);
            resolve(command);
          }
        });

        whichChild.on('error', async () => {
          logger.warn(`Could not resolve command '${command}', using as-is`);
          resolve(command);
        });
      }
    });

    child.on('error', async (error) => {
      logger.warn(`Error resolving command '${command}': ${error.message}`);
      resolve(command);
    });
  });
}
