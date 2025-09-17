import { describe, it, expect } from 'vitest';
import {
  formatToolName,
  truncateValue,
  formatToolArgs,
  extractResultText,
  formatToolCall,
  renderToolCall,
  renderToolCallWithErrorMarkers,
} from './toolFormatting.js';

describe('toolFormatting', () => {
  describe('formatToolName', () => {
    it('should convert snake_case to Title Case', () => {
      expect(formatToolName('filesystem_read_file')).toBe(
        'Filesystem Read File'
      );
      expect(formatToolName('simple_tool')).toBe('Simple Tool');
      expect(formatToolName('already_formatted')).toBe('Already Formatted');
    });
  });

  describe('truncateValue', () => {
    it('should not truncate strings shorter than max length', () => {
      expect(truncateValue('short', 50)).toBe('short');
    });

    it('should truncate long strings with ellipsis', () => {
      const longString = 'a'.repeat(60);
      const result = truncateValue(longString, 50);
      expect(result).toBe('a'.repeat(47) + '...');
      expect(result.length).toBe(50);
    });

    it('should use default max length of 50', () => {
      const longString = 'a'.repeat(60);
      const result = truncateValue(longString);
      expect(result.length).toBe(50);
    });
  });

  describe('formatToolArgs', () => {
    it('should format simple object arguments on one line', () => {
      const args = { path: 'test.txt', offset: 10 };
      const result = formatToolArgs(args);
      expect(result).toBe('path: test.txt, offset: 10');
    });

    it('should truncate long argument values', () => {
      const longPath =
        '/very/long/path/that/should/be/truncated/because/it/exceeds/fifty/characters.txt';
      const args = { path: longPath };
      const result = formatToolArgs(args);
      expect(result).toContain('...');
      expect(result.length).toBeLessThan(longPath.length + 10);
    });

    it('should handle empty or null args', () => {
      expect(formatToolArgs({})).toBe('');
      expect(formatToolArgs(null)).toBe('');
      expect(formatToolArgs(undefined)).toBe('');
    });

    it('should stringify complex values', () => {
      const args = { config: { enabled: true, count: 5 } };
      const result = formatToolArgs(args);
      expect(result).toContain('{"enabled":true,"count":5}');
    });

    it('should handle arrays safely', () => {
      const args = { files: ['file1.txt', 'file2.txt', 'file3.txt'] };
      const result = formatToolArgs(args);
      expect(result).toContain('files: [file1.txt, file2.txt, file3.txt]');
    });

    it('should handle arrays with mixed types', () => {
      const args = { mixed: ['string', 42, true, null] };
      const result = formatToolArgs(args);
      expect(result).toContain('mixed: [string, 42, true, null]');
    });

    it('should handle empty arrays', () => {
      const args = { empty: [] };
      const result = formatToolArgs(args);
      expect(result).toContain('empty: []');
    });

    it('should handle arrays with objects', () => {
      const args = { items: [{ name: 'test' }, 'string', 42] };
      const result = formatToolArgs(args);
      expect(result).toContain('items: [[object Object], string, 42]');
    });

    it('should handle numbers and booleans', () => {
      const args = { count: 42, enabled: true, disabled: false };
      const result = formatToolArgs(args);
      expect(result).toBe('count: 42, enabled: true, disabled: false');
    });

    it('should handle non-serializable objects gracefully', () => {
      const circular: any = { name: 'test' };
      circular.self = circular; // Create circular reference
      const args = { data: circular };
      const result = formatToolArgs(args);
      expect(result).toContain('data: {object}');
    });
  });

  describe('extractResultText', () => {
    it('should extract text from string results', () => {
      expect(extractResultText('simple text')).toBe('simple text');
    });

    it('should extract text from array with text objects', () => {
      const result = [
        { type: 'text', text: 'first part' },
        { type: 'text', text: 'second part' },
      ];
      expect(extractResultText(result)).toBe('first part second part');
    });

    it('should extract text from object with text property', () => {
      const result = { text: 'extracted text' };
      expect(extractResultText(result)).toBe('extracted text');
    });

    it('should extract text from nested result.result structure', () => {
      // This is the actual structure from MCP tool responses
      const result = { result: 'file contents here' };
      expect(extractResultText(result)).toBe('file contents here');
    });

    it('should handle deeply nested result structures', () => {
      const result = { result: { result: 'deeply nested text' } };
      expect(extractResultText(result)).toBe('deeply nested text');
    });

    it('should return empty string for invalid results', () => {
      expect(extractResultText(null)).toBe('');
      expect(extractResultText(undefined)).toBe('');
      expect(extractResultText(123)).toBe('');
    });
  });

  describe('formatToolCall', () => {
    it('should format pending tool call', () => {
      const result = formatToolCall('filesystem_read_file', {
        path: 'test.txt',
      });
      expect(result.formattedName).toBe('Filesystem Read File');
      expect(result.formattedArgs).toBe('path: test.txt');
      expect(result.state).toBe('pending');
    });

    it('should format successful tool call', () => {
      const result = formatToolCall(
        'filesystem_read_file',
        { path: 'test.txt' },
        'file contents here',
        false
      );
      expect(result.state).toBe('success');
      expect(result.resultText).toBe('file contents here');
    });

    it('should format error tool call', () => {
      const result = formatToolCall(
        'filesystem_read_file',
        { path: 'missing.txt' },
        'ENOENT: no such file or directory',
        true
      );
      expect(result.state).toBe('error');
      expect(result.errorText).toBe('ENOENT: no such file or directory');
    });
  });

  describe('renderToolCall', () => {
    it('should render pending tool call with bold name', () => {
      const formatted = formatToolCall('filesystem_read_file', {
        path: 'test.txt',
      });
      const result = renderToolCall(formatted);
      expect(result).toBe('**Filesystem Read File** (path: test.txt)');
    });

    it('should render successful tool call', () => {
      const formatted = formatToolCall(
        'filesystem_read_file',
        { path: 'test.txt' },
        'file contents',
        false
      );
      const result = renderToolCall(formatted);
      expect(result).toBe(
        '**Filesystem Read File** (path: test.txt)\n└ Result: file contents'
      );
    });

    it('should render error tool call', () => {
      const formatted = formatToolCall(
        'filesystem_read_file',
        { path: 'missing.txt' },
        'File not found',
        true
      );
      const result = renderToolCall(formatted);
      expect(result).toBe(
        '**Filesystem Read File** (path: missing.txt)\n└ Error: File not found'
      );
    });
  });

  describe('renderToolCallWithErrorMarkers', () => {
    it('should add error marker for error states', () => {
      const formatted = formatToolCall(
        'filesystem_read_file',
        { path: 'missing.txt' },
        'File not found',
        true
      );
      const result = renderToolCallWithErrorMarkers(formatted);
      expect(result).toContain('[ERROR]└ Error: File not found');
    });

    it('should not add markers for success states', () => {
      const formatted = formatToolCall(
        'filesystem_read_file',
        { path: 'test.txt' },
        'file contents',
        false
      );
      const result = renderToolCallWithErrorMarkers(formatted);
      expect(result).not.toContain('[ERROR]');
      expect(result).toContain('└ Result: file contents');
    });
  });
});
