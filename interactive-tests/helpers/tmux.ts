import { execSync } from 'child_process';

export type TmuxSession = {
  id: string;
  name: string;
  paneId: string;
};

/**
 * Create a new tmux session and launch the CLI
 */
export async function createCliSession(
  sessionName: string = `envoy-test-${Date.now()}`
): Promise<TmuxSession> {
  // Create tmux session in the current working directory
  const cwd = process.cwd();
  const sessionId = execSync(
    `tmux new-session -d -P -F '#{session_id}' -s ${sessionName} -c '${cwd}'`,
    { encoding: 'utf-8' }
  ).trim();

  // Get window ID (escape the session ID to prevent shell variable expansion)
  const windowId = execSync(
    `tmux list-windows -t '${sessionId}' -F '#{window_id}'`,
    { encoding: 'utf-8' }
  ).trim();

  // Get pane ID
  const paneId = execSync(`tmux list-panes -t '${windowId}' -F '#{pane_id}'`, {
    encoding: 'utf-8',
  }).trim();

  return {
    id: sessionId,
    name: sessionName,
    paneId,
  };
}

/**
 * Launch the CLI in a tmux session
 */
export function launchCli(session: TmuxSession): void {
  execSync(`tmux send-keys -t '${session.paneId}' 'npx .' Enter`);
}

/**
 * Send text input to the CLI (without pressing Enter)
 */
export function sendInput(session: TmuxSession, text: string): void {
  // Send each character individually to avoid shell escaping issues
  for (const char of text) {
    const escaped = char.replace(/'/g, "'\\''");
    execSync(`tmux send-keys -t '${session.paneId}' '${escaped}'`);
  }
}

/**
 * Send Enter key to submit input
 */
export function submitInput(session: TmuxSession): void {
  execSync(`tmux send-keys -t '${session.paneId}' Enter`);
}

/**
 * Send Shift+Enter to create a newline without submitting
 */
export function sendNewline(session: TmuxSession): void {
  execSync(`tmux send-keys -t '${session.paneId}' S-Enter`);
}

/**
 * Send a control key sequence (e.g., 'C-c', 'C-u', 'escape')
 */
export function sendControlKey(
  session: TmuxSession,
  key: string,
  times: number = 1
): void {
  const keys = Array(times).fill(key).join(' ');
  execSync(`tmux send-keys -t '${session.paneId}' ${keys}`);
}

/**
 * Capture the current pane content
 */
export function capturePane(
  session: TmuxSession,
  lines: number = 50
): string {
  return execSync(
    `tmux capture-pane -t '${session.paneId}' -p -S -${lines}`,
    { encoding: 'utf-8' }
  );
}

/**
 * Wait for a specified amount of time (for CLI to process)
 */
export async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Kill the tmux session
 */
export function killSession(session: TmuxSession): void {
  execSync(`tmux kill-session -t '${session.id}'`);
}

/**
 * Check if a tmux session exists
 */
export function sessionExists(session: TmuxSession): boolean {
  const result = execSync(
    `tmux list-sessions -F '#{session_id}' 2>/dev/null || true`,
    { encoding: 'utf-8' }
  );
  return result.includes(session.id);
}

/**
 * Exit the CLI gracefully with double Ctrl+C
 */
export async function exitCli(session: TmuxSession): Promise<void> {
  sendControlKey(session, 'C-c', 1);
  await new Promise((resolve) => setTimeout(resolve, 100));
  sendControlKey(session, 'C-c', 1);
  await new Promise((resolve) => setTimeout(resolve, 500));
}
