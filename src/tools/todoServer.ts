#!/usr/bin/env node

/**
 * Todo List MCP Server
 * Provides MCP tools for managing todo lists during agent sessions
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
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
 * Clears all todo storage (for testing purposes)
 */
export function clearTodoStorage(): void {
  todoStorage.clear();
}

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
 */
function formatTodosAsMarkdown(todos: TodoItem[]): string {
  if (todos.length === 0) {
    return '## Todo List\n\n*No todos*';
  }

  const lines = ['## Todo List', ''];

  todos.forEach((todo, index) => {
    const statusIcon =
      todo.status === 'completed'
        ? '[✓]'
        : todo.status === 'in_progress'
          ? '[▶]'
          : '[ ]';

    lines.push(`${index + 1}. ${statusIcon} ${todo.content} (ID: ${todo.id})`);
  });

  return lines.join('\n');
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
function cleanupOldSessions(): void {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  Array.from(todoStorage.entries()).forEach(([sessionId, todoList]) => {
    if (todoList.lastModified < cutoff) {
      todoStorage.delete(sessionId);
    }
  });
}

/**
 * Creates and configures the MCP server
 */
function createTodoServer(): McpServer {
  const server = new McpServer(
    {
      name: 'todo-list',
      version: '1.0.0',
    },
    {
      instructions:
        'Use the todo list tools to track and manage multi-step tasks. Add todos for work items, update their status as you progress, and maintain an organized workflow. All operations return the complete todo list for your reference.',
    }
  );

  // Add todo item
  server.tool(
    'todo_add',
    {
      content: z.string().min(1, 'Todo content cannot be empty'),
    },
    async ({ content }) => {
      const sessionId = getSessionId();
      const todoList = getTodoList(sessionId);

      const newTodo: TodoItem = {
        id: uuidv4(),
        content,
        status: 'pending',
        order: todoList.items.length,
      };

      todoList.items.push(newTodo);
      touchTodoList(sessionId);

      await logTodoOperation(sessionId, 'add', {
        todoId: newTodo.id,
        content,
      });

      const markdown = formatTodosAsMarkdown(todoList.items);

      return {
        content: [
          {
            type: 'text',
            text: `Added todo: "${content}"\n\n${markdown}`,
          },
        ],
      };
    }
  );

  // List todos
  server.tool('todo_list', {}, async () => {
    const sessionId = getSessionId();
    const todoList = getTodoList(sessionId);
    const markdown = formatTodosAsMarkdown(todoList.items);

    return {
      content: [
        {
          type: 'text',
          text: markdown,
        },
      ],
    };
  });

  // Update todo status
  server.tool(
    'todo_update',
    {
      id: z.string().min(1, 'Todo ID cannot be empty'),
      status: z.enum(['pending', 'in_progress', 'completed']),
    },
    async ({ id, status }) => {
      const sessionId = getSessionId();
      const todoList = getTodoList(sessionId);

      const todo = todoList.items.find(item => item.id === id);
      if (!todo) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Todo with ID "${id}" not found\n\n${formatTodosAsMarkdown(todoList.items)}`,
            },
          ],
          isError: true,
        };
      }

      const oldStatus = todo.status;
      todo.status = status;
      touchTodoList(sessionId);

      await logTodoOperation(sessionId, 'update', {
        todoId: id,
        oldStatus,
        newStatus: status,
      });

      const markdown = formatTodosAsMarkdown(todoList.items);

      return {
        content: [
          {
            type: 'text',
            text: `Updated todo status: "${todo.content}" → ${status}\n\n${markdown}`,
          },
        ],
      };
    }
  );

  // Remove todo
  server.tool(
    'todo_remove',
    {
      id: z.string().min(1, 'Todo ID cannot be empty'),
    },
    async ({ id }) => {
      const sessionId = getSessionId();
      const todoList = getTodoList(sessionId);

      const todoIndex = todoList.items.findIndex(item => item.id === id);
      if (todoIndex === -1) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Todo with ID "${id}" not found\n\n${formatTodosAsMarkdown(todoList.items)}`,
            },
          ],
          isError: true,
        };
      }

      const removedTodo = todoList.items.splice(todoIndex, 1)[0];

      // Reorder remaining items
      todoList.items.forEach((item, index) => {
        item.order = index;
      });

      touchTodoList(sessionId);

      await logTodoOperation(sessionId, 'remove', {
        todoId: id,
        content: removedTodo.content,
      });

      const markdown = formatTodosAsMarkdown(todoList.items);

      return {
        content: [
          {
            type: 'text',
            text: `Removed todo: "${removedTodo.content}"\n\n${markdown}`,
          },
        ],
      };
    }
  );

  // Clear all todos
  server.tool('todo_clear', {}, async () => {
    const sessionId = getSessionId();
    const todoList = getTodoList(sessionId);

    const clearedCount = todoList.items.length;
    todoList.items = [];
    touchTodoList(sessionId);

    await logTodoOperation(sessionId, 'clear', {
      clearedCount,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Cleared ${clearedCount} todos\n\n## Todo List\n\n*No todos*`,
        },
      ],
    };
  });

  // Reorder todo
  server.tool(
    'todo_reorder',
    {
      id: z.string().min(1, 'Todo ID cannot be empty'),
      newPosition: z.number().int().min(0, 'Position must be non-negative'),
    },
    async ({ id, newPosition }) => {
      const sessionId = getSessionId();
      const todoList = getTodoList(sessionId);

      const todoIndex = todoList.items.findIndex(item => item.id === id);
      if (todoIndex === -1) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Todo with ID "${id}" not found\n\n${formatTodosAsMarkdown(todoList.items)}`,
            },
          ],
          isError: true,
        };
      }

      // Clamp newPosition to valid range
      const maxPosition = todoList.items.length - 1;
      const clampedPosition = Math.min(Math.max(0, newPosition), maxPosition);

      // Move the todo to new position
      const [movedTodo] = todoList.items.splice(todoIndex, 1);
      todoList.items.splice(clampedPosition, 0, movedTodo);

      // Update order for all items
      todoList.items.forEach((item, index) => {
        item.order = index;
      });

      touchTodoList(sessionId);

      await logTodoOperation(sessionId, 'reorder', {
        todoId: id,
        oldPosition: todoIndex,
        newPosition: clampedPosition,
      });

      const markdown = formatTodosAsMarkdown(todoList.items);

      return {
        content: [
          {
            type: 'text',
            text: `Reordered todo: "${movedTodo.content}" to position ${clampedPosition + 1}\n\n${markdown}`,
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Start the todo server if this file is run directly
 */
if (process.argv[1] && process.argv[1].endsWith('todoServer.ts')) {
  const server = createTodoServer();
  const transport = new StdioServerTransport();

  // Setup cleanup interval
  const cleanupInterval = setInterval(cleanupOldSessions, 60 * 60 * 1000); // Every hour

  // Cleanup on exit
  process.on('SIGINT', () => {
    clearInterval(cleanupInterval);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
    process.exit(0);
  });

  server.connect(transport).catch(error => process.stderr.write(`Todo server connection error: ${error}\\n`));
}

export { createTodoServer };
