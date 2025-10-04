/**
 * Unit tests for built-in todo tools
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTodoTools, clearTodoStorage } from './todo.js';
import type { WrappedTool } from '../types/index.js';

describe('todo tools', () => {
  let tools: Map<string, WrappedTool>;

  beforeEach(() => {
    // Clear storage and create fresh tools
    clearTodoStorage();
    tools = createTodoTools();

    // Set test session ID
    process.env.AGENT_SESSION_ID = 'test-session-123';
  });

  describe('todo_write', () => {
    it('should write a new todo list', async () => {
      const todoWrite = tools.todo_write;
      const result = await todoWrite.execute({ 
        todos: '- [ ] First task\n- [ ] Second task' 
      });

      expect(result).toBe('- [ ] First task\n- [ ] Second task');
    });

    it('should write todos with different statuses', async () => {
      const todoWrite = tools['todo_write'];
      const result = await todoWrite.execute({ 
        todos: '- [ ] Pending task\n- [~] In progress task\n- [x] Completed task' 
      });

      expect(result).toBe('- [ ] Pending task\n- [~] In progress task\n- [x] Completed task');
    });

    it('should replace existing todos', async () => {
      const todoWrite = tools['todo_write'];
      
      await todoWrite.execute({ 
        todos: '- [ ] First task' 
      });
      
      const result = await todoWrite.execute({ 
        todos: '- [ ] New task\n- [x] Another task' 
      });

      expect(result).toBe('- [ ] New task\n- [x] Another task');
    });
  });

  describe('todo_list', () => {
    it('should return empty string initially', async () => {
      const todoList = tools['todo_list'];
      const result = await todoList.execute({});

      expect(result).toBe('');
    });

    it('should return todos after writing them', async () => {
      const todoWrite = tools['todo_write'];
      const todoList = tools['todo_list'];

      await todoWrite.execute({ 
        todos: '- [ ] First task\n- [~] Second task' 
      });
      
      const result = await todoList.execute({});

      expect(result).toBe('- [ ] First task\n- [~] Second task');
    });
  });

  describe('tool structure', () => {
    it('should have all expected tools', () => {
      expect('todo_write' in tools).toBe(true);
      expect('todo_list' in tools).toBe(true);
    });

    it('should not have old tools', () => {
      expect('todo_add' in tools).toBe(false);
      expect('todo_update' in tools).toBe(false);
    });

    it('should have proper structure for each tool', () => {
      for (const [toolName, tool] of Object.entries(tools)) {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');
      }
    });
  });
});
