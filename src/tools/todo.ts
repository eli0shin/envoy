/**
 * Built-in Todo List Tools
 * Provides todo management functionality as built-in AI SDK tools
 */

import { tool } from 'ai';
import { z } from 'zod/v3';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { join } from 'path';
import envPaths from 'env-paths';

/**
 * Todo item structure
 */
type TodoItem = {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  order: number;
};

/**
 * Todo list structure
 */
type TodoList = {
  sessionId: string;
  items: TodoItem[];
  lastModified: Date;
};

/**
 * In-memory storage for todo lists by session
 */
const todoStorage = new Map<string, TodoList>();

/**
 * Application paths for logging
 */
const paths = envPaths('envoy');

/**
 * Gets or creates a todo list for the current session
 */
function getTodoList(sessionId: string): TodoList {
  if (!todoStorage.has(sessionId)) {
    todoStorage.set(sessionId, {
      sessionId,
      items: [],
      lastModified: new Date(),
    });
  }
  return todoStorage.get(sessionId)!;
}

/**
 * Updates the last modified timestamp for a todo list
 */
function touchTodoList(sessionId: string): void {
  const todoList = todoStorage.get(sessionId);
  if (todoList) {
    todoList.lastModified = new Date();
  }
}

/**
 * Formats todo list as markdown for human-readable output
 * Returns markdown list without numbers (uses bullets instead)
 */
function formatTodosAsMarkdown(todos: TodoItem[]): string {
  if (todos.length === 0) {
    return '';
  }

  const lines: string[] = [];

  todos.forEach((todo) => {
    const statusIcon =
      todo.status === 'completed' ? 'x'
      : todo.status === 'in_progress' ? '~'
      : ' ';

    lines.push(`- [${statusIcon}] ${todo.content}`);
  });

  return lines.join('\n');
}

/**
 * Parses markdown todo list into TodoItem array
 */
function parseMarkdownTodos(markdown: string): TodoItem[] {
  const lines = markdown.trim().split('\n');
  const items: TodoItem[] = [];

  lines.forEach((line, index) => {
    const match = line.match(/^-\s*\[([x~\s])\]\s*(.+)$/);
    if (match) {
      const statusChar = match[1];
      const content = match[2].trim();

      const status =
        statusChar === 'x' ? 'completed'
        : statusChar === '~' ? 'in_progress'
        : 'pending';

      items.push({
        id: uuidv4(),
        content,
        status,
        order: index,
      });
    }
  });

  return items;
}

/**
 * Logs todo operation to timestamp file
 */
async function logTodoOperation(
  sessionId: string,
  operation: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const logDir = join(paths.data, 'todos');
    await fs.mkdir(logDir, { recursive: true });

    const logFile = join(logDir, `${sessionId}.jsonl`);
    const logEntry =
      JSON.stringify({
        timestamp: new Date().toISOString(),
        operation,
        ...data,
      }) + '\n';

    await fs.appendFile(logFile, logEntry, 'utf8');
  } catch {
    // Silently fail if logging doesn't work
  }
}

/**
 * Gets current session ID from environment
 */
function getSessionId(): string {
  return process.env.AGENT_SESSION_ID || 'default';
}

/**
 * Cleanup old sessions (older than 24 hours)
 */
export function cleanupOldSessions(): void {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  Array.from(todoStorage.entries()).forEach(([sessionId, todoList]) => {
    if (todoList.lastModified < cutoff) {
      todoStorage.delete(sessionId);
    }
  });
}

/**
 * Clears all todo storage (for testing purposes)
 */
export function clearTodoStorage(): void {
  todoStorage.clear();
}

/**
 * Gets todo list for testing purposes
 */
export function getTodoListForTesting(sessionId: string): TodoList | undefined {
  return todoStorage.get(sessionId);
}

/**
 * Creates all todo tools using AI SDK's tool() helper
 */
export function createTodoTools() {
  return {
    todo_write: tool({
      description:
        'Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.\n\nIMPORTANT: Use proactively when tasks require 3+ steps, when user provides multiple tasks, or after investigation reveals complexity. Update in real-time - mark tasks completed IMMEDIATELY after finishing (do not batch updates). Exactly ONE task should be in_progress at a time.',
      inputSchema: z.object({
        todos: z
          .string()
          .describe(
            'The complete todo list in markdown format. Use the following syntax for statuses: - [ ] for pending tasks, - [~] for in-progress tasks, - [x] for completed tasks. Example: "- [ ] Task 1\n- [~] Task 2\n- [x] Task 3"'
          ),
      }),
      execute: async ({ todos }) => {
        const sessionId = getSessionId();
        const todoList = getTodoList(sessionId);

        // Parse markdown into todo items
        todoList.items = parseMarkdownTodos(todos);
        touchTodoList(sessionId);

        await logTodoOperation(sessionId, 'write', {
          itemCount: todoList.items.length,
        });

        return formatTodosAsMarkdown(todoList.items);
      },
    }),
    todo_list: tool({
      description:
        'List all items in your todo list to review current status: pending (not started), in-progress (actively working on), and completed tasks. Use frequently during multi-step operations to verify what remains and ensure nothing is forgotten.',
      inputSchema: z.object({}),
      execute: async () => {
        const sessionId = getSessionId();
        const todoList = getTodoList(sessionId);
        return formatTodosAsMarkdown(todoList.items);
      },
    }),
  };
}
