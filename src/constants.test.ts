import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPT,
  MCP_SERVERS,
  TOOL_TIMEOUT_MS,
  MAX_STEPS,
  buildSystemPrompt,
} from './constants.js';

describe('constants', () => {
  describe('SYSTEM_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(typeof SYSTEM_PROMPT).toBe('string');
      expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('should contain operating guidelines', () => {
      expect(SYSTEM_PROMPT).toContain('Operating Guidelines');
    });

    it('should mention tool usage', () => {
      expect(SYSTEM_PROMPT).toContain('tools');
    });

    it('should include safety and privacy guidelines', () => {
      expect(SYSTEM_PROMPT.toLowerCase()).toContain('privacy');
    });
  });

  describe('MCP_SERVERS', () => {
    it('should be a readonly array', () => {
      expect(Array.isArray(MCP_SERVERS)).toBe(true);
    });

    it('should contain valid server configurations', () => {
      MCP_SERVERS.forEach(server => {
        expect(server).toHaveProperty('name');
        expect(server).toHaveProperty('type');
        expect(typeof server.name).toBe('string');
        expect(['stdio', 'sse']).toContain(server.type);
      });
    });

    it('should have unique server names', () => {
      const names = MCP_SERVERS.map(server => server.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should validate stdio server configurations', () => {
      const stdioServers = MCP_SERVERS.filter(
        server => server.type === 'stdio'
      );
      stdioServers.forEach(server => {
        expect(server).toHaveProperty('command');
        expect(typeof server.command).toBe('string');
        expect(server.command.length).toBeGreaterThan(0);
      });
    });

    it('should validate sse server configurations', () => {
      const sseServers = MCP_SERVERS.filter(server => server.type === 'sse');
      sseServers.forEach(server => {
        expect(server).toHaveProperty('url');
        expect(typeof server.url).toBe('string');
        expect(() => new URL(server.url)).not.toThrow();
      });
    });
  });

  describe('TOOL_TIMEOUT_MS', () => {
    it('should be a positive number', () => {
      expect(typeof TOOL_TIMEOUT_MS).toBe('number');
      expect(TOOL_TIMEOUT_MS).toBeGreaterThan(0);
    });

    it('should be 1800 seconds (1800000ms)', () => {
      expect(TOOL_TIMEOUT_MS).toBe(1800000);
    });
  });

  describe('MAX_STEPS', () => {
    it('should be a positive integer', () => {
      expect(typeof MAX_STEPS).toBe('number');
      expect(MAX_STEPS).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_STEPS)).toBe(true);
    });

    it('should be 100', () => {
      expect(MAX_STEPS).toBe(100);
    });
  });

  describe('buildSystemPrompt', () => {
    const nonInteractiveText =
      'You are in a non-interactive environment meaning that the user cannot respond to you after they send the initial message.';

    describe('interactive mode behavior', () => {
      it('should exclude non-interactive text when isInteractive is true', () => {
        const interactivePrompt = buildSystemPrompt(undefined, 'replace', true);
        expect(interactivePrompt).not.toContain(nonInteractiveText);
      });

      it('should include non-interactive text when isInteractive is false', () => {
        const nonInteractivePrompt = buildSystemPrompt(
          undefined,
          'replace',
          false
        );
        expect(nonInteractivePrompt).toContain(nonInteractiveText);
      });

      it('should include non-interactive text when isInteractive is not specified (defaults to false)', () => {
        const defaultPrompt = buildSystemPrompt();
        expect(defaultPrompt).toContain(nonInteractiveText);
      });

      it('should have shorter prompt length in interactive mode', () => {
        const interactivePrompt = buildSystemPrompt(undefined, 'replace', true);
        const nonInteractivePrompt = buildSystemPrompt(
          undefined,
          'replace',
          false
        );
        expect(interactivePrompt.length).toBeLessThan(
          nonInteractivePrompt.length
        );
      });
    });

    describe('custom content modes with interactive behavior', () => {
      const customContent = 'Custom system content';

      it('should exclude non-interactive text in interactive mode with append mode', () => {
        const prompt = buildSystemPrompt(customContent, 'append', true);
        expect(prompt).not.toContain(nonInteractiveText);
        expect(prompt).toContain(customContent);
      });

      it('should exclude non-interactive text in interactive mode with prepend mode', () => {
        const prompt = buildSystemPrompt(customContent, 'prepend', true);
        expect(prompt).not.toContain(nonInteractiveText);
        expect(prompt).toContain(customContent);
      });

      it('should include non-interactive text in non-interactive mode with append mode', () => {
        const prompt = buildSystemPrompt(customContent, 'append', false);
        expect(prompt).toContain(nonInteractiveText);
        expect(prompt).toContain(customContent);
      });

      it('should include non-interactive text in non-interactive mode with prepend mode', () => {
        const prompt = buildSystemPrompt(customContent, 'prepend', false);
        expect(prompt).toContain(nonInteractiveText);
        expect(prompt).toContain(customContent);
      });

      it('should use custom content only in replace mode regardless of interactive setting', () => {
        const interactivePrompt = buildSystemPrompt(
          customContent,
          'replace',
          true
        );
        const nonInteractivePrompt = buildSystemPrompt(
          customContent,
          'replace',
          false
        );

        expect(interactivePrompt).toBe(nonInteractivePrompt);
        expect(interactivePrompt).toContain(customContent);
        // In replace mode, the default content is replaced entirely
        expect(interactivePrompt).not.toContain('Operating Guidelines');
      });
    });

    describe('system information inclusion', () => {
      it('should always include system information regardless of interactive mode', () => {
        const interactivePrompt = buildSystemPrompt(undefined, 'replace', true);
        const nonInteractivePrompt = buildSystemPrompt(
          undefined,
          'replace',
          false
        );

        expect(interactivePrompt).toContain('<system information>');
        expect(nonInteractivePrompt).toContain('<system information>');
        expect(interactivePrompt).toContain('Current Time:');
        expect(nonInteractivePrompt).toContain('Current Time:');
        expect(interactivePrompt).toContain('Current working directory:');
        expect(nonInteractivePrompt).toContain('Current working directory:');
      });
    });

    describe('content preservation', () => {
      it('should preserve all other content when removing non-interactive text', () => {
        const interactivePrompt = buildSystemPrompt(undefined, 'replace', true);

        // Should still contain main content
        expect(interactivePrompt).toContain('Operating Guidelines');
        expect(interactivePrompt).toContain('tools available to you');
        expect(interactivePrompt).toContain('safety and privacy');

        // Should preserve guidelines that are not related to non-interactive behavior
        expect(interactivePrompt).toContain(
          'Always explain what you are doing when calling tools'
        );
        expect(interactivePrompt).toContain(
          'Be proactive in using available tools'
        );
      });
    });
  });
});
