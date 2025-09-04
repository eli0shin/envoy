/**
 * Process Manager for MCP Server Child Process Cleanup
 * Singleton class that tracks and manages cleanup of MCP server child processes
 */

import { ChildProcess } from 'child_process';
import { logger } from '../logger.js';

export class ProcessManager {
  private static instance: ProcessManager;
  private processes: Map<string, ChildProcess> = new Map();
  private cleanupInProgress = false;

  private constructor() {}

  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  registerProcess(serverName: string, childProcess: ChildProcess): void {
    this.processes.set(serverName, childProcess);
    logger.debug(
      `Registered MCP server process: ${serverName} (PID: ${childProcess.pid})`
    );
  }

  cleanupProcess(serverName: string): void {
    const process = this.processes.get(serverName);
    if (process) {
      this.terminateProcess(serverName, process);
      this.processes.delete(serverName);
    }
  }

  cleanupAll(): void {
    if (this.cleanupInProgress) {
      return; // Prevent duplicate cleanup
    }
    this.cleanupInProgress = true;

    logger.info(`Cleaning up ${this.processes.size} MCP server processes`);

    // Phase 1: Send SIGTERM to all processes
    const processEntries = Array.from(this.processes.entries());
    for (const [serverName, childProcess] of processEntries) {
      this.sendSignal(serverName, childProcess, 'SIGTERM');
    }

    // Phase 2: Wait for graceful shutdown
    const gracefulTimeout = 3000; // 3 seconds
    const startTime = Date.now();

    const waitForGracefulShutdown = () => {
      const remainingProcesses = Array.from(this.processes.entries()).filter(
        ([_, process]) => !process.killed && process.exitCode === null
      );

      if (remainingProcesses.length === 0) {
        logger.info('All MCP server processes terminated gracefully');
        return;
      }

      if (Date.now() - startTime > gracefulTimeout) {
        // Phase 3: Force kill remaining processes
        for (const [serverName, childProcess] of remainingProcesses) {
          this.sendSignal(serverName, childProcess, 'SIGKILL');
        }
        logger.warn(
          `Force killed ${remainingProcesses.length} unresponsive MCP server processes`
        );
      }
    };

    // Since this is called from exit handlers, we need synchronous cleanup
    const pollInterval = setInterval(waitForGracefulShutdown, 100);

    // Total timeout protection
    setTimeout(() => {
      clearInterval(pollInterval);
      logger.warn('Process cleanup timed out');
    }, 10000); // 10 seconds max

    // Initial check
    waitForGracefulShutdown();
  }

  private terminateProcess(
    serverName: string,
    childProcess: ChildProcess
  ): void {
    this.sendSignal(serverName, childProcess, 'SIGTERM');

    // Wait briefly, then force kill if needed
    setTimeout(() => {
      if (!childProcess.killed && childProcess.exitCode === null) {
        this.sendSignal(serverName, childProcess, 'SIGKILL');
      }
    }, 3000);
  }

  private sendSignal(
    serverName: string,
    childProcess: ChildProcess,
    signal: NodeJS.Signals
  ): void {
    try {
      if (childProcess.pid && !childProcess.killed) {
        childProcess.kill(signal);
        logger.debug(
          `Sent ${signal} to MCP server ${serverName} (PID: ${childProcess.pid})`
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ESRCH')) {
          // Process already dead
          logger.debug(`MCP server ${serverName} already terminated`);
        } else if (error.message.includes('EPERM')) {
          // Permission denied
          logger.warn(
            `Permission denied when terminating MCP server ${serverName}`
          );
        } else {
          logger.error(
            `Error terminating MCP server ${serverName}: ${error.message}`
          );
        }
      }
    }
  }

  getActiveProcessCount(): number {
    return this.processes.size;
  }

  /**
   * Resets the ProcessManager state - used for testing
   * @internal
   */
  reset(): void {
    this.processes.clear();
    this.cleanupInProgress = false;
  }
}
