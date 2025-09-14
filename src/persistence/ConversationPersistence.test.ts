/**
 * Tests for ConversationPersistence service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { ConversationPersistence } from './ConversationPersistence.js';
import type { CoreMessage } from 'ai';

import { ensureDirectory } from '../shared/fileOperations.js';

vi.mock('../shared/fileOperations.js', () => ({
  ensureDirectory: vi.fn(),
}));

vi.mock('env-paths', () => ({
  default: vi.fn(() => ({
    data: '/mock/app/data',
  })),
}));

// Use same structure as createMockLogger() but with test-specific overrides (avoids hoisting issues)
vi.mock('../logger.js', () => ({
  // Main logger object - same structure as createMockLogger()
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logAssistantStep: vi.fn(),
    logToolCallProgress: vi.fn(),
    logMcpTool: vi.fn(),
    setLogLevel: vi.fn(),
    setLogProgress: vi.fn(),
    setSuppressConsoleOutput: vi.fn(),
    getSessionId: vi.fn(() => '01932d4c-89ab-7890-abcd-123456789012'),
    getLogDirectory: vi.fn(() => '/test/logs'),
    getCurrentLogProgress: vi.fn(() => 'none'),
  },
  // Individual function exports - same structure as createMockLogger() but with overrides
  getSessionId: vi.fn(() => '01932d4c-89ab-7890-abcd-123456789012'),
  getLogDirectory: vi.fn(() => '/test/logs'),
  getConversationDirectory: vi.fn(() => '/mock/app/data/sessions'),
  getProjectConversationDirectory: vi.fn(
    (projectIdentifier: string) =>
      `/mock/app/data/conversations/${projectIdentifier}`
  ),
  getProjectConversationFile: vi.fn(
    (projectIdentifier: string, sessionId: string) =>
      `/mock/app/data/conversations/${projectIdentifier}/${sessionId}.jsonl`
  ),
  logMcpTool: vi.fn(),
  setLogLevel: vi.fn(),
  setLogProgress: vi.fn(),
  createSessionId: vi.fn(() => '01932d4c-89ab-7890-abcd-123456789012'),
}));

describe('ConversationPersistence', () => {
  let conversationPersistence: ConversationPersistence;
  let mockFs: typeof fs;
  let testSessionId: string;
  let testProjectIdentifier: string;

  beforeEach(() => {
    mockFs = fs as typeof fs;
    testSessionId = '01932d4c-89ab-7890-abcd-123456789012';
    testProjectIdentifier = 'Users_dev_test-project';

    // Mock is set up above using createMockLogger with test-specific overrides

    conversationPersistence = new ConversationPersistence(
      testSessionId,
      testProjectIdentifier
    );

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with session ID and project identifier', () => {
      expect(conversationPersistence).toBeDefined();
    });

    it('should provide access to session ID via getSessionId()', () => {
      expect(conversationPersistence.getSessionId()).toBe(testSessionId);
    });

    it('should handle empty session ID', () => {
      expect(
        () => new ConversationPersistence('', testProjectIdentifier)
      ).not.toThrow();
    });

    it('should handle empty project identifier', () => {
      expect(
        () => new ConversationPersistence(testSessionId, '')
      ).not.toThrow();
    });
  });

  describe('persistMessages', () => {
    beforeEach(() => {
      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);
      vi.mocked(mockFs.appendFile).mockResolvedValue(undefined);
    });

    it('should persist complete user messages', async () => {
      const messages: CoreMessage[] = [
        {
          role: 'user',
          content: 'Hello, help me implement a feature',
        },
      ];

      await conversationPersistence.persistMessages(messages);

      expect(ensureDirectory).toHaveBeenCalledWith(
        '/mock/app/data/conversations/Users_dev_test-project'
      );
      expect(mockFs.appendFile).toHaveBeenCalledWith(
        '/mock/app/data/conversations/Users_dev_test-project/01932d4c-89ab-7890-abcd-123456789012.jsonl',
        expect.stringContaining('"role":"user"'),
        'utf8'
      );
    });

    it('should persist complete assistant messages', async () => {
      const messages: CoreMessage[] = [
        {
          role: 'assistant',
          content: 'I can help you implement that feature.',
        },
      ];

      await conversationPersistence.persistMessages(messages);

      expect(mockFs.appendFile).toHaveBeenCalledWith(
        '/mock/app/data/conversations/Users_dev_test-project/01932d4c-89ab-7890-abcd-123456789012.jsonl',
        expect.stringContaining('"role":"assistant"'),
        'utf8'
      );
    });

    it('should filter out incomplete tool messages', async () => {
      const messages: CoreMessage[] = [
        {
          role: 'tool',
          content: [], // Empty content array - incomplete tool message
          // Missing all tool call properties
        },
      ];

      await conversationPersistence.persistMessages(messages);

      expect(mockFs.appendFile).not.toHaveBeenCalled();
    });

    it('should handle empty message array', async () => {
      await conversationPersistence.persistMessages([]);

      expect(mockFs.appendFile).not.toHaveBeenCalled();
    });

    it('should handle file system errors gracefully', async () => {
      const error = new Error('ENOSPC: no space left on device');
      vi.mocked(ensureDirectory).mockRejectedValue(error);

      const messages: CoreMessage[] = [
        {
          role: 'user',
          content: 'Test message',
        },
      ];

      // The method should complete successfully without throwing, even when file system errors occur
      await expect(
        conversationPersistence.persistMessages(messages)
      ).resolves.toBeUndefined();

      // Verify that ensureDirectory was called (and failed)
      expect(ensureDirectory).toHaveBeenCalled();
      // Verify that appendFile was not called due to the error
      expect(mockFs.appendFile).not.toHaveBeenCalled();
    });

    it('should create correct JSONL format', async () => {
      const messages: CoreMessage[] = [
        {
          role: 'user',
          content: 'Test message',
        },
      ];

      await conversationPersistence.persistMessages(messages);

      const appendCall = vi.mocked(mockFs.appendFile).mock.calls[0];
      const jsonlContent = appendCall[1] as string;
      const parsedLine = JSON.parse(jsonlContent.trim());

      expect(parsedLine).toEqual({
        timestamp: expect.any(String),
        messageIndex: expect.any(Number),
        messageType: 'conversation',
        sessionId: testSessionId,
        message: {
          role: 'user',
          content: 'Test message',
        },
      });
    });

    it('should increment message index for incremental message arrays', async () => {
      const firstMessages: CoreMessage[] = [
        { role: 'user', content: 'First message' },
      ];
      const secondMessages: CoreMessage[] = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Second message' },
      ];

      await conversationPersistence.persistMessages(firstMessages);
      await conversationPersistence.persistMessages(secondMessages);

      expect(mockFs.appendFile).toHaveBeenCalledTimes(2);

      const firstCall = vi.mocked(mockFs.appendFile).mock.calls[0];
      const secondCall = vi.mocked(mockFs.appendFile).mock.calls[1];

      const firstLine = JSON.parse((firstCall[1] as string).trim());
      const secondLine = JSON.parse((secondCall[1] as string).trim());

      expect(firstLine.messageIndex).toBe(0);
      expect(secondLine.messageIndex).toBe(1);
      expect(firstLine.message.content).toBe('First message');
      expect(secondLine.message.content).toBe('Second message');
    });

    it('should avoid duplicate persistence when called with overlapping message arrays', async () => {
      const userMessage: CoreMessage = {
        role: 'user',
        content: 'User message',
      };
      const assistantMessage: CoreMessage = {
        role: 'assistant',
        content: 'Assistant response',
      };
      const newUserMessage: CoreMessage = {
        role: 'user',
        content: 'Second user message',
      };

      // First call with initial messages
      await conversationPersistence.persistMessages([
        userMessage,
        assistantMessage,
      ]);

      // Second call with overlapping messages plus new message (simulating how the agent adds messages)
      await conversationPersistence.persistMessages([
        userMessage,
        assistantMessage,
        newUserMessage,
      ]);

      expect(mockFs.appendFile).toHaveBeenCalledTimes(2);

      const firstCall = vi.mocked(mockFs.appendFile).mock.calls[0];
      const secondCall = vi.mocked(mockFs.appendFile).mock.calls[1];

      const firstCallLines = (firstCall[1] as string).trim().split('\n');
      const secondCallLines = (secondCall[1] as string).trim().split('\n');

      // First call should persist 2 messages
      expect(firstCallLines).toHaveLength(2);

      // Second call should only persist the 1 new message, not duplicate the existing ones
      expect(secondCallLines).toHaveLength(1);

      const secondCallParsed = JSON.parse(secondCallLines[0]);
      expect(secondCallParsed.message.content).toBe('Second user message');
      expect(secondCallParsed.messageIndex).toBe(2); // Should be index 2 (after the first 2 messages)
    });
  });

  describe('loadConversation', () => {
    it('should load existing conversation', async () => {
      const mockFileContent = [
        '{"timestamp":"2025-01-15T10:30:15.123Z","messageIndex":0,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"user","content":"Hello"}}',
        '{"timestamp":"2025-01-15T10:30:45.789Z","messageIndex":1,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"assistant","content":"Hi there!"}}',
      ].join('\n');

      vi.mocked(mockFs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const messages = await conversationPersistence.loadConversation();

      expect(messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);
    });

    it('should handle missing conversation file', async () => {
      const error = new Error(
        'ENOENT: no such file or directory'
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(mockFs.access).mockRejectedValue(error);

      const messages = await conversationPersistence.loadConversation();

      expect(messages).toEqual([]);
    });

    it('should handle malformed JSONL', async () => {
      const mockFileContent = [
        '{"timestamp":"2025-01-15T10:30:15.123Z","messageIndex":0,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"user","content":"Hello"}}',
        'invalid json line',
        '{"timestamp":"2025-01-15T10:30:45.789Z","messageIndex":1,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"assistant","content":"Hi"}}',
      ].join('\n');

      vi.mocked(mockFs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const messages = await conversationPersistence.loadConversation();

      expect(messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ]);
    });

    it('should filter out session metadata entries', async () => {
      const mockFileContent = [
        '{"timestamp":"2025-01-15T10:30:00.123Z","messageIndex":0,"messageType":"session-meta","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"type":"session-start"}}',
        '{"timestamp":"2025-01-15T10:30:15.123Z","messageIndex":1,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"user","content":"Hello"}}',
      ].join('\n');

      vi.mocked(mockFs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const messages = await conversationPersistence.loadConversation();

      expect(messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should load conversation with specific session ID', async () => {
      const specificSessionId = '01932d5a-1234-7890-abcd-987654321xyz';
      const mockFileContent =
        '{"timestamp":"2025-01-15T10:30:15.123Z","messageIndex":0,"messageType":"conversation","sessionId":"01932d5a-1234-7890-abcd-987654321xyz","message":{"role":"user","content":"Specific session"}}';

      vi.mocked(mockFs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const messages =
        await conversationPersistence.loadConversation(specificSessionId);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        '/mock/app/data/conversations/Users_dev_test-project/01932d5a-1234-7890-abcd-987654321xyz.jsonl',
        'utf8'
      );
      expect(messages).toEqual([{ role: 'user', content: 'Specific session' }]);
    });
  });

  describe('getLatestConversation', () => {
    it('should return latest session ID based on filename sorting', async () => {
      const mockFiles = [
        '01932d4a-0123-7890-abcd-123456789abc.jsonl',
        '01932d4c-89ab-7890-abcd-123456789012.jsonl', // Latest (lexicographically)
        '01932d4b-4567-7890-abcd-123456789def.jsonl',
      ];

      vi.mocked(mockFs.readdir).mockResolvedValue(mockFiles as never);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const latestSessionId =
        await conversationPersistence.getLatestConversation();

      expect(latestSessionId).toBe('01932d4c-89ab-7890-abcd-123456789012');
    });

    it('should handle empty conversation directory', async () => {
      vi.mocked(mockFs.readdir).mockResolvedValue([] as never);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const latestSessionId =
        await conversationPersistence.getLatestConversation();

      expect(latestSessionId).toBeNull();
    });

    it('should handle missing conversation directory', async () => {
      const error = new Error(
        'ENOENT: no such file or directory'
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(mockFs.access).mockRejectedValue(error);

      const latestSessionId =
        await conversationPersistence.getLatestConversation();

      expect(latestSessionId).toBeNull();
    });

    it('should filter out non-JSONL files', async () => {
      const mockFiles = [
        '01932d4a-0123-7890-abcd-123456789abc.jsonl',
        'README.md',
        '.DS_Store',
        '01932d4b-4567-7890-abcd-123456789def.jsonl',
      ];

      vi.mocked(mockFs.readdir).mockResolvedValue(mockFiles as never);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const latestSessionId =
        await conversationPersistence.getLatestConversation();

      expect(latestSessionId).toBe('01932d4b-4567-7890-abcd-123456789def');
    });

    it('should filter out invalid UUID formats', async () => {
      const mockFiles = [
        '01932d4a-0123-7890-abcd-123456789abc.jsonl', // valid
        'invalid-session-id.jsonl', // invalid format
        'short.jsonl', // too short
        '01932d4b-4567-7890-abcd-123456789def.jsonl', // valid (latest)
        'not-uuid-format.jsonl', // invalid format
      ];

      vi.mocked(mockFs.readdir).mockResolvedValue(mockFiles as never);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const latestSessionId =
        await conversationPersistence.getLatestConversation();

      expect(latestSessionId).toBe('01932d4b-4567-7890-abcd-123456789def');
    });

    it('should return null when all files have invalid UUID formats', async () => {
      const mockFiles = [
        'invalid-session-id.jsonl',
        'short.jsonl',
        'not-uuid-format.jsonl',
      ];

      vi.mocked(mockFs.readdir).mockResolvedValue(mockFiles as never);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const latestSessionId =
        await conversationPersistence.getLatestConversation();

      expect(latestSessionId).toBeNull();
    });
  });

  describe('getProjectIdentifier', () => {
    it('should convert project path to safe identifier', () => {
      const testCases = [
        {
          input: '/Users/dev/my-project',
          expected: 'Users_dev_my-project',
        },
        {
          input: '/home/user/workspace/app',
          expected: 'home_user_workspace_app',
        },
        {
          input: 'C:\\Users\\Dev\\Project',
          expected: 'C:_Users_Dev_Project',
        },
        {
          input: '/simple',
          expected: 'simple',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const identifier = ConversationPersistence.getProjectIdentifier(input);
        expect(identifier).toBe(expected);
      });
    });

    it('should throw error for invalid project paths', () => {
      const invalidInputs: Array<string | null | undefined> = [
        '',
        null,
        undefined,
      ];

      invalidInputs.forEach((input) => {
        expect(() => {
          ConversationPersistence.getProjectIdentifier(input as string);
        }).toThrow('Project path must be a non-empty string');
      });
    });
  });

  describe('isValidSessionId', () => {
    it('should validate correct UUID v7 format', () => {
      const validUUIDs = [
        '01932d4c-89ab-7890-abcd-123456789abc',
        '019330e2-1234-7890-abcd-123456789def',
        'abcdef12-3456-7890-abcd-123456789012',
        '12345678-90ab-cdef-1234-567890abcdef',
      ];

      validUUIDs.forEach((uuid) => {
        expect(ConversationPersistence.isValidSessionId(uuid)).toBe(true);
      });
    });

    it('should reject invalid session ID formats', () => {
      const invalidInputs: Array<string | null | undefined | number> = [
        '',
        'invalid',
        '123',
        'invalid-session-id',
        '12345678-90ab-cdef-1234-567890abcdefg', // too long
        '12345678-90ab-cdef-1234-567890abcde', // too short
        '12345678-90ab-cdef-1234', // missing segment
        '12345678_90ab_cdef_1234_567890abcdef', // wrong separator
        null,
        undefined,
        123,
      ];

      invalidInputs.forEach((input) => {
        expect(ConversationPersistence.isValidSessionId(input as string)).toBe(
          false
        );
      });
    });
  });

  describe('isMessageComplete', () => {
    it('should return true for user messages', () => {
      const message: CoreMessage = {
        role: 'user',
        content: 'Any user message is complete',
      };

      expect(ConversationPersistence.isMessageComplete(message)).toBe(true);
    });

    it('should return true for assistant messages without thinking', () => {
      const message: CoreMessage = {
        role: 'assistant',
        content: 'Regular assistant response',
      };

      expect(ConversationPersistence.isMessageComplete(message)).toBe(true);
    });

    it('should return false for unknown message roles', () => {
      const message = {
        role: 'unknown',
        content: 'Unknown message type',
      } as unknown as CoreMessage;

      expect(ConversationPersistence.isMessageComplete(message)).toBe(false);
    });
  });

  describe('getConversationPreview', () => {
    it('should extract first user message and last assistant message with truncation', async () => {
      const mockFileContent = [
        '{"timestamp":"2025-01-15T10:30:00.000Z","messageIndex":0,"messageType":"session-meta","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"type":"session-start"}}',
        '{"timestamp":"2025-01-15T10:30:15.123Z","messageIndex":1,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"user","content":"This is a very long user message that should be truncated to exactly 100 characters when displayed in the conversation preview functionality"}}',
        '{"timestamp":"2025-01-15T10:30:45.789Z","messageIndex":2,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"assistant","content":"I understand your request."}}',
        '{"timestamp":"2025-01-15T10:31:15.234Z","messageIndex":3,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"assistant","content":"This is an even longer assistant response that contains a lot of detailed information and explanations that should definitely be truncated to 100 characters in the preview"}}',
      ].join('\n');

      vi.mocked(mockFs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const preview = await conversationPersistence.getConversationPreview();

      expect(preview.firstMessage).toBe(
        'This is a very long user message that should be truncated to exactly 100 characters when displayed i...'
      );
      expect(preview.lastAssistantMessage).toBe(
        'This is an even longer assistant response that contains a lot of detailed information and explanatio...'
      );
      expect(preview.actualMessageCount).toBe(3); // 3 conversation messages, 1 session-meta excluded
    });

    it('should handle conversations with no user messages', async () => {
      const mockFileContent = [
        '{"timestamp":"2025-01-15T10:30:00.000Z","messageIndex":0,"messageType":"session-meta","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"type":"session-start"}}',
        '{"timestamp":"2025-01-15T10:30:45.789Z","messageIndex":1,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"assistant","content":"Assistant message only"}}',
      ].join('\n');

      vi.mocked(mockFs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const preview = await conversationPersistence.getConversationPreview();

      expect(preview.firstMessage).toBeUndefined();
      expect(preview.lastAssistantMessage).toBe('Assistant message only');
      expect(preview.actualMessageCount).toBe(1);
    });

    it('should handle conversations with no assistant messages', async () => {
      const mockFileContent = [
        '{"timestamp":"2025-01-15T10:30:15.123Z","messageIndex":0,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"user","content":"User message only"}}',
      ].join('\n');

      vi.mocked(mockFs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const preview = await conversationPersistence.getConversationPreview();

      expect(preview.firstMessage).toBe('User message only');
      expect(preview.lastAssistantMessage).toBeUndefined();
      expect(preview.actualMessageCount).toBe(1);
    });

    it('should handle empty conversations', async () => {
      const mockFileContent = [
        '{"timestamp":"2025-01-15T10:30:00.000Z","messageIndex":0,"messageType":"session-meta","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"type":"session-start"}}',
      ].join('\n');

      vi.mocked(mockFs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const preview = await conversationPersistence.getConversationPreview();

      expect(preview.firstMessage).toBeUndefined();
      expect(preview.lastAssistantMessage).toBeUndefined();
      expect(preview.actualMessageCount).toBe(0);
    });

    it('should handle missing conversation file', async () => {
      const error = new Error(
        'ENOENT: no such file or directory'
      ) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(mockFs.access).mockRejectedValue(error);

      const preview = await conversationPersistence.getConversationPreview();

      expect(preview.firstMessage).toBeUndefined();
      expect(preview.lastAssistantMessage).toBeUndefined();
      expect(preview.actualMessageCount).toBe(0);
    });

    it('should skip malformed JSONL lines gracefully', async () => {
      const mockFileContent = [
        '{"timestamp":"2025-01-15T10:30:15.123Z","messageIndex":0,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"user","content":"Valid user message"}}',
        'invalid json line that cannot be parsed',
        '{"timestamp":"2025-01-15T10:30:45.789Z","messageIndex":1,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"assistant","content":"Valid assistant message"}}',
      ].join('\n');

      vi.mocked(mockFs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const preview = await conversationPersistence.getConversationPreview();

      expect(preview.firstMessage).toBe('Valid user message');
      expect(preview.lastAssistantMessage).toBe('Valid assistant message');
      expect(preview.actualMessageCount).toBe(2);
    });

    it('should handle tool messages and other roles correctly', async () => {
      const mockFileContent = [
        '{"timestamp":"2025-01-15T10:30:15.123Z","messageIndex":0,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"user","content":"Help me read a file"}}',
        '{"timestamp":"2025-01-15T10:30:45.789Z","messageIndex":1,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"tool","content":"Tool execution","toolName":"Read"}}',
        '{"timestamp":"2025-01-15T10:31:15.234Z","messageIndex":2,"messageType":"conversation","sessionId":"01932d4c-89ab-7890-abcd-123456789012","message":{"role":"assistant","content":"I can help you read that file"}}',
      ].join('\n');

      vi.mocked(mockFs.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);

      const preview = await conversationPersistence.getConversationPreview();

      expect(preview.firstMessage).toBe('Help me read a file');
      expect(preview.lastAssistantMessage).toBe(
        'I can help you read that file'
      );
      expect(preview.actualMessageCount).toBe(3); // user + tool + assistant
    });
  });

  describe('cleanup operations', () => {
    beforeEach(() => {
      vi.mocked(mockFs.readdir).mockResolvedValue([
        '01932d4a-0123-7890-abcd-123456789abc.jsonl',
        '01932d4b-4567-7890-abcd-123456789def.jsonl',
        '01932d4c-89ab-7890-abcd-123456789012.jsonl',
      ] as never);
      vi.mocked(mockFs.access).mockResolvedValue(undefined);
    });

    describe('getAllConversations', () => {
      it('should return all valid conversation session IDs', async () => {
        const sessions = await conversationPersistence.getAllConversations();

        expect(mockFs.access).toHaveBeenCalledWith(
          '/mock/app/data/conversations/Users_dev_test-project'
        );
        expect(mockFs.readdir).toHaveBeenCalledWith(
          '/mock/app/data/conversations/Users_dev_test-project'
        );
        expect(sessions).toEqual([
          '01932d4c-89ab-7890-abcd-123456789012',
          '01932d4b-4567-7890-abcd-123456789def',
          '01932d4a-0123-7890-abcd-123456789abc',
        ]); // Latest first
      });

      it('should filter out non-JSONL files', async () => {
        vi.mocked(mockFs.readdir).mockResolvedValue([
          '01932d4a-0123-7890-abcd-123456789abc.jsonl',
          'README.md',
          '.DS_Store',
          '01932d4b-4567-7890-abcd-123456789def.jsonl',
        ] as never);

        const sessions = await conversationPersistence.getAllConversations();

        expect(sessions).toEqual([
          '01932d4b-4567-7890-abcd-123456789def',
          '01932d4a-0123-7890-abcd-123456789abc',
        ]);
      });

      it('should filter out invalid session ID formats', async () => {
        vi.mocked(mockFs.readdir).mockResolvedValue([
          '01932d4a-0123-7890-abcd-123456789abc.jsonl', // valid
          'invalid-session.jsonl', // invalid
          '01932d4b-4567-7890-abcd-123456789def.jsonl', // valid
        ] as never);

        const sessions = await conversationPersistence.getAllConversations();

        expect(sessions).toEqual([
          '01932d4b-4567-7890-abcd-123456789def',
          '01932d4a-0123-7890-abcd-123456789abc',
        ]);
      });

      it('should handle missing conversation directory', async () => {
        const error = new Error(
          'ENOENT: no such file or directory'
        ) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        vi.mocked(mockFs.access).mockRejectedValue(error);

        const sessions = await conversationPersistence.getAllConversations();

        expect(sessions).toEqual([]);
      });

      it('should handle other directory access errors', async () => {
        const error = new Error('EACCES: permission denied');
        vi.mocked(mockFs.access).mockRejectedValue(error);

        const sessions = await conversationPersistence.getAllConversations();

        expect(sessions).toEqual([]);
      });
    });

    describe('getConversationStats', () => {
      it('should return file size and age statistics', async () => {
        const mockStats = {
          size: 1024,
          mtime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        };
        vi.mocked(mockFs.stat).mockResolvedValue(mockStats as never);

        const stats =
          await conversationPersistence.getConversationStats('test-session');

        expect(mockFs.stat).toHaveBeenCalledWith(
          '/mock/app/data/conversations/Users_dev_test-project/test-session.jsonl'
        );
        expect(stats.size).toBe(1024);
        expect(stats.age).toBeCloseTo(2, 1); // Approximately 2 days
      });

      it('should handle missing conversation file', async () => {
        const error = new Error(
          'ENOENT: no such file or directory'
        ) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        vi.mocked(mockFs.stat).mockRejectedValue(error);

        const stats =
          await conversationPersistence.getConversationStats('missing-session');

        expect(stats).toEqual({ size: 0, age: 0 });
      });
    });

    describe('getOldConversations', () => {
      it('should return conversations older than threshold', async () => {
        const mockStats1 = {
          mtime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        }; // 10 days
        const mockStats2 = {
          mtime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        }; // 3 days
        const mockStats3 = {
          mtime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        }; // 8 days

        vi.mocked(mockFs.stat)
          .mockResolvedValueOnce(mockStats1 as never) // 01932d4a - 10 days old
          .mockResolvedValueOnce(mockStats2 as never) // 01932d4b - 3 days old
          .mockResolvedValueOnce(mockStats3 as never); // 01932d4c - 8 days old

        const oldSessions =
          await conversationPersistence.getOldConversations(7);

        expect(oldSessions).toEqual([
          '01932d4c-89ab-7890-abcd-123456789012', // 8 days old
          '01932d4a-0123-7890-abcd-123456789abc', // 10 days old
        ]); // Only sessions older than 7 days (in order they appear in getAllConversations)
      });

      it('should handle file access errors gracefully', async () => {
        const error = new Error(
          'ENOENT: no such file or directory'
        ) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        vi.mocked(mockFs.stat).mockRejectedValue(error);

        const oldSessions =
          await conversationPersistence.getOldConversations(7);

        expect(oldSessions).toEqual([]); // Should return empty array, not throw
      });

      it('should use default threshold of 7 days', async () => {
        const mockStats = {
          mtime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        }; // 10 days
        vi.mocked(mockFs.stat).mockResolvedValue(mockStats as never);

        const oldSessions = await conversationPersistence.getOldConversations(); // No threshold specified

        expect(oldSessions).toEqual([
          '01932d4c-89ab-7890-abcd-123456789012',
          '01932d4b-4567-7890-abcd-123456789def',
          '01932d4a-0123-7890-abcd-123456789abc',
        ]); // All sessions older than 7 days
      });
    });

    describe('deleteConversation', () => {
      it('should successfully delete a conversation file', async () => {
        const mockStats = { size: 2048 };
        vi.mocked(mockFs.stat).mockResolvedValue(mockStats as never);
        vi.mocked(mockFs.unlink).mockResolvedValue(undefined);

        const result = await conversationPersistence.deleteConversation(
          '01932d4c-89ab-7890-abcd-123456789012'
        );

        expect(mockFs.stat).toHaveBeenCalledWith(
          '/mock/app/data/conversations/Users_dev_test-project/01932d4c-89ab-7890-abcd-123456789012.jsonl'
        );
        expect(mockFs.unlink).toHaveBeenCalledWith(
          '/mock/app/data/conversations/Users_dev_test-project/01932d4c-89ab-7890-abcd-123456789012.jsonl'
        );
        expect(result).toEqual({
          success: true,
          sessionId: '01932d4c-89ab-7890-abcd-123456789012',
          sizeFreed: 2048,
        });
      });

      it('should handle invalid session ID format', async () => {
        const result =
          await conversationPersistence.deleteConversation(
            'invalid-session-id'
          );

        expect(mockFs.stat).not.toHaveBeenCalled();
        expect(mockFs.unlink).not.toHaveBeenCalled();
        expect(result).toEqual({
          success: false,
          sessionId: 'invalid-session-id',
          sizeFreed: 0,
          error: 'Invalid session ID format',
        });
      });

      it('should handle file not found error', async () => {
        const error = new Error(
          'ENOENT: no such file or directory'
        ) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        vi.mocked(mockFs.stat).mockRejectedValue(error);

        const result = await conversationPersistence.deleteConversation(
          '01932d4c-89ab-7890-abcd-123456789012'
        );

        expect(result.success).toBe(false);
        expect(result.sessionId).toBe('01932d4c-89ab-7890-abcd-123456789012');
        expect(result.sizeFreed).toBe(0);
        expect(result.error).toContain('ENOENT');
      });

      it('should handle permission denied error', async () => {
        const mockStats = { size: 1024 };
        vi.mocked(mockFs.stat).mockResolvedValue(mockStats as never);

        const error = new Error('EACCES: permission denied');
        vi.mocked(mockFs.unlink).mockRejectedValue(error);

        const result = await conversationPersistence.deleteConversation(
          '01932d4c-89ab-7890-abcd-123456789012'
        );

        expect(result.success).toBe(false);
        expect(result.sessionId).toBe('01932d4c-89ab-7890-abcd-123456789012');
        expect(result.sizeFreed).toBe(0);
        expect(result.error).toContain('permission denied');
      });
    });

    describe('deleteConversations', () => {
      it('should handle mixed success and failure scenarios', async () => {
        const sessionIds = [
          '01932d4a-0123-7890-abcd-123456789abc', // Will succeed
          'invalid-session', // Will fail - invalid format
          '01932d4b-4567-7890-abcd-123456789def', // Will succeed
          '01932d4c-89ab-7890-abcd-123456789012', // Will fail - file error
        ];

        // Mock successful deletions for valid sessions
        const mockStats = { size: 1024 };
        vi.mocked(mockFs.stat)
          .mockResolvedValueOnce(mockStats as never) // session1 - success
          .mockResolvedValueOnce(mockStats as never) // session3 - success
          .mockRejectedValueOnce(new Error('ENOENT')); // session4 - file error

        vi.mocked(mockFs.unlink)
          .mockResolvedValueOnce(undefined) // session1 - success
          .mockResolvedValueOnce(undefined); // session3 - success

        const result =
          await conversationPersistence.deleteConversations(sessionIds);

        expect(result.deletedCount).toBe(2);
        expect(result.totalSizeFreed).toBe(2048); // 2 × 1024
        expect(result.successes).toHaveLength(2);
        expect(result.failures).toHaveLength(2);

        // Check successful deletions
        expect(result.successes[0].sessionId).toBe(
          '01932d4a-0123-7890-abcd-123456789abc'
        );
        expect(result.successes[1].sessionId).toBe(
          '01932d4b-4567-7890-abcd-123456789def'
        );

        // Check failed deletions
        expect(result.failures[0].sessionId).toBe('invalid-session');
        expect(result.failures[0].error).toBe('Invalid session ID format');
        expect(result.failures[1].sessionId).toBe(
          '01932d4c-89ab-7890-abcd-123456789012'
        );
      });

      it('should handle all successful deletions', async () => {
        const sessionIds = [
          '01932d4a-0123-7890-abcd-123456789abc',
          '01932d4b-4567-7890-abcd-123456789def',
        ];

        const mockStats = { size: 512 };
        vi.mocked(mockFs.stat).mockResolvedValue(mockStats as never);
        vi.mocked(mockFs.unlink).mockResolvedValue(undefined);

        const result =
          await conversationPersistence.deleteConversations(sessionIds);

        expect(result.deletedCount).toBe(2);
        expect(result.totalSizeFreed).toBe(1024); // 2 × 512
        expect(result.successes).toHaveLength(2);
        expect(result.failures).toHaveLength(0);
      });

      it('should handle all failed deletions', async () => {
        const sessionIds = ['invalid1', 'invalid2'];

        const result =
          await conversationPersistence.deleteConversations(sessionIds);

        expect(result.deletedCount).toBe(0);
        expect(result.totalSizeFreed).toBe(0);
        expect(result.successes).toHaveLength(0);
        expect(result.failures).toHaveLength(2);
        expect(result.failures[0].error).toBe('Invalid session ID format');
        expect(result.failures[1].error).toBe('Invalid session ID format');
      });

      it('should handle empty session list', async () => {
        const result = await conversationPersistence.deleteConversations([]);

        expect(result.deletedCount).toBe(0);
        expect(result.totalSizeFreed).toBe(0);
        expect(result.successes).toHaveLength(0);
        expect(result.failures).toHaveLength(0);
      });
    });
  });
});
