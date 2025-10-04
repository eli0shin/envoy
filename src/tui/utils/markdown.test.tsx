import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Markdown } from './markdown.js';

describe('Markdown', () => {
  describe('Todo List Rendering', () => {
    it('should render unchecked todo item with checkbox', () => {
      const markdown = '- [ ] Unchecked task';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      // Should contain checkbox symbol
      expect(output).toContain('☐');
      // Should contain the task text
      expect(output).toContain('Unchecked task');
      // Should NOT contain the literal [ ] marker
      expect(output).not.toContain('[ ]');
    });

    it('should render checked todo item with checked box', () => {
      const markdown = '- [x] Completed task';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      // Should contain checked box symbol
      expect(output).toContain('☑');
      // Should contain the task text
      expect(output).toContain('Completed task');
      // Should NOT contain the literal [x] marker
      expect(output).not.toContain('[x]');
    });

    it('should render in-progress todo item with half-filled circle', () => {
      const markdown = '- [~] In progress task';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      // Should contain half-filled circle symbol
      expect(output).toContain('◐');
      // Should contain the task text
      expect(output).toContain('In progress task');
      // Should NOT contain the literal [~] marker
      expect(output).not.toContain('[~]');
    });

    it('should render all three todo states correctly in one list', () => {
      const markdown = `- [ ] Pending task
- [~] In progress task
- [x] Completed task`;
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      // Check all three symbols are present
      expect(output).toContain('☐');
      expect(output).toContain('◐');
      expect(output).toContain('☑');
      
      // Check all task texts are present
      expect(output).toContain('Pending task');
      expect(output).toContain('In progress task');
      expect(output).toContain('Completed task');
      
      // Ensure no literal markers remain
      expect(output).not.toContain('[ ]');
      expect(output).not.toContain('[~]');
      expect(output).not.toContain('[x]');
    });

    it('should handle in-progress todo with extra whitespace', () => {
      const markdown = '- [~]  Task with extra spaces';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('◐');
      expect(output).toContain('Task with extra spaces');
      expect(output).not.toContain('[~]');
    });

    it('should handle regular list items (non-todo)', () => {
      const markdown = '- Regular list item\n- Another item';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      // Should use bullet point
      expect(output).toContain('•');
      expect(output).toContain('Regular list item');
      expect(output).toContain('Another item');
    });

    it('should handle ordered lists', () => {
      const markdown = '1. First item\n2. Second item';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('1.');
      expect(output).toContain('2.');
      expect(output).toContain('First item');
      expect(output).toContain('Second item');
    });

    it('should handle nested lists', () => {
      const markdown = `- [ ] Parent task
  - [~] Nested in-progress
  - [x] Nested completed`;
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('☐');
      expect(output).toContain('◐');
      expect(output).toContain('☑');
      expect(output).toContain('Parent task');
      expect(output).toContain('Nested in-progress');
      expect(output).toContain('Nested completed');
    });
  });

  describe('Basic Markdown Elements', () => {
    it('should render plain text', () => {
      const markdown = 'Plain text content';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('Plain text content');
    });

    it('should render bold text', () => {
      const markdown = '**Bold text**';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('Bold text');
    });

    it('should render italic text', () => {
      const markdown = '*Italic text*';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('Italic text');
    });

    it('should render inline code', () => {
      const markdown = 'Use `console.log()` to print';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('console.log()');
    });

    it('should handle empty content', () => {
      const markdown = '';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toBe('');
    });
  });

  describe('Headings', () => {
    it('should render h1 heading', () => {
      const markdown = '# Heading 1';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('Heading 1');
    });

    it('should render h2 heading', () => {
      const markdown = '## Heading 2';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('Heading 2');
    });

    it('should render h3 heading', () => {
      const markdown = '### Heading 3';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('Heading 3');
    });
  });

  describe('Links', () => {
    it('should render link with text', () => {
      const markdown = '[Link text](https://example.com)';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('Link text');
      expect(output).toContain('https://example.com');
    });

    it('should render bare URL', () => {
      const markdown = '[https://example.com](https://example.com)';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('https://example.com');
    });
  });

  describe('Code Blocks', () => {
    it('should render code block', () => {
      const markdown = '```\nconst x = 1;\n```';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('const x = 1;');
    });

    it('should render code block with language', () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      const { lastFrame } = render(<Markdown content={markdown} />);
      const output = lastFrame() || '';
      
      expect(output).toContain('const x = 1;');
    });
  });
});
