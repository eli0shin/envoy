import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAllCommands,
  getCommandSuggestions,
  executeCommand,
} from './registry.js';
import { setCommandCallbacks } from './builtins.js';
import './builtins.js'; // Import to trigger registration

describe('Built-in Commands Registration', () => {
  let mockHelpCallback: ReturnType<typeof vi.fn>;
  let mockClearCallback: ReturnType<typeof vi.fn>;
  let mockExitCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockHelpCallback = vi.fn();
    mockClearCallback = vi.fn();
    mockExitCallback = vi.fn();

    setCommandCallbacks({
      onHelp: mockHelpCallback,
      onClear: mockClearCallback,
      onExit: mockExitCallback,
    });
  });
  it('should have commands registered when module loads', () => {
    const all = getAllCommands();

    expect(all.length).toBeGreaterThan(0);
    expect(all.map((c) => c.name)).toContain('clear');
    expect(all.map((c) => c.name)).toContain('help');
    expect(all.map((c) => c.name)).toContain('exit');
  });

  it("should return suggestions for '/' input", () => {
    const suggestions = getCommandSuggestions('/');

    expect(suggestions.length).toBe(3);
    expect(suggestions.map((s) => s.name)).toContain('clear');
    expect(suggestions.map((s) => s.name)).toContain('help');
    expect(suggestions.map((s) => s.name)).toContain('exit');
  });

  it('should return filtered suggestions for partial input', () => {
    const suggestions = getCommandSuggestions('/cl');

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].name).toBe('clear');
  });

  it('help command should call help callback and return undefined', () => {
    const result = executeCommand('/help');

    expect(result.isCommand).toBe(true);
    expect(result.result).toBeUndefined();
    expect(mockHelpCallback).toHaveBeenCalledTimes(1);
  });

  it('clear command should work but return undefined', () => {
    const result = executeCommand('/clear');

    expect(result.isCommand).toBe(true);
    expect(result.result).toBeUndefined();
  });
});
